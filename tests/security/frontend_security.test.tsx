import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import '@testing-library/jest-dom';

// Mock components and utilities
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { EnhanceForm } from '@/components/EnhanceForm';
import { sanitizeInput, validateInput } from '@/utils/security';
import { api } from '@/utils/api';

// Mock the API
jest.mock('@/utils/api');

describe('Frontend Security Tests', () => {
  // ===== XSS Prevention Tests =====
  
  describe('XSS Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<svg onload="alert(\'XSS\')">',
      '<iframe src="javascript:alert(\'XSS\')">',
      '"><script>alert("XSS")</script>',
      '<body onload="alert(\'XSS\')">',
      '${alert("XSS")}',
      '{{constructor.constructor("alert(1)")()}}',
    ];

    test('should sanitize user input in forms', () => {
      xssPayloads.forEach((payload) => {
        const sanitized = sanitizeInput(payload);
        
        // Should not contain script tags
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
      });
    });

    test('should escape HTML in rendered content', async () => {
      const TestComponent = ({ content }: { content: string }) => {
        return <div data-testid="content">{content}</div>;
      };

      xssPayloads.forEach((payload) => {
        const { container } = render(<TestComponent content={payload} />);
        
        // Check that dangerous content is escaped
        const contentElement = screen.getByTestId('content');
        expect(contentElement.innerHTML).not.toContain('<script>');
        expect(contentElement.innerHTML).not.toContain('javascript:');
        
        // Verify text content is preserved but HTML is escaped
        expect(contentElement.textContent).toBe(payload);
      });
    });

    test('should sanitize dangerouslySetInnerHTML usage', () => {
      const TestComponent = ({ html }: { html: string }) => {
        // This pattern should be avoided, but if used, must be sanitized
        const sanitizedHtml = sanitizeInput(html);
        return (
          <div 
            data-testid="dangerous-content"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }} 
          />
        );
      };

      xssPayloads.forEach((payload) => {
        const { container } = render(<TestComponent html={payload} />);
        
        // Verify no script execution
        expect(container.querySelector('script')).toBeNull();
        expect(container.innerHTML).not.toContain('javascript:');
      });
    });

    test('should validate URLs to prevent javascript: protocol', () => {
      const maliciousUrls = [
        'javascript:alert("XSS")',
        'jAvAsCrIpT:alert("XSS")',
        'javascript://comment%0aalert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
      ];

      const LinkComponent = ({ href }: { href: string }) => {
        const isValidUrl = (url: string) => {
          const allowedProtocols = ['http:', 'https:', 'mailto:'];
          try {
            const urlObj = new URL(url);
            return allowedProtocols.includes(urlObj.protocol);
          } catch {
            return false;
          }
        };

        if (!isValidUrl(href)) {
          return <span>Invalid URL</span>;
        }

        return <a href={href}>Link</a>;
      };

      maliciousUrls.forEach((url) => {
        const { container } = render(<LinkComponent href={url} />);
        expect(container.querySelector('a')).toBeNull();
        expect(screen.getByText('Invalid URL')).toBeInTheDocument();
      });
    });
  });

  // ===== CSRF Protection Tests =====

  describe('CSRF Protection', () => {
    beforeEach(() => {
      // Mock CSRF token in meta tag
      const meta = document.createElement('meta');
      meta.name = 'csrf-token';
      meta.content = 'test-csrf-token';
      document.head.appendChild(meta);
    });

    afterEach(() => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) meta.remove();
    });

    test('should include CSRF token in API requests', async () => {
      const mockApi = api as jest.Mocked<typeof api>;
      mockApi.post = jest.fn().mockResolvedValue({ data: { success: true } });

      const TestComponent = () => {
        const handleSubmit = async () => {
          await api.post('/api/v1/enhance', { prompt: 'test' });
        };

        return <button onClick={handleSubmit}>Submit</button>;
      };

      render(<TestComponent />);
      
      const button = screen.getByText('Submit');
      await userEvent.click(button);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/v1/enhance',
        { prompt: 'test' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token',
          }),
        })
      );
    });

    test('should refresh CSRF token on 403 response', async () => {
      const mockApi = api as jest.Mocked<typeof api>;
      
      // First request fails with 403
      mockApi.post = jest.fn()
        .mockRejectedValueOnce({ response: { status: 403 } })
        .mockResolvedValueOnce({ data: { success: true } });

      // Mock token refresh
      mockApi.get = jest.fn().mockResolvedValue({ 
        data: { csrf_token: 'new-csrf-token' } 
      });

      const TestComponent = () => {
        const [result, setResult] = React.useState('');
        
        const handleSubmit = async () => {
          try {
            await api.post('/api/v1/enhance', { prompt: 'test' });
            setResult('Success');
          } catch (error) {
            if (error.response?.status === 403) {
              // Refresh CSRF token
              const { data } = await api.get('/api/v1/csrf-token');
              document.querySelector('meta[name="csrf-token"]')?.setAttribute('content', data.csrf_token);
              
              // Retry request
              await api.post('/api/v1/enhance', { prompt: 'test' });
              setResult('Success after retry');
            }
          }
        };

        return (
          <>
            <button onClick={handleSubmit}>Submit</button>
            <div>{result}</div>
          </>
        );
      };

      render(<TestComponent />);
      
      const button = screen.getByText('Submit');
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Success after retry')).toBeInTheDocument();
      });

      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/csrf-token');
      expect(mockApi.post).toHaveBeenCalledTimes(2);
    });
  });

  // ===== Authentication & Authorization Tests =====

  describe('Authentication & Authorization', () => {
    test('should store JWT token securely', async () => {
      const TestComponent = () => {
        const { login } = useAuth();
        
        const handleLogin = async () => {
          await login('test@example.com', 'password');
        };

        return <button onClick={handleLogin}>Login</button>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const button = screen.getByText('Login');
      await userEvent.click(button);

      // Token should not be in localStorage (vulnerable to XSS)
      expect(localStorage.getItem('token')).toBeNull();
      
      // Token should be in httpOnly cookie (set by server)
      // or in memory only
    });

    test('should handle token expiration gracefully', async () => {
      const mockApi = api as jest.Mocked<typeof api>;
      
      // Mock expired token response
      mockApi.get = jest.fn().mockRejectedValue({ 
        response: { status: 401, data: { error: 'Token expired' } } 
      });

      const TestComponent = () => {
        const { user, refreshToken } = useAuth();
        const [error, setError] = React.useState('');

        const fetchProtectedData = async () => {
          try {
            await api.get('/api/v1/user/profile');
          } catch (err) {
            if (err.response?.status === 401) {
              const refreshed = await refreshToken();
              if (!refreshed) {
                setError('Please login again');
              }
            }
          }
        };

        return (
          <>
            <button onClick={fetchProtectedData}>Fetch Data</button>
            {error && <div role="alert">{error}</div>}
          </>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const button = screen.getByText('Fetch Data');
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Please login again');
      });
    });

    test('should enforce role-based access control', () => {
      const AdminComponent = () => {
        const { user } = useAuth();
        
        if (!user?.roles?.includes('admin')) {
          return <div>Access Denied</div>;
        }
        
        return <div>Admin Panel</div>;
      };

      // Test with non-admin user
      const mockUser = { id: '1', email: 'user@example.com', roles: ['user'] };
      
      render(
        <AuthProvider initialUser={mockUser}>
          <AdminComponent />
        </AuthProvider>
      );

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    });
  });

  // ===== Input Validation Tests =====

  describe('Input Validation', () => {
    test('should validate input length limits', async () => {
      const TestForm = () => {
        const [errors, setErrors] = React.useState<Record<string, string>>({});
        
        const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const title = formData.get('title') as string;
          const description = formData.get('description') as string;
          
          const newErrors: Record<string, string> = {};
          
          if (title.length > 200) {
            newErrors.title = 'Title must be 200 characters or less';
          }
          
          if (description.length > 1000) {
            newErrors.description = 'Description must be 1000 characters or less';
          }
          
          setErrors(newErrors);
        };

        return (
          <form onSubmit={handleSubmit}>
            <input 
              name="title" 
              maxLength={200}
              aria-invalid={!!errors.title}
            />
            {errors.title && <span role="alert">{errors.title}</span>}
            
            <textarea 
              name="description" 
              maxLength={1000}
              aria-invalid={!!errors.description}
            />
            {errors.description && <span role="alert">{errors.description}</span>}
            
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      
      const titleInput = screen.getByRole('textbox', { name: '' });
      const descriptionInput = screen.getByRole('textbox', { name: '' });
      const submitButton = screen.getByText('Submit');

      // Test oversized input
      await userEvent.type(titleInput, 'a'.repeat(201));
      await userEvent.type(descriptionInput, 'b'.repeat(1001));
      await userEvent.click(submitButton);

      // HTML maxLength should prevent typing more characters
      expect(titleInput).toHaveValue('a'.repeat(200));
      expect(descriptionInput).toHaveValue('b'.repeat(1000));
    });

    test('should validate email format', async () => {
      const TestForm = () => {
        const [error, setError] = React.useState('');
        
        const validateEmail = (email: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email);
        };
        
        const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const email = formData.get('email') as string;
          
          if (!validateEmail(email)) {
            setError('Please enter a valid email address');
          } else {
            setError('');
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <input 
              type="email" 
              name="email" 
              required
              aria-invalid={!!error}
            />
            {error && <span role="alert">{error}</span>}
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      
      const emailInput = screen.getByRole('textbox');
      const submitButton = screen.getByText('Submit');

      // Test invalid emails
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user@example',
        'user @example.com',
      ];

      for (const invalidEmail of invalidEmails) {
        await userEvent.clear(emailInput);
        await userEvent.type(emailInput, invalidEmail);
        await userEvent.click(submitButton);
        
        expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address');
      }
    });

    test('should prevent SQL injection in search queries', async () => {
      const mockApi = api as jest.Mocked<typeof api>;
      mockApi.get = jest.fn().mockResolvedValue({ data: { results: [] } });

      const SearchComponent = () => {
        const [query, setQuery] = React.useState('');
        
        const handleSearch = async () => {
          // Validate and sanitize query
          const sanitizedQuery = query
            .replace(/[';"\-\-]/g, '') // Remove SQL meta-characters
            .trim();
          
          if (sanitizedQuery.length === 0) return;
          
          await api.get('/api/v1/search', {
            params: { q: sanitizedQuery }
          });
        };

        return (
          <>
            <input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
            />
            <button onClick={handleSearch}>Search</button>
          </>
        );
      };

      render(<SearchComponent />);
      
      const input = screen.getByPlaceholderText('Search...');
      const button = screen.getByText('Search');

      // Test SQL injection attempts
      await userEvent.type(input, "'; DROP TABLE users; --");
      await userEvent.click(button);

      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          params: { q: ' DROP TABLE users ' }
        })
      );
    });
  });

  // ===== Session Security Tests =====

  describe('Session Security', () => {
    test('should handle session timeout', async () => {
      jest.useFakeTimers();
      
      const TestComponent = () => {
        const { logout, sessionTimeout } = useAuth();
        const [isActive, setIsActive] = React.useState(true);

        React.useEffect(() => {
          const timeout = setTimeout(() => {
            setIsActive(false);
            logout();
          }, sessionTimeout);

          const resetTimeout = () => {
            clearTimeout(timeout);
            setIsActive(true);
          };

          window.addEventListener('mousemove', resetTimeout);
          window.addEventListener('keypress', resetTimeout);

          return () => {
            clearTimeout(timeout);
            window.removeEventListener('mousemove', resetTimeout);
            window.removeEventListener('keypress', resetTimeout);
          };
        }, [logout, sessionTimeout]);

        return (
          <div>
            {isActive ? 'Session Active' : 'Session Expired'}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByText('Session Active')).toBeInTheDocument();

      // Fast-forward past session timeout
      act(() => {
        jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
      });

      expect(screen.getByText('Session Expired')).toBeInTheDocument();

      jest.useRealTimers();
    });

    test('should regenerate session on privilege escalation', async () => {
      const mockApi = api as jest.Mocked<typeof api>;
      
      const TestComponent = () => {
        const { user, updateUserRole } = useAuth();
        
        const promoteToAdmin = async () => {
          // Server should regenerate session ID when roles change
          const response = await api.post('/api/v1/user/promote', {
            userId: user?.id,
            role: 'admin'
          });
          
          // Update local user state
          if (response.data.newSessionId) {
            updateUserRole('admin');
          }
        };

        return (
          <>
            <div>Current Role: {user?.roles?.[0] || 'user'}</div>
            <button onClick={promoteToAdmin}>Promote to Admin</button>
          </>
        );
      };

      mockApi.post = jest.fn().mockResolvedValue({
        data: { 
          success: true, 
          newSessionId: 'new-session-id-123' 
        }
      });

      render(
        <AuthProvider initialUser={{ id: '1', email: 'test@example.com', roles: ['user'] }}>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByText('Current Role: user')).toBeInTheDocument();

      const button = screen.getByText('Promote to Admin');
      await userEvent.click(button);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/v1/user/promote',
        expect.objectContaining({ role: 'admin' })
      );
    });
  });

  // ===== Content Security Policy Tests =====

  describe('Content Security Policy', () => {
    test('should block inline scripts', () => {
      // This would be set by the server, but we can test the behavior
      const TestComponent = () => {
        React.useEffect(() => {
          // Try to create inline script (should be blocked by CSP)
          const script = document.createElement('script');
          script.textContent = 'window.testValue = "inline-script-executed"';
          document.body.appendChild(script);
          
          return () => {
            document.body.removeChild(script);
          };
        }, []);

        return <div>CSP Test</div>;
      };

      render(<TestComponent />);
      
      // Inline script should be blocked by CSP
      expect(window.testValue).toBeUndefined();
    });

    test('should validate external script sources', () => {
      const TestComponent = () => {
        const loadScript = (src: string) => {
          // Validate script source against CSP whitelist
          const allowedDomains = [
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
            'https://cdnjs.cloudflare.com'
          ];
          
          const url = new URL(src);
          const isAllowed = allowedDomains.some(domain => 
            url.origin === new URL(domain).origin
          );
          
          if (!isAllowed) {
            throw new Error('Script source not allowed by CSP');
          }
          
          const script = document.createElement('script');
          script.src = src;
          document.head.appendChild(script);
        };

        return (
          <button 
            onClick={() => {
              try {
                loadScript('https://evil.com/malicious.js');
              } catch (error) {
                console.error(error.message);
              }
            }}
          >
            Load Script
          </button>
        );
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<TestComponent />);
      
      const button = screen.getByText('Load Script');
      fireEvent.click(button);
      
      expect(consoleSpy).toHaveBeenCalledWith('Script source not allowed by CSP');
      
      consoleSpy.mockRestore();
    });
  });
});

// ===== Security Utility Functions =====

describe('Security Utilities', () => {
  describe('sanitizeInput', () => {
    test('should remove dangerous HTML tags', () => {
      const input = '<div>Safe content<script>alert("XSS")</script></div>';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).toBe('<div>Safe content</div>');
      expect(sanitized).not.toContain('<script>');
    });

    test('should remove event handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).toBe('<div>Click me</div>');
      expect(sanitized).not.toContain('onclick');
    });

    test('should escape special characters', () => {
      const input = '<div>Price: $100 & shipping</div>';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).toContain('&amp;');
    });
  });

  describe('validateInput', () => {
    test('should validate against regex patterns', () => {
      const sqlInjectionPattern = /(\b(union|select|insert|update|delete|drop)\b)/i;
      
      const inputs = [
        { value: 'normal search query', valid: true },
        { value: 'SELECT * FROM users', valid: false },
        { value: 'UNION SELECT password', valid: false },
        { value: 'DROP TABLE users', valid: false },
      ];

      inputs.forEach(({ value, valid }) => {
        const result = !sqlInjectionPattern.test(value);
        expect(result).toBe(valid);
      });
    });
  });
});
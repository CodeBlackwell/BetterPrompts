import React from 'react'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import LoginPage from '@/app/(auth)/login/page'
import { authService } from '@/lib/api/services'
import { useUserStore } from '@/store/useUserStore'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// Mock dependencies
jest.mock('@/lib/api/services')
jest.mock('@/store/useUserStore')
jest.mock('@/hooks/use-toast')

const mockPush = jest.fn()
const mockToast = jest.fn()
const mockSetUser = jest.fn()
const mockSetToken = jest.fn()

// Mock responses
const mockLoginResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  user: {
    id: '123',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
  },
}

describe('LoginPage', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Mock useRouter
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    
    // Mock useToast
    ;(useToast as jest.Mock).mockReturnValue({
      toast: mockToast,
    })
    
    // Mock useUserStore
    ;(useUserStore as jest.Mock).mockReturnValue({
      setUser: mockSetUser,
      setToken: mockSetToken,
    })
  })

  describe('Rendering', () => {
    it('should render all form elements', () => {
      render(<LoginPage />)

      // Header elements
      expect(screen.getByText('Welcome back')).toBeInTheDocument()
      expect(screen.getByText('Enter your credentials to access your account')).toBeInTheDocument()

      // Form fields
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Remember me')).toBeInTheDocument()

      // Links
      expect(screen.getByText('Forgot password?')).toBeInTheDocument()
      expect(screen.getByText('Sign up')).toBeInTheDocument()

      // Submit button
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    })

    it('should have proper input types and attributes', () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')

      const passwordInput = screen.getByLabelText('Password')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
    })
  })

  describe('Form Interaction', () => {
    it('should update form values when typing', async () => {
      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')

      expect(emailInput).toHaveValue('test@example.com')
      expect(passwordInput).toHaveValue('password123')
    })

    it('should toggle remember me checkbox', async () => {
      const { user } = render(<LoginPage />)

      const rememberMeCheckbox = screen.getByLabelText('Remember me')
      expect(rememberMeCheckbox).not.toBeChecked()

      await user.click(rememberMeCheckbox)
      expect(rememberMeCheckbox).toBeChecked()

      await user.click(rememberMeCheckbox)
      expect(rememberMeCheckbox).not.toBeChecked()
    })

    it('should clear error when user starts typing', async () => {
      ;(authService.login as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Invalid credentials' } },
      })

      const { user } = render(<LoginPage />)

      // Submit form to trigger error
      const submitButton = screen.getByRole('button', { name: 'Sign in' })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
      })

      // Start typing to clear error
      const emailInput = screen.getByLabelText('Email')
      await user.type(emailInput, 'a')

      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('should handle successful login', async () => {
      ;(authService.login as jest.Mock).mockResolvedValue(mockLoginResponse)

      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      // Verify loading state
      expect(await screen.findByText('Signing in...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()

      await waitFor(() => {
        // Verify API call
        expect(authService.login).toHaveBeenCalledWith({
          email_or_username: 'test@example.com',
          password: 'password123',
          remember_me: false,
        })

        // Verify store updates
        expect(mockSetToken).toHaveBeenCalledWith('mock-access-token', 'mock-refresh-token')
        expect(mockSetUser).toHaveBeenCalledWith(mockLoginResponse.user)

        // Verify toast
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Welcome back!',
          description: 'Logged in as test@example.com',
        })

        // Verify redirect
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('should handle login with remember me checked', async () => {
      ;(authService.login as jest.Mock).mockResolvedValue(mockLoginResponse)

      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const rememberMeCheckbox = screen.getByLabelText('Remember me')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(rememberMeCheckbox)
      await user.click(submitButton)

      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({
          email_or_username: 'test@example.com',
          password: 'password123',
          remember_me: true,
        })
      })
    })

    it('should redirect to specified page after login', async () => {
      // Mock URL with redirect parameter
      delete (window as any).location
      window.location = { search: '?from=/dashboard' } as any

      ;(authService.login as jest.Mock).mockResolvedValue(mockLoginResponse)

      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('should handle login error', async () => {
      const errorMessage = 'Invalid email or password'
      ;(authService.login as jest.Mock).mockRejectedValue({
        response: { data: { error: errorMessage } },
      })

      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
        expect(submitButton).not.toBeDisabled()
        expect(mockPush).not.toHaveBeenCalled()
      })
    })

    it('should handle generic error', async () => {
      ;(authService.login as jest.Mock).mockRejectedValue(new Error('Network error'))

      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password. Please try again.')).toBeInTheDocument()
      })
    })

    it('should disable form during submission', async () => {
      ;(authService.login as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockLoginResponse), 100))
      )

      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const rememberMeCheckbox = screen.getByLabelText('Remember me')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      // Check all inputs are disabled during submission
      expect(emailInput).toBeDisabled()
      expect(passwordInput).toBeDisabled()
      expect(rememberMeCheckbox).toBeDisabled()
      expect(submitButton).toBeDisabled()

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate to register page', async () => {
      const { user } = render(<LoginPage />)

      const signUpLink = screen.getByText('Sign up')
      expect(signUpLink).toHaveAttribute('href', '/register')
    })

    it('should navigate to forgot password page', async () => {
      const { user } = render(<LoginPage />)

      const forgotPasswordLink = screen.getByText('Forgot password?')
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password')
    })
  })

  describe('Accessibility', () => {
    it('should have accessible form structure', () => {
      render(<LoginPage />)

      // Check form labels are properly associated
      const emailInput = screen.getByLabelText('Email')
      expect(emailInput).toHaveAttribute('id', 'email')

      const passwordInput = screen.getByLabelText('Password')
      expect(passwordInput).toHaveAttribute('id', 'password')

      const rememberMeCheckbox = screen.getByLabelText('Remember me')
      expect(rememberMeCheckbox).toHaveAttribute('id', 'rememberMe')
    })

    it('should support keyboard navigation', async () => {
      const { user } = render(<LoginPage />)

      // Tab through form elements
      await user.tab()
      expect(screen.getByLabelText('Email')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Password')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Remember me')).toHaveFocus()

      await user.tab()
      expect(screen.getByText('Forgot password?')).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus()
    })

    it('should handle form submission with Enter key', async () => {
      ;(authService.login as jest.Mock).mockResolvedValue(mockLoginResponse)

      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(authService.login).toHaveBeenCalled()
      })
    })
  })

  describe('Visual States', () => {
    it('should show loading spinner during submission', async () => {
      ;(authService.login as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockLoginResponse), 100))
      )

      const { user } = render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      // Check for loading spinner
      const spinner = screen.getByText('Signing in...').previousElementSibling
      expect(spinner).toHaveClass('animate-spin')
    })

    it('should display error alert with icon', async () => {
      ;(authService.login as jest.Mock).mockRejectedValue({
        response: { data: { error: 'Invalid credentials' } },
      })

      const { user } = render(<LoginPage />)

      const submitButton = screen.getByRole('button', { name: 'Sign in' })
      await user.click(submitButton)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
        expect(alert).toHaveClass('destructive')
      })
    })
  })
})
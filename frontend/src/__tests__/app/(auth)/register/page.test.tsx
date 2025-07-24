import React from 'react'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import RegisterPage from '@/app/(auth)/register/page'
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
const mockRegisterResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  user: {
    id: '123',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
  },
}

describe('RegisterPage', () => {
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
      render(<RegisterPage />)

      // Header elements
      expect(screen.getByText('Create an account')).toBeInTheDocument()
      expect(screen.getByText('Enter your details to get started with BetterPrompts')).toBeInTheDocument()

      // Form fields
      expect(screen.getByLabelText('First Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Last Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email *')).toBeInTheDocument()
      expect(screen.getByLabelText('Username *')).toBeInTheDocument()
      expect(screen.getByLabelText('Password *')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm Password *')).toBeInTheDocument()

      // Terms checkbox
      expect(screen.getByText(/I agree to the/)).toBeInTheDocument()
      expect(screen.getByText('Terms of Service')).toBeInTheDocument()
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument()

      // Submit button
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()

      // Sign in link
      expect(screen.getByText('Sign in')).toBeInTheDocument()
    })

    it('should have proper input types and attributes', () => {
      render(<RegisterPage />)

      const emailInput = screen.getByLabelText('Email *')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')

      const passwordInput = screen.getByLabelText('Password *')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('autoComplete', 'new-password')

      const usernameInput = screen.getByLabelText('Username *')
      expect(usernameInput).toHaveAttribute('required')
      expect(usernameInput).toHaveAttribute('autoComplete', 'username')
    })
  })

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      const { user } = render(<RegisterPage />)

      const emailInput = screen.getByLabelText('Email *')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      // Accept terms to enable submit button
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)

      // Invalid email
      await user.type(emailInput, 'invalid-email')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      })

      // Valid email
      await user.clear(emailInput)
      await user.type(emailInput, 'valid@example.com')
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument()
    })

    it('should validate username requirements', async () => {
      const { user } = render(<RegisterPage />)

      const usernameInput = screen.getByLabelText('Username *')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      // Accept terms
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)

      // Too short username
      await user.type(usernameInput, 'ab')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument()
      })

      // Invalid characters
      await user.clear(usernameInput)
      await user.type(usernameInput, 'user@name')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Username can only contain letters and numbers')).toBeInTheDocument()
      })

      // Valid username
      await user.clear(usernameInput)
      await user.type(usernameInput, 'validuser123')
      expect(screen.queryByText(/Username must/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Username can only/)).not.toBeInTheDocument()
    })

    it('should validate password requirements', async () => {
      const { user } = render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('Password *')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      // Accept terms
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)

      // Too short password
      await user.type(passwordInput, 'short')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
      })

      // Missing complexity
      await user.clear(passwordInput)
      await user.type(passwordInput, 'simplepassword')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Password must contain uppercase, lowercase, and numbers')).toBeInTheDocument()
      })

      // Valid password
      await user.clear(passwordInput)
      await user.type(passwordInput, 'ValidPass123')
      expect(screen.queryByText(/Password must/)).not.toBeInTheDocument()
    })

    it('should validate password confirmation', async () => {
      const { user } = render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('Password *')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password *')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      // Accept terms
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)

      await user.type(passwordInput, 'ValidPass123')
      await user.type(confirmPasswordInput, 'DifferentPass123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      })

      // Matching passwords
      await user.clear(confirmPasswordInput)
      await user.type(confirmPasswordInput, 'ValidPass123')
      expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument()
    })

    it('should require terms acceptance', async () => {
      const { user } = render(<RegisterPage />)

      const submitButton = screen.getByRole('button', { name: 'Create account' })
      
      // Button should be disabled without terms acceptance
      expect(submitButton).toBeDisabled()

      // Fill all fields
      await user.type(screen.getByLabelText('Email *'), 'test@example.com')
      await user.type(screen.getByLabelText('Username *'), 'testuser')
      await user.type(screen.getByLabelText('Password *'), 'ValidPass123')
      await user.type(screen.getByLabelText('Confirm Password *'), 'ValidPass123')

      // Still disabled without terms
      expect(submitButton).toBeDisabled()

      // Click without terms should show error
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)
      expect(submitButton).not.toBeDisabled()

      await user.click(termsCheckbox) // Uncheck
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('You must accept the terms and conditions')).toBeInTheDocument()
      })
    })
  })

  describe('Password Features', () => {
    it('should show/hide password', async () => {
      const { user } = render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('Password *')
      const toggleButtons = screen.getAllByRole('button', { name: '' }).filter(
        btn => btn.querySelector('svg')
      )
      const passwordToggle = toggleButtons[0]

      expect(passwordInput).toHaveAttribute('type', 'password')

      await user.click(passwordToggle)
      expect(passwordInput).toHaveAttribute('type', 'text')

      await user.click(passwordToggle)
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('should display password strength indicator', async () => {
      const { user } = render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('Password *')

      // Weak password
      await user.type(passwordInput, 'weak')
      expect(screen.getByText('Password strength: Very Weak')).toBeInTheDocument()

      // Medium password
      await user.clear(passwordInput)
      await user.type(passwordInput, 'Medium123')
      expect(screen.getByText('Password strength: Fair')).toBeInTheDocument()

      // Strong password
      await user.clear(passwordInput)
      await user.type(passwordInput, 'StrongPass123!')
      expect(screen.getByText('Password strength: Strong')).toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('should handle successful registration', async () => {
      ;(authService.register as jest.Mock).mockResolvedValue(mockRegisterResponse)

      const { user } = render(<RegisterPage />)

      // Fill form
      await user.type(screen.getByLabelText('First Name'), 'John')
      await user.type(screen.getByLabelText('Last Name'), 'Doe')
      await user.type(screen.getByLabelText('Email *'), 'test@example.com')
      await user.type(screen.getByLabelText('Username *'), 'testuser')
      await user.type(screen.getByLabelText('Password *'), 'ValidPass123')
      await user.type(screen.getByLabelText('Confirm Password *'), 'ValidPass123')
      await user.click(screen.getByRole('checkbox'))

      const submitButton = screen.getByRole('button', { name: 'Create account' })
      await user.click(submitButton)

      // Verify loading state
      expect(await screen.findByText('Creating account...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()

      await waitFor(() => {
        // Verify API call
        expect(authService.register).toHaveBeenCalledWith({
          email: 'test@example.com',
          username: 'testuser',
          password: 'ValidPass123',
          confirm_password: 'ValidPass123',
          first_name: 'John',
          last_name: 'Doe',
        })

        // Verify store updates
        expect(mockSetToken).toHaveBeenCalledWith('mock-access-token', 'mock-refresh-token')
        expect(mockSetUser).toHaveBeenCalledWith(mockRegisterResponse.user)

        // Verify toast
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Welcome to BetterPrompts!',
          description: 'Your account has been created successfully.',
        })

        // Verify redirect
        expect(mockPush).toHaveBeenCalledWith('/onboarding')
      })
    })

    it('should handle duplicate email error', async () => {
      ;(authService.register as jest.Mock).mockRejectedValue({
        response: { data: { error: 'Email already exists', details: 'email already registered' } },
      })

      const { user } = render(<RegisterPage />)

      // Fill minimum required fields
      await user.type(screen.getByLabelText('Email *'), 'existing@example.com')
      await user.type(screen.getByLabelText('Username *'), 'newuser')
      await user.type(screen.getByLabelText('Password *'), 'ValidPass123')
      await user.type(screen.getByLabelText('Confirm Password *'), 'ValidPass123')
      await user.click(screen.getByRole('checkbox'))

      await user.click(screen.getByRole('button', { name: 'Create account' }))

      await waitFor(() => {
        expect(screen.getByText('This email is already registered')).toBeInTheDocument()
      })
    })

    it('should handle duplicate username error', async () => {
      ;(authService.register as jest.Mock).mockRejectedValue({
        response: { data: { error: 'Username already exists', details: 'username already taken' } },
      })

      const { user } = render(<RegisterPage />)

      // Fill minimum required fields
      await user.type(screen.getByLabelText('Email *'), 'new@example.com')
      await user.type(screen.getByLabelText('Username *'), 'existinguser')
      await user.type(screen.getByLabelText('Password *'), 'ValidPass123')
      await user.type(screen.getByLabelText('Confirm Password *'), 'ValidPass123')
      await user.click(screen.getByRole('checkbox'))

      await user.click(screen.getByRole('button', { name: 'Create account' }))

      await waitFor(() => {
        expect(screen.getByText('This username is already taken')).toBeInTheDocument()
      })
    })

    it('should handle generic registration error', async () => {
      ;(authService.register as jest.Mock).mockRejectedValue(new Error('Network error'))

      const { user } = render(<RegisterPage />)

      // Fill minimum required fields
      await user.type(screen.getByLabelText('Email *'), 'test@example.com')
      await user.type(screen.getByLabelText('Username *'), 'testuser')
      await user.type(screen.getByLabelText('Password *'), 'ValidPass123')
      await user.type(screen.getByLabelText('Confirm Password *'), 'ValidPass123')
      await user.click(screen.getByRole('checkbox'))

      await user.click(screen.getByRole('button', { name: 'Create account' }))

      await waitFor(() => {
        expect(screen.getByText('Registration failed. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate to login page', () => {
      render(<RegisterPage />)

      const signInLink = screen.getByText('Sign in')
      expect(signInLink).toHaveAttribute('href', '/login')
    })

    it('should open terms and privacy links in new tab', () => {
      render(<RegisterPage />)

      const termsLink = screen.getByText('Terms of Service')
      expect(termsLink).toHaveAttribute('href', '/terms')
      expect(termsLink).toHaveAttribute('target', '_blank')

      const privacyLink = screen.getByText('Privacy Policy')
      expect(privacyLink).toHaveAttribute('href', '/privacy')
      expect(privacyLink).toHaveAttribute('target', '_blank')
    })
  })

  describe('Real-time Validation', () => {
    it('should clear errors when user types', async () => {
      const { user } = render(<RegisterPage />)

      const emailInput = screen.getByLabelText('Email *')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      // Accept terms
      await user.click(screen.getByRole('checkbox'))

      // Trigger error
      await user.type(emailInput, 'invalid')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      })

      // Clear error by typing
      await user.type(emailInput, '@example.com')
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument()
    })

    it('should clear terms error when checkbox is checked', async () => {
      const { user } = render(<RegisterPage />)

      const submitButton = screen.getByRole('button', { name: 'Create account' })
      const termsCheckbox = screen.getByRole('checkbox')

      // Fill required fields
      await user.type(screen.getByLabelText('Email *'), 'test@example.com')
      await user.type(screen.getByLabelText('Username *'), 'testuser')
      await user.type(screen.getByLabelText('Password *'), 'ValidPass123')
      await user.type(screen.getByLabelText('Confirm Password *'), 'ValidPass123')

      // Enable button by checking terms, then uncheck
      await user.click(termsCheckbox)
      await user.click(termsCheckbox)

      // Try to submit without terms
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('You must accept the terms and conditions')).toBeInTheDocument()
      })

      // Check terms to clear error
      await user.click(termsCheckbox)
      expect(screen.queryByText('You must accept the terms and conditions')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible form structure', () => {
      render(<RegisterPage />)

      // Check all inputs have proper labels
      const inputs = [
        'First Name',
        'Last Name',
        'Email *',
        'Username *',
        'Password *',
        'Confirm Password *',
      ]

      inputs.forEach(label => {
        const input = screen.getByLabelText(label)
        expect(input).toBeInTheDocument()
      })
    })

    it('should handle form submission with Enter key', async () => {
      ;(authService.register as jest.Mock).mockResolvedValue(mockRegisterResponse)

      const { user } = render(<RegisterPage />)

      // Fill form
      await user.type(screen.getByLabelText('Email *'), 'test@example.com')
      await user.type(screen.getByLabelText('Username *'), 'testuser')
      await user.type(screen.getByLabelText('Password *'), 'ValidPass123')
      await user.type(screen.getByLabelText('Confirm Password *'), 'ValidPass123')
      await user.click(screen.getByRole('checkbox'))

      // Submit with Enter key
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(authService.register).toHaveBeenCalled()
      })
    })
  })
})
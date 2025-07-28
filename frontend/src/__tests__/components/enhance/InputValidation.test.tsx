import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EnhancementFlow from '@/components/enhance/EnhancementFlow'
import AnonymousEnhanceSection from '@/components/home/AnonymousEnhanceSection'
import { vi } from 'vitest'

// Mock the hooks and dependencies
vi.mock('@/hooks/useEnhance', () => ({
  useEnhance: () => ({
    enhance: vi.fn().mockRejectedValue({
      response: {
        status: 400,
        data: {
          details: 'Key: \'EnhanceRequest.Text\' Error:Field validation for \'Text\' failed on the \'max\' tag'
        }
      }
    }),
    isLoading: false,
    error: null
  }),
  useTechniques: () => ({
    fetchTechniques: vi.fn().mockResolvedValue([]),
    isLoading: false,
    error: null
  })
}))

vi.mock('@/hooks/useApiStatus', () => ({
  useApiStatus: () => ({
    isConnected: true,
    isChecking: false
  })
}))

vi.mock('@/store/useEnhanceStore', () => ({
  useEnhanceStore: () => ({
    streaming: { currentStep: null },
    currentOutput: '',
    currentInput: '',
    setCurrentInput: vi.fn(),
    setCurrentOutput: vi.fn(),
    updateStreamingStep: vi.fn(),
    completeStreamingStep: vi.fn(),
    setStreamingError: vi.fn(),
    updateStreamingData: vi.fn(),
    resetStreaming: vi.fn(),
    setIsEnhancing: vi.fn()
  })
}))

describe('Input Validation Tests', () => {
  describe('EnhancementFlow Component', () => {
    it('should show character counter', () => {
      render(<EnhancementFlow />)
      const counter = screen.getByText('0/5000')
      expect(counter).toBeInTheDocument()
    })

    it('should update character counter as user types', async () => {
      const user = userEvent.setup()
      render(<EnhancementFlow />)
      
      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i)
      await user.type(textarea, 'Hello world')
      
      const counter = screen.getByText('11/5000')
      expect(counter).toBeInTheDocument()
    })

    it('should show error when input is empty', async () => {
      const user = userEvent.setup()
      render(<EnhancementFlow />)
      
      const button = screen.getByRole('button', { name: /Enhance Prompt/i })
      await user.click(button)
      
      await waitFor(() => {
        const error = screen.getByText('Please enter a prompt to enhance')
        expect(error).toBeInTheDocument()
      })
    })

    it('should show error when input exceeds max length', async () => {
      const user = userEvent.setup()
      render(<EnhancementFlow />)
      
      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i)
      const longText = 'a'.repeat(5001)
      
      // Simulate paste to bypass maxLength attribute
      fireEvent.change(textarea, { target: { value: longText } })
      
      const button = screen.getByRole('button', { name: /Enhance Prompt/i })
      await user.click(button)
      
      await waitFor(() => {
        const error = screen.getByText('Prompt must be less than 5000 characters')
        expect(error).toBeInTheDocument()
      })
    })

    it('should show red character counter when over limit', async () => {
      render(<EnhancementFlow />)
      
      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i)
      const longText = 'a'.repeat(5001)
      
      fireEvent.change(textarea, { target: { value: longText } })
      
      const counter = screen.getByText('5001/5000')
      expect(counter).toHaveClass('text-red-500')
    })

    it('should disable submit button when validation error exists', async () => {
      render(<EnhancementFlow />)
      
      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i)
      const longText = 'a'.repeat(5001)
      
      fireEvent.change(textarea, { target: { value: longText } })
      
      const button = screen.getByRole('button', { name: /Enhance Prompt/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(button).toBeDisabled()
      })
    })

    it('should clear validation error when user fixes input', async () => {
      const user = userEvent.setup()
      render(<EnhancementFlow />)
      
      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i)
      const button = screen.getByRole('button', { name: /Enhance Prompt/i })
      
      // First trigger error with empty input
      await user.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a prompt to enhance')).toBeInTheDocument()
      })
      
      // Then type valid input
      await user.type(textarea, 'Valid prompt')
      
      await waitFor(() => {
        expect(screen.queryByText('Please enter a prompt to enhance')).not.toBeInTheDocument()
      })
    })
  })

  describe('AnonymousEnhanceSection Component', () => {
    it('should show character counter', () => {
      render(<AnonymousEnhanceSection />)
      const counter = screen.getByTestId('anonymous-character-count')
      expect(counter).toHaveTextContent('0/5000')
    })

    it('should update character counter as user types', async () => {
      const user = userEvent.setup()
      render(<AnonymousEnhanceSection />)
      
      const textarea = screen.getByTestId('anonymous-prompt-input')
      await user.type(textarea, 'Test prompt')
      
      const counter = screen.getByTestId('anonymous-character-count')
      expect(counter).toHaveTextContent('11/5000')
    })

    it('should show validation error for empty input', async () => {
      const user = userEvent.setup()
      render(<AnonymousEnhanceSection />)
      
      const button = screen.getByTestId('anonymous-enhance-button')
      await user.click(button)
      
      await waitFor(() => {
        const error = screen.getByText('Please enter a prompt to enhance')
        expect(error).toBeInTheDocument()
      })
    })

    it('should disable button when validation error exists', async () => {
      render(<AnonymousEnhanceSection />)
      
      const textarea = screen.getByTestId('anonymous-prompt-input')
      const longText = 'a'.repeat(5001)
      
      fireEvent.change(textarea, { target: { value: longText } })
      
      const button = screen.getByTestId('anonymous-enhance-button')
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(button).toBeDisabled()
      })
    })
  })
})
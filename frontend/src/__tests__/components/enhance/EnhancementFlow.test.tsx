import React from 'react'
import { render, screen, waitFor, fireEvent } from '@/__tests__/utils/test-utils'
import EnhancementFlow from '@/components/enhance/EnhancementFlow'
import { useEnhance, useTechniques } from '@/hooks/useEnhance'
import { useApiStatus } from '@/hooks/useApiStatus'
import { useEnhanceStore } from '@/store/useEnhanceStore'
import userEvent from '@testing-library/user-event'

// Mock hooks
jest.mock('@/hooks/useEnhance')
jest.mock('@/hooks/useApiStatus')
jest.mock('@/store/useEnhanceStore')

// Mock data
const mockTechniques = [
  {
    id: 'chain-of-thought',
    name: 'Chain of Thought',
    description: 'Break down complex problems into steps',
    category: 'reasoning',
    use_cases: ['problem solving', 'analysis'],
    examples: [],
    effectiveness: { overall: 0.85, by_category: {} },
  },
  {
    id: 'few-shot',
    name: 'Few-shot Learning',
    description: 'Provide examples to guide the model',
    category: 'learning',
    use_cases: ['pattern matching', 'consistency'],
    examples: [],
    effectiveness: { overall: 0.78, by_category: {} },
  },
]

const mockEnhanceResponse = {
  enhanced: {
    prompt: 'Enhanced prompt text',
    technique: 'chain-of-thought',
    explanation: 'This prompt was enhanced using Chain of Thought',
  },
  history_id: 'hist-123',
  techniques_used: ['chain-of-thought', 'few-shot'],
}

describe('EnhancementFlow', () => {
  let mockEnhance: jest.Mock
  let mockFetchTechniques: jest.Mock
  let mockUpdateStreamingStep: jest.Mock
  let mockResetStreaming: jest.Mock
  let mockSetCurrentInput: jest.Mock
  let mockSetCurrentOutput: jest.Mock
  let mockSetIsEnhancing: jest.Mock

  beforeEach(() => {
    // Reset all mocks
    mockEnhance = jest.fn()
    mockFetchTechniques = jest.fn()
    mockUpdateStreamingStep = jest.fn()
    mockResetStreaming = jest.fn()
    mockSetCurrentInput = jest.fn()
    mockSetCurrentOutput = jest.fn()
    mockSetIsEnhancing = jest.fn()

    // Mock useEnhance hook
    ;(useEnhance as jest.Mock).mockReturnValue({
      enhance: mockEnhance,
      isLoading: false,
      error: null,
    })

    // Mock useTechniques hook
    ;(useTechniques as jest.Mock).mockReturnValue({
      fetchTechniques: mockFetchTechniques.mockResolvedValue(mockTechniques),
      isLoading: false,
      error: null,
    })

    // Mock useApiStatus hook
    ;(useApiStatus as jest.Mock).mockReturnValue({
      isConnected: true,
      isChecking: false,
    })

    // Mock useEnhanceStore
    ;(useEnhanceStore as jest.Mock).mockReturnValue({
      streaming: {
        currentStep: null,
        stepProgress: {},
        completedSteps: [],
        error: null,
        estimatedTimeRemaining: 0,
      },
      setCurrentInput: mockSetCurrentInput,
      setCurrentOutput: mockSetCurrentOutput,
      updateStreamingStep: mockUpdateStreamingStep,
      completeStreamingStep: jest.fn(),
      setStreamingError: jest.fn(),
      updateStreamingData: jest.fn(),
      resetStreaming: mockResetStreaming,
      setIsEnhancing: mockSetIsEnhancing,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the component with all elements', () => {
      render(<EnhancementFlow />)

      expect(screen.getByPlaceholderText(/Enter your prompt here/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Enhance Prompt/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Techniques/i })).toBeInTheDocument()
    })

    it('should load techniques on mount', async () => {
      render(<EnhancementFlow />)

      await waitFor(() => {
        expect(mockFetchTechniques).toHaveBeenCalledTimes(1)
      })
    })

    it('should display connection status banner when offline', () => {
      ;(useApiStatus as jest.Mock).mockReturnValue({
        isConnected: false,
        isChecking: false,
      })

      render(<EnhancementFlow />)

      expect(screen.getByText(/Connection Issue/i)).toBeInTheDocument()
      expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument()
    })
  })

  describe('User Input', () => {
    it('should update input value when typing', async () => {
      const { user } = render(<EnhancementFlow />)
      const input = screen.getByPlaceholderText(/Enter your prompt here/i)

      await user.type(input, 'Help me write a blog post')

      expect(input).toHaveValue('Help me write a blog post')
    })

    it('should disable enhance button when input is empty', () => {
      render(<EnhancementFlow />)
      const enhanceButton = screen.getByRole('button', { name: /Enhance Prompt/i })

      expect(enhanceButton).toBeDisabled()
    })

    it('should enable enhance button when input has content', async () => {
      const { user } = render(<EnhancementFlow />)
      const input = screen.getByPlaceholderText(/Enter your prompt here/i)
      const enhanceButton = screen.getByRole('button', { name: /Enhance Prompt/i })

      await user.type(input, 'Test prompt')

      expect(enhanceButton).not.toBeDisabled()
    })

    it('should handle Ctrl+Enter keyboard shortcut', async () => {
      mockEnhance.mockResolvedValue(mockEnhanceResponse)
      
      const { user } = render(<EnhancementFlow />)
      const input = screen.getByPlaceholderText(/Enter your prompt here/i)

      await user.type(input, 'Test prompt')
      await user.keyboard('{Control>}{Enter}{/Control}')

      await waitFor(() => {
        expect(mockEnhance).toHaveBeenCalledWith({
          input: 'Test prompt',
          technique: undefined,
          options: { explanation: true },
        })
      })
    })
  })

  describe('Technique Selection', () => {
    it('should toggle techniques section when button clicked', async () => {
      const { user } = render(<EnhancementFlow />)
      const techniqueButton = screen.getByRole('button', { name: /Techniques/i })

      expect(screen.queryByText('Chain of Thought')).not.toBeInTheDocument()

      await user.click(techniqueButton)

      await waitFor(() => {
        expect(screen.getByText('Chain of Thought')).toBeInTheDocument()
        expect(screen.getByText('Few-shot Learning')).toBeInTheDocument()
      })
    })

    it('should select a technique when clicked', async () => {
      mockFetchTechniques.mockResolvedValue(mockTechniques)
      
      const { user } = render(<EnhancementFlow />)
      const techniqueButton = screen.getByRole('button', { name: /Techniques/i })

      await user.click(techniqueButton)

      await waitFor(() => {
        expect(screen.getByText('Chain of Thought')).toBeInTheDocument()
      })

      const techniqueCard = screen.getByText('Chain of Thought').closest('div[role="button"]')
      await user.click(techniqueCard!)

      // Verify selection state
      expect(techniqueCard).toHaveAttribute('aria-pressed', 'true')
    })

    it('should handle technique loading error', async () => {
      const errorMessage = 'Failed to load techniques'
      mockFetchTechniques.mockRejectedValue(new Error(errorMessage))
      
      ;(useTechniques as jest.Mock).mockReturnValue({
        fetchTechniques: mockFetchTechniques,
        isLoading: false,
        error: errorMessage,
      })

      const { user } = render(<EnhancementFlow />)
      const techniqueButton = screen.getByRole('button', { name: /Techniques/i })

      await user.click(techniqueButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load techniques/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
      })
    })

    it('should show loading skeletons while techniques are loading', async () => {
      ;(useTechniques as jest.Mock).mockReturnValue({
        fetchTechniques: mockFetchTechniques,
        isLoading: true,
        error: null,
      })

      const { user } = render(<EnhancementFlow />)
      const techniqueButton = screen.getByRole('button', { name: /Techniques/i })

      await user.click(techniqueButton)

      // Check for skeleton loaders
      const skeletons = screen.getAllByTestId('technique-card-skeleton')
      expect(skeletons).toHaveLength(6)
    })
  })

  describe('Enhancement Process', () => {
    it('should handle successful enhancement', async () => {
      mockEnhance.mockResolvedValue(mockEnhanceResponse)
      
      const onComplete = jest.fn()
      const { user } = render(<EnhancementFlow onComplete={onComplete} />)
      
      const input = screen.getByPlaceholderText(/Enter your prompt here/i)
      const enhanceButton = screen.getByRole('button', { name: /Enhance Prompt/i })

      await user.type(input, 'Test prompt')
      await user.click(enhanceButton)

      await waitFor(() => {
        expect(mockSetCurrentInput).toHaveBeenCalledWith('Test prompt')
        expect(mockSetIsEnhancing).toHaveBeenCalledWith(true)
        expect(mockResetStreaming).toHaveBeenCalled()
        expect(mockEnhance).toHaveBeenCalledWith({
          input: 'Test prompt',
          technique: undefined,
          options: { explanation: true },
        })
      })

      await waitFor(() => {
        expect(mockSetCurrentOutput).toHaveBeenCalledWith('Enhanced prompt text')
        expect(onComplete).toHaveBeenCalledWith({
          prompt: 'Enhanced prompt text',
          technique: 'chain-of-thought',
        })
        expect(mockSetIsEnhancing).toHaveBeenCalledWith(false)
      })
    })

    it('should show streaming progress during enhancement', async () => {
      // Mock streaming state
      ;(useEnhanceStore as jest.Mock).mockReturnValue({
        streaming: {
          currentStep: 'analyzing_input',
          stepProgress: { analyzing_input: 50 },
          completedSteps: [],
          error: null,
          estimatedTimeRemaining: 5,
        },
        setCurrentInput: mockSetCurrentInput,
        setCurrentOutput: mockSetCurrentOutput,
        updateStreamingStep: mockUpdateStreamingStep,
        completeStreamingStep: jest.fn(),
        setStreamingError: jest.fn(),
        updateStreamingData: jest.fn(),
        resetStreaming: mockResetStreaming,
        setIsEnhancing: mockSetIsEnhancing,
      })

      render(<EnhancementFlow />)

      expect(screen.getByTestId('streaming-progress')).toBeInTheDocument()
      expect(screen.getByText(/Analyzing input/i)).toBeInTheDocument()
    })

    it('should handle enhancement error', async () => {
      const errorMessage = 'Enhancement failed'
      mockEnhance.mockRejectedValue(new Error(errorMessage))
      
      const { user } = render(<EnhancementFlow />)
      const input = screen.getByPlaceholderText(/Enter your prompt here/i)
      const enhanceButton = screen.getByRole('button', { name: /Enhance Prompt/i })

      await user.type(input, 'Test prompt')
      await user.click(enhanceButton)

      await waitFor(() => {
        expect(mockSetIsEnhancing).toHaveBeenCalledWith(false)
      })
    })

    it('should disable input and buttons during streaming', () => {
      ;(useEnhanceStore as jest.Mock).mockReturnValue({
        streaming: {
          currentStep: 'analyzing_input',
          stepProgress: { analyzing_input: 50 },
          completedSteps: [],
          error: null,
          estimatedTimeRemaining: 5,
        },
        setCurrentInput: mockSetCurrentInput,
        setCurrentOutput: mockSetCurrentOutput,
        updateStreamingStep: mockUpdateStreamingStep,
        completeStreamingStep: jest.fn(),
        setStreamingError: jest.fn(),
        updateStreamingData: jest.fn(),
        resetStreaming: mockResetStreaming,
        setIsEnhancing: mockSetIsEnhancing,
      })

      render(<EnhancementFlow />)

      const input = screen.getByPlaceholderText(/Enter your prompt here/i)
      const enhanceButton = screen.getByRole('button', { name: /Enhance Prompt/i })
      const techniqueButton = screen.getByRole('button', { name: /Techniques/i })

      expect(input).toBeDisabled()
      expect(enhanceButton).toBeDisabled()
      expect(techniqueButton).toBeDisabled()
    })

    it('should handle cancel enhancement', async () => {
      ;(useEnhanceStore as jest.Mock).mockReturnValue({
        streaming: {
          currentStep: 'analyzing_input',
          stepProgress: { analyzing_input: 50 },
          completedSteps: [],
          error: null,
          estimatedTimeRemaining: 5,
        },
        setCurrentInput: mockSetCurrentInput,
        setCurrentOutput: mockSetCurrentOutput,
        updateStreamingStep: mockUpdateStreamingStep,
        completeStreamingStep: jest.fn(),
        setStreamingError: jest.fn(),
        updateStreamingData: jest.fn(),
        resetStreaming: mockResetStreaming,
        setIsEnhancing: mockSetIsEnhancing,
      })

      const { user } = render(<EnhancementFlow />)
      const cancelButton = screen.getByRole('button', { name: /Cancel enhancement/i })

      await user.click(cancelButton)

      expect(mockResetStreaming).toHaveBeenCalled()
      expect(mockSetIsEnhancing).toHaveBeenCalledWith(false)
    })
  })

  describe('Success State', () => {
    it('should show success message after enhancement', async () => {
      ;(useEnhanceStore as jest.Mock).mockReturnValue({
        streaming: {
          currentStep: 'complete',
          stepProgress: {},
          completedSteps: ['analyzing_input', 'classifying_intent', 'selecting_techniques', 'generating_prompt'],
          error: null,
          estimatedTimeRemaining: 0,
        },
        setCurrentInput: mockSetCurrentInput,
        setCurrentOutput: mockSetCurrentOutput,
        updateStreamingStep: mockUpdateStreamingStep,
        completeStreamingStep: jest.fn(),
        setStreamingError: jest.fn(),
        updateStreamingData: jest.fn(),
        resetStreaming: mockResetStreaming,
        setIsEnhancing: mockSetIsEnhancing,
      })

      render(<EnhancementFlow />)

      expect(screen.getByText(/Enhancement Complete!/i)).toBeInTheDocument()
      expect(screen.getByText(/Your prompt has been successfully enhanced/i)).toBeInTheDocument()
    })

    it('should show feedback buttons after successful enhancement', async () => {
      mockEnhance.mockResolvedValue(mockEnhanceResponse)
      
      const { user } = render(<EnhancementFlow />)
      const input = screen.getByPlaceholderText(/Enter your prompt here/i)
      const enhanceButton = screen.getByRole('button', { name: /Enhance Prompt/i })

      await user.type(input, 'Test prompt')
      await user.click(enhanceButton)

      // Wait for enhancement to complete
      await waitFor(() => {
        expect(mockSetCurrentOutput).toHaveBeenCalled()
      })

      // Update store to show complete state
      ;(useEnhanceStore as jest.Mock).mockReturnValue({
        streaming: {
          currentStep: 'complete',
          stepProgress: {},
          completedSteps: ['analyzing_input', 'classifying_intent', 'selecting_techniques', 'generating_prompt'],
          error: null,
          estimatedTimeRemaining: 0,
        },
        setCurrentInput: mockSetCurrentInput,
        setCurrentOutput: mockSetCurrentOutput,
        updateStreamingStep: mockUpdateStreamingStep,
        completeStreamingStep: jest.fn(),
        setStreamingError: jest.fn(),
        updateStreamingData: jest.fn(),
        resetStreaming: mockResetStreaming,
        setIsEnhancing: mockSetIsEnhancing,
      })

      // Re-render with updated state
      const { rerender } = render(<EnhancementFlow />)
      rerender(<EnhancementFlow />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-feedback')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Provide detailed feedback/i })).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<EnhancementFlow />)

      const input = screen.getByPlaceholderText(/Enter your prompt here/i)
      expect(input).toHaveAttribute('aria-label', 'Prompt input')
      expect(input).toHaveAttribute('aria-describedby', 'prompt-helper')

      const techniqueButton = screen.getByRole('button', { name: /Techniques/i })
      expect(techniqueButton).toHaveAttribute('aria-expanded', 'false')
      expect(techniqueButton).toHaveAttribute('aria-controls', 'techniques-section')
    })

    it('should announce selected technique to screen readers', async () => {
      mockFetchTechniques.mockResolvedValue(mockTechniques)
      
      const { user } = render(<EnhancementFlow />)
      const techniqueButton = screen.getByRole('button', { name: /Techniques/i })

      await user.click(techniqueButton)

      await waitFor(() => {
        expect(screen.getByText('Chain of Thought')).toBeInTheDocument()
      })

      const techniqueCard = screen.getByText('Chain of Thought').closest('div[role="button"]')
      await user.click(techniqueCard!)

      // Check for live region announcement
      await waitFor(() => {
        const liveRegion = screen.getByRole('status')
        expect(liveRegion).toHaveTextContent('Selected technique: Chain of Thought')
      })
    })

    it('should have keyboard navigation support', async () => {
      const { user } = render(<EnhancementFlow />)
      const input = screen.getByPlaceholderText(/Enter your prompt here/i)

      await user.type(input, 'Test')
      await user.tab()

      const enhanceButton = screen.getByRole('button', { name: /Enhance Prompt/i })
      expect(enhanceButton).toHaveFocus()

      await user.tab()
      const techniqueButton = screen.getByRole('button', { name: /Techniques/i })
      expect(techniqueButton).toHaveFocus()
    })
  })

  describe('Network Status', () => {
    it('should disable enhance button when offline', () => {
      ;(useApiStatus as jest.Mock).mockReturnValue({
        isConnected: false,
        isChecking: false,
      })

      render(<EnhancementFlow />)

      const enhanceButton = screen.getByRole('button', { name: /Offline/i })
      expect(enhanceButton).toBeDisabled()
      expect(enhanceButton).toHaveTextContent('Offline')
    })

    it('should not trigger enhancement when offline', async () => {
      ;(useApiStatus as jest.Mock).mockReturnValue({
        isConnected: false,
        isChecking: false,
      })

      const { user } = render(<EnhancementFlow />)
      const input = screen.getByPlaceholderText(/Enter your prompt here/i)
      const enhanceButton = screen.getByRole('button', { name: /Offline/i })

      await user.type(input, 'Test prompt')
      await user.click(enhanceButton)

      expect(mockEnhance).not.toHaveBeenCalled()
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should render mobile-optimized layout', () => {
      // Mock mobile viewport
      global.innerWidth = 375
      global.innerHeight = 667

      render(<EnhancementFlow />)

      // Check for mobile-specific classes
      const textarea = screen.getByPlaceholderText(/Enter your prompt here/i)
      expect(textarea).toHaveClass('min-h-[120px]', 'sm:min-h-[150px]')

      const container = screen.getByRole('button', { name: /Enhance Prompt/i }).parentElement
      expect(container).toHaveClass('flex-col', 'sm:flex-row')
    })
  })
})
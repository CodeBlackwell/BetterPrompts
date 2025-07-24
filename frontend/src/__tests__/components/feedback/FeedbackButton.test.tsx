import React from 'react'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { FeedbackButton, QuickFeedback } from '@/components/feedback/FeedbackButton'
import { submitFeedback } from '@/lib/api/feedback'
import { toast } from '@/components/ui/use-toast'

// Mock dependencies
jest.mock('@/lib/api/feedback')
jest.mock('@/components/ui/use-toast')
jest.mock('@/components/feedback/FeedbackDialog', () => ({
  FeedbackDialog: ({ isOpen, onClose, onSubmit }: any) => 
    isOpen ? (
      <div data-testid="feedback-dialog">
        <button onClick={() => {
          onSubmit({
            prompt_history_id: 'test-id',
            rating: 5,
            feedback_type: 'rating',
            comment: 'Great!',
          })
          onClose()
        }}>
          Submit Feedback
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
  FeedbackData: {},
}))

const mockToast = toast as jest.MockedFunction<typeof toast>

describe('FeedbackButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render with default props', () => {
      render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought', 'few-shot']}
        />
      )

      const button = screen.getByRole('button', { name: /Give Feedback/i })
      expect(button).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })

    it('should render with custom variant and size', () => {
      render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought']}
          variant="ghost"
          size="sm"
        />
      )

      const button = screen.getByRole('button', { name: /Give Feedback/i })
      expect(button).toBeInTheDocument()
    })

    it('should show submitted state after feedback submission', async () => {
      ;(submitFeedback as jest.Mock).mockResolvedValue({ success: true })

      const { user } = render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought']}
        />
      )

      // Open dialog
      const button = screen.getByRole('button', { name: /Give Feedback/i })
      await user.click(button)

      // Submit feedback
      const submitButton = screen.getByText('Submit Feedback')
      await user.click(submitButton)

      await waitFor(() => {
        const updatedButton = screen.getByRole('button', { name: /Feedback Submitted/i })
        expect(updatedButton).toBeDisabled()
        expect(updatedButton).toHaveTextContent('Feedback Submitted')
      })
    })
  })

  describe('Dialog Interaction', () => {
    it('should open dialog when clicked', async () => {
      const { user } = render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought']}
        />
      )

      const button = screen.getByRole('button', { name: /Give Feedback/i })
      await user.click(button)

      expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument()
    })

    it('should close dialog when close button is clicked', async () => {
      const { user } = render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought']}
        />
      )

      // Open dialog
      const button = screen.getByRole('button', { name: /Give Feedback/i })
      await user.click(button)

      expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument()

      // Close dialog
      const closeButton = screen.getByText('Close')
      await user.click(closeButton)

      expect(screen.queryByTestId('feedback-dialog')).not.toBeInTheDocument()
    })
  })

  describe('Feedback Submission', () => {
    it('should handle successful feedback submission', async () => {
      ;(submitFeedback as jest.Mock).mockResolvedValue({ success: true })

      const { user } = render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought']}
        />
      )

      // Open dialog
      const button = screen.getByRole('button', { name: /Give Feedback/i })
      await user.click(button)

      // Submit feedback
      const submitButton = screen.getByText('Submit Feedback')
      await user.click(submitButton)

      await waitFor(() => {
        expect(submitFeedback).toHaveBeenCalledWith({
          prompt_history_id: 'test-id',
          rating: 5,
          feedback_type: 'rating',
          comment: 'Great!',
        })

        expect(mockToast).toHaveBeenCalledWith({
          title: "Thank you for your feedback!",
          description: "Your feedback helps us improve our service.",
        })
      })
    })

    it('should handle feedback submission error', async () => {
      const error = new Error('Network error')
      ;(submitFeedback as jest.Mock).mockRejectedValue(error)

      const { user } = render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought']}
        />
      )

      // Open dialog
      const button = screen.getByRole('button', { name: /Give Feedback/i })
      await user.click(button)

      // Submit feedback
      const submitButton = screen.getByText('Submit Feedback')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to submit feedback. Please try again.",
          variant: "destructive",
        })

        // Button should not be disabled after error
        const feedbackButton = screen.getByRole('button', { name: /Give Feedback/i })
        expect(feedbackButton).not.toBeDisabled()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper button text for screen readers', () => {
      render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought']}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Give Feedback')
    })

    it('should indicate disabled state properly', async () => {
      ;(submitFeedback as jest.Mock).mockResolvedValue({ success: true })

      const { user } = render(
        <FeedbackButton
          promptHistoryId="test-id"
          techniques={['chain-of-thought']}
        />
      )

      // Submit feedback
      const button = screen.getByRole('button', { name: /Give Feedback/i })
      await user.click(button)

      const submitButton = screen.getByText('Submit Feedback')
      await user.click(submitButton)

      await waitFor(() => {
        const disabledButton = screen.getByRole('button', { name: /Feedback Submitted/i })
        expect(disabledButton).toBeDisabled()
        expect(disabledButton).toHaveAttribute('disabled')
      })
    })
  })
})

describe('QuickFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render star rating buttons', () => {
      render(<QuickFeedback promptHistoryId="test-id" />)

      expect(screen.getByText('Rate:')).toBeInTheDocument()
      
      // Should have 5 star buttons
      const starButtons = screen.getAllByRole('button')
      expect(starButtons).toHaveLength(5)

      // Check aria-labels
      starButtons.forEach((button, index) => {
        expect(button).toHaveAttribute('aria-label', `Rate ${index + 1} out of 5 stars`)
      })
    })

    it('should show unrated stars initially', () => {
      render(<QuickFeedback promptHistoryId="test-id" />)

      const starButtons = screen.getAllByRole('button')
      starButtons.forEach(button => {
        const star = button.querySelector('svg')
        expect(star).toHaveClass('text-gray-300')
        expect(star).not.toHaveClass('fill-yellow-400')
      })
    })
  })

  describe('Interaction', () => {
    it('should highlight stars on hover', async () => {
      const { user } = render(<QuickFeedback promptHistoryId="test-id" />)

      const starButtons = screen.getAllByRole('button')
      
      // Hover over 3rd star
      await user.hover(starButtons[2])

      // First 3 stars should be highlighted
      for (let i = 0; i < 3; i++) {
        const star = starButtons[i].querySelector('svg')
        expect(star).toHaveClass('fill-yellow-400', 'text-yellow-400')
      }

      // Last 2 stars should not be highlighted
      for (let i = 3; i < 5; i++) {
        const star = starButtons[i].querySelector('svg')
        expect(star).toHaveClass('text-gray-300')
      }

      // Unhover should reset
      await user.unhover(starButtons[2])

      starButtons.forEach(button => {
        const star = button.querySelector('svg')
        expect(star).toHaveClass('text-gray-300')
      })
    })

    it('should submit rating when star is clicked', async () => {
      ;(submitFeedback as jest.Mock).mockResolvedValue({ success: true })

      const onSubmit = jest.fn()
      const { user } = render(
        <QuickFeedback 
          promptHistoryId="test-id" 
          onSubmit={onSubmit}
        />
      )

      const starButtons = screen.getAllByRole('button')
      
      // Click 4th star
      await user.click(starButtons[3])

      await waitFor(() => {
        expect(submitFeedback).toHaveBeenCalledWith({
          prompt_history_id: 'test-id',
          rating: 4,
          feedback_type: 'rating',
        })

        expect(onSubmit).toHaveBeenCalledWith(4)

        expect(mockToast).toHaveBeenCalledWith({
          title: "Thanks for rating!",
          description: "You rated this 4 out of 5 stars.",
        })
      })
    })

    it('should show submitted state after rating', async () => {
      ;(submitFeedback as jest.Mock).mockResolvedValue({ success: true })

      const { user } = render(<QuickFeedback promptHistoryId="test-id" />)

      const starButtons = screen.getAllByRole('button')
      await user.click(starButtons[4]) // Click 5th star

      await waitFor(() => {
        expect(screen.getByText('Rated 5/5')).toBeInTheDocument()
        expect(screen.queryByText('Rate:')).not.toBeInTheDocument()
        expect(screen.queryAllByRole('button')).toHaveLength(0)
      })
    })

    it('should handle rating submission error', async () => {
      ;(submitFeedback as jest.Mock).mockRejectedValue(new Error('Network error'))
      
      // Mock console.error to avoid error output in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const { user } = render(<QuickFeedback promptHistoryId="test-id" />)

      const starButtons = screen.getAllByRole('button')
      await user.click(starButtons[2]) // Click 3rd star

      await waitFor(() => {
        // Should still show rating buttons after error
        expect(screen.getByText('Rate:')).toBeInTheDocument()
        expect(screen.getAllByRole('button')).toHaveLength(5)
        
        // Stars should be reset
        starButtons.forEach(button => {
          const star = button.querySelector('svg')
          expect(star).toHaveClass('text-gray-300')
        })
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria-labels for star buttons', () => {
      render(<QuickFeedback promptHistoryId="test-id" />)

      const starButtons = screen.getAllByRole('button')
      expect(starButtons[0]).toHaveAttribute('aria-label', 'Rate 1 out of 5 stars')
      expect(starButtons[1]).toHaveAttribute('aria-label', 'Rate 2 out of 5 stars')
      expect(starButtons[2]).toHaveAttribute('aria-label', 'Rate 3 out of 5 stars')
      expect(starButtons[3]).toHaveAttribute('aria-label', 'Rate 4 out of 5 stars')
      expect(starButtons[4]).toHaveAttribute('aria-label', 'Rate 5 out of 5 stars')
    })

    it('should support keyboard navigation', async () => {
      ;(submitFeedback as jest.Mock).mockResolvedValue({ success: true })

      const { user } = render(<QuickFeedback promptHistoryId="test-id" />)

      // Tab to first star
      await user.tab()
      const firstStar = screen.getByRole('button', { name: 'Rate 1 out of 5 stars' })
      expect(firstStar).toHaveFocus()

      // Tab through all stars
      for (let i = 2; i <= 5; i++) {
        await user.tab()
        const star = screen.getByRole('button', { name: `Rate ${i} out of 5 stars` })
        expect(star).toHaveFocus()
      }

      // Press Enter on focused star
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(submitFeedback).toHaveBeenCalledWith({
          prompt_history_id: 'test-id',
          rating: 5,
          feedback_type: 'rating',
        })
      })
    })
  })

  describe('Visual States', () => {
    it('should apply hover scale effect', () => {
      render(<QuickFeedback promptHistoryId="test-id" />)

      const starButtons = screen.getAllByRole('button')
      starButtons.forEach(button => {
        expect(button).toHaveClass('transform', 'hover:scale-110')
      })
    })

    it('should have smooth transitions', () => {
      render(<QuickFeedback promptHistoryId="test-id" />)

      const starButtons = screen.getAllByRole('button')
      starButtons.forEach(button => {
        expect(button).toHaveClass('transition-all', 'duration-200')
        
        const star = button.querySelector('svg')
        expect(star).toHaveClass('transition-colors', 'duration-200')
      })
    })
  })
})
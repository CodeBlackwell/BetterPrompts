import React from 'react'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import TechniqueCard from '@/components/enhance/TechniqueCard'
import userEvent from '@testing-library/user-event'

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

const mockTechnique = {
  id: 'chain-of-thought',
  name: 'Chain of Thought',
  description: 'Break down complex problems into step-by-step reasoning',
  confidence: 0.85,
}

describe('TechniqueCard', () => {
  describe('Rendering', () => {
    it('should render technique information', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      expect(screen.getByText('Chain of Thought')).toBeInTheDocument()
      expect(screen.getByText('Break down complex problems into step-by-step reasoning')).toBeInTheDocument()
      expect(screen.getByText('Confidence:')).toBeInTheDocument()
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('should show selection indicator when selected', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={true}
          onClick={onClick}
        />
      )

      // Check for selection styles
      const button = screen.getByRole('button')
      expect(button).toHaveClass('border-blue-500', 'bg-blue-50')
      expect(button).toHaveAttribute('aria-pressed', 'true')

      // Check for check icon (selection indicator)
      const checkIcon = button.querySelector('svg')
      expect(checkIcon).toBeInTheDocument()
    })

    it('should show unselected styles when not selected', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('border-gray-200', 'bg-white')
      expect(button).toHaveAttribute('aria-pressed', 'false')

      // No check icon should be present
      const checkIcon = button.querySelector('.absolute.-right-2.-top-2')
      expect(checkIcon).not.toBeInTheDocument()
    })
  })

  describe('Confidence Indicator', () => {
    it('should display correct confidence percentage', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('should show green color for high confidence (>80%)', () => {
      const onClick = jest.fn()
      const highConfidenceTechnique = { ...mockTechnique, confidence: 0.85 }
      
      render(
        <TechniqueCard
          technique={highConfidenceTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      const fillBar = progressBar.querySelector('.bg-green-500')
      expect(fillBar).toBeInTheDocument()
    })

    it('should show yellow color for medium confidence (60-80%)', () => {
      const onClick = jest.fn()
      const mediumConfidenceTechnique = { ...mockTechnique, confidence: 0.7 }
      
      render(
        <TechniqueCard
          technique={mediumConfidenceTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      const fillBar = progressBar.querySelector('.bg-yellow-500')
      expect(fillBar).toBeInTheDocument()
    })

    it('should show red color for low confidence (<60%)', () => {
      const onClick = jest.fn()
      const lowConfidenceTechnique = { ...mockTechnique, confidence: 0.4 }
      
      render(
        <TechniqueCard
          technique={lowConfidenceTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      const fillBar = progressBar.querySelector('.bg-red-500')
      expect(fillBar).toBeInTheDocument()
    })

    it('should have proper ARIA attributes on progress bar', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      expect(progressBar).toHaveAttribute('aria-valuenow', '85')
    })
  })

  describe('Interaction', () => {
    it('should call onClick when clicked', async () => {
      const onClick = jest.fn()
      const { user } = render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const button = screen.getByRole('button')
      await user.click(button)

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('should be keyboard accessible', async () => {
      const onClick = jest.fn()
      const { user } = render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(onClick).toHaveBeenCalledTimes(1)

      await user.keyboard(' ')
      expect(onClick).toHaveBeenCalledTimes(2)
    })

    it('should show tooltip on hover', async () => {
      const onClick = jest.fn()
      const { user } = render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const button = screen.getByRole('button')
      await user.hover(button)

      // Tooltip content should appear
      await waitFor(() => {
        expect(screen.getByText('Click to select this technique for your prompt enhancement')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have comprehensive aria-label', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute(
        'aria-label',
        'Chain of Thought technique. Break down complex problems into step-by-step reasoning. Confidence: 85%'
      )
    })

    it('should indicate selection state with aria-pressed', () => {
      const onClick = jest.fn()
      const { rerender } = render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-pressed', 'false')

      rerender(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={true}
          onClick={onClick}
        />
      )

      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    it('should have visually hidden confidence level description', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      // The VisuallyHidden component should contain confidence level text
      expect(screen.getByText('High confidence')).toBeInTheDocument()
    })

    it('should support focus visible styles', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-2')
    })
  })

  describe('Responsive Design', () => {
    it('should have responsive padding classes', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('p-3', 'sm:p-4')
    })

    it('should have responsive text sizes', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const title = screen.getByText('Chain of Thought')
      expect(title).toHaveClass('text-sm', 'sm:text-base')

      const description = screen.getByText(mockTechnique.description)
      expect(description).toHaveClass('text-xs', 'sm:text-sm')
    })

    it('should hide info icon on larger screens', () => {
      const onClick = jest.fn()
      render(
        <TechniqueCard
          technique={mockTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      // Find the info icon by its classes
      const infoIcon = document.querySelector('.sm\\:hidden')
      expect(infoIcon).toBeInTheDocument()
      expect(infoIcon).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long technique names', () => {
      const onClick = jest.fn()
      const longNameTechnique = {
        ...mockTechnique,
        name: 'Very Long Technique Name That Should Be Handled Gracefully',
      }

      render(
        <TechniqueCard
          technique={longNameTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      expect(screen.getByText(longNameTechnique.name)).toBeInTheDocument()
    })

    it('should truncate very long descriptions', () => {
      const onClick = jest.fn()
      const longDescTechnique = {
        ...mockTechnique,
        description: 'This is a very long description that should be truncated with ellipsis to prevent the card from becoming too tall and maintaining a consistent layout across all technique cards in the grid',
      }

      render(
        <TechniqueCard
          technique={longDescTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      const description = screen.getByText(longDescTechnique.description)
      expect(description).toHaveClass('line-clamp-2')
    })

    it('should handle confidence value of 0', () => {
      const onClick = jest.fn()
      const zeroConfidenceTechnique = { ...mockTechnique, confidence: 0 }
      
      render(
        <TechniqueCard
          technique={zeroConfidenceTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      expect(screen.getByText('0%')).toBeInTheDocument()
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
    })

    it('should handle confidence value of 1', () => {
      const onClick = jest.fn()
      const fullConfidenceTechnique = { ...mockTechnique, confidence: 1 }
      
      render(
        <TechniqueCard
          technique={fullConfidenceTechnique}
          isSelected={false}
          onClick={onClick}
        />
      )

      expect(screen.getByText('100%')).toBeInTheDocument()
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '100')
    })
  })
})
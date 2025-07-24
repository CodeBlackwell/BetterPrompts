import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EnhancedPromptOutput from '@/components/enhance/EnhancedPromptOutput'

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
})

describe('EnhancedPromptOutput', () => {
  const mockEnhancedPrompt = 'This is an enhanced prompt with improved clarity and structure.'
  const mockOriginalPrompt = 'This is the original prompt'
  const mockTechnique = 'chain_of_thought'
  const mockOnRegenerate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined)
  })

  it('renders enhanced prompt correctly', () => {
    render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
      />
    )

    expect(screen.getByText('Enhanced Prompt')).toBeInTheDocument()
    expect(screen.getByText('Your optimized prompt is ready to use')).toBeInTheDocument()
    expect(screen.getByText(mockEnhancedPrompt)).toBeInTheDocument()
  })

  it('displays technique badge when provided', () => {
    render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        techniqueUsed={mockTechnique}
      />
    )

    expect(screen.getByText('chain of thought')).toBeInTheDocument()
  })

  it('shows improvement percentage when original prompt provided', () => {
    render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        originalPrompt={mockOriginalPrompt}
      />
    )

    // Calculate expected improvement
    const improvement = Math.round(
      ((mockEnhancedPrompt.length - mockOriginalPrompt.length) / mockOriginalPrompt.length) * 100
    )
    expect(screen.getByText(`+${improvement}% enhanced`)).toBeInTheDocument()
  })

  it('handles copy functionality', async () => {
    const user = userEvent.setup()
    render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
      />
    )

    const copyButtons = screen.getAllByRole('button', { name: /copy/i })
    await user.click(copyButtons[0])

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockEnhancedPrompt)
    expect(await screen.findByText(/copied/i)).toBeInTheDocument()

    // Wait for "Copied" to change back to "Copy"
    await waitFor(() => {
      expect(screen.queryByText(/copied!/i)).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles copy error gracefully', async () => {
    const user = userEvent.setup()
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Copy failed'))

    render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
      />
    )

    const copyButtons = screen.getAllByRole('button', { name: /copy/i })
    await user.click(copyButtons[0])

    expect(consoleError).toHaveBeenCalledWith('Failed to copy:', expect.any(Error))
    consoleError.mockRestore()
  })

  it('toggles original prompt comparison', async () => {
    const user = userEvent.setup()
    render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        originalPrompt={mockOriginalPrompt}
        showComparison={true}
      />
    )

    // Original prompt should be hidden initially
    expect(screen.queryByText(mockOriginalPrompt)).not.toBeInTheDocument()

    // Click to show original
    const toggleButton = screen.getByRole('button', { name: /show original prompt/i })
    await user.click(toggleButton)

    expect(screen.getByText('Original:')).toBeInTheDocument()
    expect(screen.getByText(mockOriginalPrompt)).toBeInTheDocument()

    // Click to hide original
    await user.click(screen.getByRole('button', { name: /hide original prompt/i }))
    expect(screen.queryByText(mockOriginalPrompt)).not.toBeInTheDocument()
  })

  it('calls onRegenerate when clicking regenerate button', async () => {
    const user = userEvent.setup()
    render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        onRegenerate={mockOnRegenerate}
      />
    )

    const regenerateButton = screen.getByRole('button', { name: /try another technique/i })
    await user.click(regenerateButton)

    expect(mockOnRegenerate).toHaveBeenCalledTimes(1)
  })

  it('displays appropriate pro tip based on technique', () => {
    const { rerender } = render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        techniqueUsed="chain_of_thought"
      />
    )

    expect(screen.getByText(/step-by-step reasoning/i)).toBeInTheDocument()

    rerender(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        techniqueUsed="few_shot"
      />
    )

    expect(screen.getByText(/examples to guide the AI/i)).toBeInTheDocument()

    rerender(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        techniqueUsed="tree_of_thoughts"
      />
    )

    expect(screen.getByText(/multiple perspectives/i)).toBeInTheDocument()

    rerender(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        techniqueUsed="role_based"
      />
    )

    expect(screen.getByText(/role-based context/i)).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    const { container } = render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
        className="custom-class"
      />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('custom-class')
  })

  it('renders without original prompt or technique', () => {
    render(
      <EnhancedPromptOutput
        enhancedPrompt={mockEnhancedPrompt}
      />
    )

    // Should still render the enhanced prompt
    expect(screen.getByText(mockEnhancedPrompt)).toBeInTheDocument()
    
    // Should not show comparison toggle
    expect(screen.queryByRole('button', { name: /show original prompt/i })).not.toBeInTheDocument()
    
    // Should show generic pro tip
    expect(screen.getByText(/optimizations/i)).toBeInTheDocument()
  })
})
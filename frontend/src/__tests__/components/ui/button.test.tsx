import React from 'react'
import { render, screen } from '@/__tests__/utils/test-utils'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  describe('Rendering', () => {
    it('should render button with text', () => {
      render(<Button>Click me</Button>)
      
      const button = screen.getByRole('button', { name: 'Click me' })
      expect(button).toBeInTheDocument()
    })

    it('should render with default variant and size', () => {
      render(<Button>Default Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground', 'h-10', 'px-4')
    })

    it('should forward ref properly', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Button ref={ref}>Button with ref</Button>)
      
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
  })

  describe('Variants', () => {
    it('should render default variant', () => {
      render(<Button variant="default">Default</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground', 'hover:bg-primary/90')
    })

    it('should render destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')
    })

    it('should render outline variant', () => {
      render(<Button variant="outline">Outline</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('border', 'border-input', 'bg-background')
    })

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80')
    })

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('hover:bg-accent', 'hover:text-accent-foreground')
    })

    it('should render link variant', () => {
      render(<Button variant="link">Link</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-primary', 'underline-offset-4', 'hover:underline')
    })
  })

  describe('Sizes', () => {
    it('should render default size', () => {
      render(<Button size="default">Default Size</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-10', 'px-4', 'py-2')
    })

    it('should render small size', () => {
      render(<Button size="sm">Small</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-9', 'px-3')
    })

    it('should render large size', () => {
      render(<Button size="lg">Large</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-11', 'px-8')
    })

    it('should render icon size', () => {
      render(<Button size="icon" aria-label="Settings">⚙️</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-10', 'w-10')
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      render(<Button loading>Loading</Button>)
      
      const button = screen.getByRole('button')
      const spinner = button.querySelector('.animate-spin')
      
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('border-current', 'border-t-transparent')
      expect(button).toHaveTextContent('Loading')
    })

    it('should be disabled when loading', () => {
      render(<Button loading>Submit</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
    })

    it('should not show spinner when not loading', () => {
      render(<Button loading={false}>Submit</Button>)
      
      const button = screen.getByRole('button')
      const spinner = button.querySelector('.animate-spin')
      
      expect(spinner).not.toBeInTheDocument()
      expect(button).not.toHaveAttribute('aria-busy')
    })
  })

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50')
    })

    it('should be disabled when both loading and disabled', () => {
      render(<Button loading disabled>Both</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Props', () => {
    it('should accept custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
      // Should still have base classes
      expect(button).toHaveClass('inline-flex', 'items-center')
    })

    it('should pass through HTML button attributes', () => {
      const onClick = jest.fn()
      render(
        <Button
          id="test-button"
          type="submit"
          onClick={onClick}
          aria-label="Submit form"
        >
          Submit
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('id', 'test-button')
      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toHaveAttribute('aria-label', 'Submit form')
    })

    it('should handle onClick when not disabled', async () => {
      const onClick = jest.fn()
      const { user } = render(<Button onClick={onClick}>Click</Button>)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('should not trigger onClick when disabled', async () => {
      const onClick = jest.fn()
      const { user } = render(<Button disabled onClick={onClick}>Click</Button>)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('asChild prop', () => {
    it('should render as child component when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      
      const link = screen.getByRole('link', { name: 'Link Button' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/test')
      // Should have button classes
      expect(link).toHaveClass('bg-primary', 'text-primary-foreground')
    })

    it('should render as button when asChild is false', () => {
      render(
        <Button asChild={false}>
          <span>Button Content</span>
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Button Content')
    })
  })

  describe('Styling', () => {
    it('should have focus-visible styles', () => {
      render(<Button>Focus Test</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
        'focus-visible:ring-offset-2'
      )
    })

    it('should have transition classes', () => {
      render(<Button>Transition Test</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('transition-all')
    })

    it('should have active scale effect', () => {
      render(<Button>Active Test</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('active:scale-[0.98]')
    })

    it('should have proper spacing and alignment', () => {
      render(<Button>Spacing Test</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass(
        'inline-flex',
        'items-center',
        'justify-center',
        'whitespace-nowrap'
      )
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const onClick = jest.fn()
      const { user } = render(<Button onClick={onClick}>Keyboard Test</Button>)
      
      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(onClick).toHaveBeenCalledTimes(1)
      
      await user.keyboard(' ')
      expect(onClick).toHaveBeenCalledTimes(2)
    })

    it('should announce loading state to screen readers', () => {
      render(<Button loading>Processing</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-busy', 'true')
    })

    it('should support aria attributes', () => {
      render(
        <Button
          aria-pressed="true"
          aria-expanded="false"
          aria-controls="menu"
        >
          Menu Toggle
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveAttribute('aria-controls', 'menu')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty children', () => {
      render(<Button />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('')
    })

    it('should handle complex children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('IconText')
    })

    it('should handle all props combined', () => {
      render(
        <Button
          variant="outline"
          size="lg"
          loading
          className="custom"
        >
          Complex Button
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('border', 'h-11', 'custom')
      expect(button).toBeDisabled()
      expect(button.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })
})
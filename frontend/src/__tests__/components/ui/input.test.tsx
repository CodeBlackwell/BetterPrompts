import React from 'react'
import { render, screen } from '@/__tests__/utils/test-utils'
import { Input } from '@/components/ui/input'

describe('Input', () => {
  describe('Rendering', () => {
    it('should render basic input', () => {
      render(<Input placeholder="Enter text" />)
      
      const input = screen.getByPlaceholderText('Enter text')
      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('h-10', 'w-full', 'rounded-md', 'border')
    })

    it('should render with custom className', () => {
      render(<Input className="custom-class" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-class')
    })

    it('should render with different input types', () => {
      const { rerender } = render(<Input type="email" />)
      
      let input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')

      rerender(<Input type="password" />)
      input = screen.getByRole('textbox', { hidden: true })
      expect(input).toHaveAttribute('type', 'password')

      rerender(<Input type="number" />)
      input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('type', 'number')
    })

    it('should forward ref properly', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<Input ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })
  })

  describe('Props', () => {
    it('should pass through HTML input attributes', () => {
      render(
        <Input
          id="test-input"
          name="testInput"
          placeholder="Test placeholder"
          maxLength={10}
          required
          autoComplete="email"
        />
      )
      
      const input = screen.getByPlaceholderText('Test placeholder')
      expect(input).toHaveAttribute('id', 'test-input')
      expect(input).toHaveAttribute('name', 'testInput')
      expect(input).toHaveAttribute('maxLength', '10')
      expect(input).toHaveAttribute('required')
      expect(input).toHaveAttribute('autoComplete', 'email')
    })

    it('should handle disabled state', () => {
      render(<Input disabled placeholder="Disabled input" />)
      
      const input = screen.getByPlaceholderText('Disabled input')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50', 'disabled:bg-muted')
    })

    it('should handle value and onChange', async () => {
      const onChange = jest.fn()
      const { user } = render(
        <Input value="test" onChange={onChange} />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('test')

      await user.type(input, 'a')
      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('Error State', () => {
    it('should apply error styles when error prop is true', () => {
      render(<Input error placeholder="Error input" />)
      
      const input = screen.getByPlaceholderText('Error input')
      expect(input).toHaveClass('border-destructive', 'focus-visible:ring-destructive')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should not apply error styles when error prop is false', () => {
      render(<Input error={false} placeholder="Normal input" />)
      
      const input = screen.getByPlaceholderText('Normal input')
      expect(input).toHaveClass('border-input')
      expect(input).not.toHaveClass('border-destructive')
      expect(input).not.toHaveAttribute('aria-invalid')
    })

    it('should handle errorMessage with id', () => {
      render(
        <Input
          id="email"
          error
          errorMessage="Invalid email"
          placeholder="Email input"
        />
      )
      
      const input = screen.getByPlaceholderText('Email input')
      expect(input).toHaveAttribute('aria-describedby', 'email-error')
    })

    it('should handle errorMessage with name when no id', () => {
      render(
        <Input
          name="username"
          error
          errorMessage="Username taken"
          placeholder="Username input"
        />
      )
      
      const input = screen.getByPlaceholderText('Username input')
      expect(input).toHaveAttribute('aria-describedby', 'username-error')
    })

    it('should combine aria-describedby with error id', () => {
      render(
        <Input
          id="password"
          error
          errorMessage="Password too weak"
          aria-describedby="password-hint"
          placeholder="Password input"
        />
      )
      
      const input = screen.getByPlaceholderText('Password input')
      expect(input).toHaveAttribute('aria-describedby', 'password-hint password-error')
    })
  })

  describe('Styling', () => {
    it('should have focus-visible styles', () => {
      render(<Input placeholder="Focus test" />)
      
      const input = screen.getByPlaceholderText('Focus test')
      expect(input).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
        'focus-visible:ring-offset-2'
      )
    })

    it('should have transition classes', () => {
      render(<Input placeholder="Transition test" />)
      
      const input = screen.getByPlaceholderText('Transition test')
      expect(input).toHaveClass('transition-colors')
    })

    it('should have proper file input styling', () => {
      render(<Input type="file" />)
      
      const input = screen.getByRole('textbox', { hidden: true })
      expect(input).toHaveClass(
        'file:border-0',
        'file:bg-transparent',
        'file:text-sm',
        'file:font-medium'
      )
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const { user } = render(
        <>
          <Input placeholder="First input" />
          <Input placeholder="Second input" />
        </>
      )
      
      const firstInput = screen.getByPlaceholderText('First input')
      const secondInput = screen.getByPlaceholderText('Second input')

      firstInput.focus()
      expect(firstInput).toHaveFocus()

      await user.tab()
      expect(secondInput).toHaveFocus()
    })

    it('should support aria attributes', () => {
      render(
        <Input
          aria-label="Search"
          aria-required="true"
          aria-describedby="search-hint"
          placeholder="Search input"
        />
      )
      
      const input = screen.getByPlaceholderText('Search input')
      expect(input).toHaveAttribute('aria-label', 'Search')
      expect(input).toHaveAttribute('aria-required', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'search-hint')
    })

    it('should announce error state to screen readers', () => {
      render(
        <Input
          error
          errorMessage="Field is required"
          id="required-field"
          placeholder="Required field"
        />
      )
      
      const input = screen.getByPlaceholderText('Required field')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'required-field-error')
    })
  })

  describe('Edge Cases', () => {
    it('should handle input without any props', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('should handle very long placeholder text', () => {
      const longPlaceholder = 'This is a very long placeholder text that might overflow the input field width'
      render(<Input placeholder={longPlaceholder} />)
      
      const input = screen.getByPlaceholderText(longPlaceholder)
      expect(input).toHaveAttribute('placeholder', longPlaceholder)
    })

    it('should handle both error and disabled states', () => {
      render(<Input error disabled placeholder="Error and disabled" />)
      
      const input = screen.getByPlaceholderText('Error and disabled')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('border-destructive')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should not set aria-describedby if no errorMessage', () => {
      render(
        <Input
          error
          placeholder="Error without message"
        />
      )
      
      const input = screen.getByPlaceholderText('Error without message')
      expect(input).not.toHaveAttribute('aria-describedby')
    })
  })
})
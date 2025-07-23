import React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'
import { Input, InputProps } from './input'
import { FieldError } from './error-states'
import { Info } from 'lucide-react'
import { AccessibleTooltip } from './accessibility'

interface FormFieldProps extends InputProps {
  label: string
  helperText?: string
  errorMessage?: string
  required?: boolean
}

export function FormField({
  label,
  helperText,
  errorMessage,
  required,
  className,
  id,
  ...inputProps
}: FormFieldProps) {
  const fieldId = id || inputProps.name || label.toLowerCase().replace(/\s+/g, '-')
  const errorId = errorMessage ? `${fieldId}-error` : undefined
  const helperId = helperText ? `${fieldId}-helper` : undefined

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
        {helperText && (
          <AccessibleTooltip content={helperText}>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              aria-label={`More information about ${label}`}
            >
              <Info className="h-4 w-4" />
            </button>
          </AccessibleTooltip>
        )}
      </div>
      
      <Input
        id={fieldId}
        error={!!errorMessage}
        aria-describedby={cn(helperId, errorId)}
        {...inputProps}
      />
      
      {helperText && !errorMessage && (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      )}
      
      <FieldError message={errorMessage} id={errorId} />
    </div>
  )
}

// Textarea variant
interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  helperText?: string
  errorMessage?: string
  required?: boolean
}

export function TextareaField({
  label,
  helperText,
  errorMessage,
  required,
  className,
  id,
  ...textareaProps
}: TextareaFieldProps) {
  const fieldId = id || textareaProps.name || label.toLowerCase().replace(/\s+/g, '-')
  const errorId = errorMessage ? `${fieldId}-error` : undefined
  const helperId = helperText ? `${fieldId}-helper` : undefined

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
        {helperText && (
          <AccessibleTooltip content={helperText}>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              aria-label={`More information about ${label}`}
            >
              <Info className="h-4 w-4" />
            </button>
          </AccessibleTooltip>
        )}
      </div>
      
      <textarea
        id={fieldId}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted resize-y",
          errorMessage
            ? "border-destructive focus-visible:ring-destructive"
            : "border-input",
          className
        )}
        aria-invalid={errorMessage ? 'true' : undefined}
        aria-describedby={cn(helperId, errorId)}
        {...textareaProps}
      />
      
      {helperText && !errorMessage && (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      )}
      
      <FieldError message={errorMessage} id={errorId} />
    </div>
  )
}
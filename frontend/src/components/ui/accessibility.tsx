import React from 'react'
import { cn } from '@/lib/utils'

// Skip to main content link for keyboard navigation
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Skip to main content
    </a>
  )
}

// Visually hidden component for screen readers
export function VisuallyHidden({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className="sr-only" {...props}>
      {children}
    </span>
  )
}

// Live region for announcing dynamic changes
export function LiveRegion({
  children,
  priority = 'polite',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  priority?: 'polite' | 'assertive'
}) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      {...props}
    >
      {children}
    </div>
  )
}

// Focus trap for modals and dialogs
export function FocusTrap({
  children,
  active = true,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  active?: boolean
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    firstElement?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [active])

  return (
    <div ref={containerRef} className={className} {...props}>
      {children}
    </div>
  )
}

// Keyboard navigation indicator
export function KeyboardIndicator({
  children,
  keys,
  className,
}: {
  children: React.ReactNode
  keys: string[]
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {children}
      <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono sm:inline-block">
        {keys.join(' + ')}
      </kbd>
    </span>
  )
}

// Progress indicator for multi-step processes
export function ProgressIndicator({
  currentStep,
  totalSteps,
  label,
  className,
}: {
  currentStep: number
  totalSteps: number
  label?: string
  className?: string
}) {
  const percentage = (currentStep / totalSteps) * 100

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-2 flex justify-between text-sm">
          <span>{label}</span>
          <span className="text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-label={`Progress: step ${currentStep} of ${totalSteps}`}
      >
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Tooltip with accessibility support
export function AccessibleTooltip({
  content,
  children,
  side = 'top',
}: {
  content: string
  children: React.ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const [isVisible, setIsVisible] = React.useState(false)
  const id = React.useId()

  return (
    <>
      {React.cloneElement(children, {
        'aria-describedby': isVisible ? id : undefined,
        onMouseEnter: () => setIsVisible(true),
        onMouseLeave: () => setIsVisible(false),
        onFocus: () => setIsVisible(true),
        onBlur: () => setIsVisible(false),
      })}
      {isVisible && (
        <div
          id={id}
          role="tooltip"
          className={cn(
            'absolute z-50 rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
            {
              'bottom-full left-1/2 mb-2 -translate-x-1/2': side === 'top',
              'top-full left-1/2 mt-2 -translate-x-1/2': side === 'bottom',
              'right-full top-1/2 mr-2 -translate-y-1/2': side === 'left',
              'left-full top-1/2 ml-2 -translate-y-1/2': side === 'right',
            }
          )}
        >
          {content}
        </div>
      )}
    </>
  )
}

// Announce component for screen reader announcements
export function Announce({ message, priority = 'polite' }: { message: string; priority?: 'polite' | 'assertive' }) {
  return (
    <LiveRegion priority={priority}>
      {message}
    </LiveRegion>
  )
}
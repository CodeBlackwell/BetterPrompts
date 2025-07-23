import React from 'react'
import { AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './button'
import { Alert, AlertDescription, AlertTitle } from './alert'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  onGoHome?: () => void
  className?: string
  variant?: 'inline' | 'page' | 'card'
}

// Generic error state component
export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  onGoHome,
  className,
  variant = 'inline'
}: ErrorStateProps) {
  if (variant === 'inline') {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="mt-2">
          <p>{message}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  if (variant === 'card') {
    return (
      <div className={cn('rounded-lg border border-destructive/50 bg-destructive/10 p-6', className)}>
        <div className="flex items-start gap-4">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            {(onRetry || onGoHome) && (
              <div className="mt-4 flex gap-2">
                {onRetry && (
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Try again
                  </Button>
                )}
                {onGoHome && (
                  <Button variant="ghost" size="sm" onClick={onGoHome}>
                    <Home className="mr-2 h-3 w-3" />
                    Go home
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Page variant
  return (
    <div className={cn('flex min-h-[400px] items-center justify-center p-4', className)}>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">{title}</h2>
        <p className="mb-6 max-w-md text-muted-foreground">{message}</p>
        <div className="flex justify-center gap-2">
          {onRetry && (
            <Button onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          )}
          {onGoHome && (
            <Button variant="outline" onClick={onGoHome}>
              <Home className="mr-2 h-4 w-4" />
              Go home
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Form field error message
export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null

  return (
    <p
      id={id}
      className="mt-1 text-sm text-destructive"
      role="alert"
      aria-live="polite"
    >
      {message}
    </p>
  )
}

// Network error component
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Connection error"
      message="Unable to connect to our servers. Please check your internet connection and try again."
      onRetry={onRetry}
      variant="page"
    />
  )
}

// 404 error component
export function NotFoundError({ onGoHome }: { onGoHome?: () => void }) {
  return (
    <ErrorState
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
      onGoHome={onGoHome}
      variant="page"
    />
  )
}

// Expandable error details
export function ErrorDetails({ error, details }: { error: string; details?: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        <p>{error}</p>
        {details && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-auto p-0 font-normal"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="mr-1 h-3 w-3" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3 w-3" />
                  Show details
                </>
              )}
            </Button>
            {isExpanded && (
              <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                {details}
              </pre>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
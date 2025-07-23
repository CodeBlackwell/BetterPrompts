'use client'

import { Suspense, ComponentType } from 'react'
import dynamic from 'next/dynamic'

interface LazyLoadProps {
  fallback?: React.ReactNode
}

// Loading spinner component
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
    </div>
  )
}

// Skeleton loader for different component types
export function SkeletonLoader({ type = 'default' }: { type?: 'default' | 'card' | 'text' | 'button' }) {
  switch (type) {
    case 'card':
      return (
        <div className="animate-pulse rounded-lg border bg-gray-50 p-6">
          <div className="mb-4 h-4 w-3/4 rounded bg-gray-200" />
          <div className="mb-2 h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-5/6 rounded bg-gray-200" />
        </div>
      )
    case 'text':
      return (
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-5/6 rounded bg-gray-200" />
          <div className="h-3 w-4/6 rounded bg-gray-200" />
        </div>
      )
    case 'button':
      return (
        <div className="animate-pulse">
          <div className="h-10 w-32 rounded-lg bg-gray-200" />
        </div>
      )
    default:
      return (
        <div className="animate-pulse">
          <div className="h-64 w-full rounded bg-gray-200" />
        </div>
      )
  }
}

// Generic lazy load wrapper
export function LazyLoad<P extends object>({
  loader,
  fallback = <LoadingSpinner />,
  ...props
}: LazyLoadProps & {
  loader: () => Promise<{ default: ComponentType<P> }>
} & P) {
  const Component = dynamic(loader, {
    loading: () => <>{fallback}</>,
    ssr: true,
  })

  return (
    <Suspense fallback={fallback}>
      <Component {...(props as P)} />
    </Suspense>
  )
}

// Utility function to create lazy-loaded components
export function createLazyComponent<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode
) {
  return dynamic(loader, {
    loading: () => <>{fallback || <LoadingSpinner />}</>,
    ssr: true,
  })
}

// Intersection Observer hook for viewport-based lazy loading
import { useEffect, useRef, useState } from 'react'

export function useIntersectionObserver(
  options: IntersectionObserverInit = {
    threshold: 0.1,
    rootMargin: '50px',
  }
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true)
      }
    }, options)

    observer.observe(element)
    return () => observer.disconnect()
  }, [options, hasIntersected])

  return { ref, isIntersecting, hasIntersected }
}

// Viewport-based lazy loading component
export function ViewportLazyLoad({
  children,
  fallback = <LoadingSpinner />,
  once = true,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  once?: boolean
}) {
  const { ref, hasIntersected, isIntersecting } = useIntersectionObserver()
  const shouldRender = once ? hasIntersected : isIntersecting

  return (
    <div ref={ref}>
      {shouldRender ? children : fallback}
    </div>
  )
}
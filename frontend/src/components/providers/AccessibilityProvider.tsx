'use client'

import React from 'react'
import { SkipToContent } from '@/components/ui/accessibility'

export default function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  // Manage focus for route changes
  React.useEffect(() => {
    const handleRouteChange = () => {
      // Focus main content on route change for screen readers
      const mainContent = document.getElementById('main-content')
      if (mainContent) {
        mainContent.focus()
        mainContent.scrollIntoView()
      }
    }

    // Listen for route changes
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  // Add high contrast mode support
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('high-contrast', e.matches)
    }

    // Set initial state
    document.documentElement.classList.toggle('high-contrast', mediaQuery.matches)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Add reduced motion support
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('reduce-motion', e.matches)
    }

    // Set initial state
    document.documentElement.classList.toggle('reduce-motion', mediaQuery.matches)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <>
      <SkipToContent />
      {children}
    </>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUserStore } from '@/store/useUserStore'
import { isTokenExpired, tokenStorage } from '@/lib/auth/jwt'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireRoles?: string[]
  redirectTo?: string
  fallback?: React.ReactNode
}

export function ProtectedRoute({
  children,
  requireAuth = true,
  requireRoles = [],
  redirectTo = '/login',
  fallback = null,
}: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, user, accessToken } = useUserStore()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      // Get token from store or storage
      const token = accessToken || tokenStorage.getAccessToken()
      
      // Check authentication
      if (requireAuth && (!token || !isAuthenticated)) {
        router.push(`${redirectTo}?redirect=${encodeURIComponent(pathname)}`)
        return
      }

      // Check token expiration
      if (token && isTokenExpired(token)) {
        // Token expired - try to refresh or redirect to login
        useUserStore.getState().logout()
        router.push(`${redirectTo}?redirect=${encodeURIComponent(pathname)}`)
        return
      }

      // Check role requirements
      if (requireRoles.length > 0 && user) {
        const userRoles = user.roles || []
        const hasRequiredRole = requireRoles.some(role => userRoles.includes(role))
        
        if (!hasRequiredRole) {
          // User doesn't have required role - redirect or show unauthorized
          router.push('/unauthorized')
          return
        }
      }

      // All checks passed
      setIsAuthorized(true)
      setIsChecking(false)
    }

    checkAuth()
  }, [isAuthenticated, user, accessToken, requireAuth, requireRoles, redirectTo, pathname, router])

  // Show fallback while checking auth
  if (isChecking) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Show children only if authorized
  return isAuthorized ? <>{children}</> : null
}

// Hook version for programmatic use
export function useProtectedRoute(options: {
  requireAuth?: boolean
  requireRoles?: string[]
  redirectTo?: string
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, user, accessToken } = useUserStore()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const {
    requireAuth = true,
    requireRoles = [],
    redirectTo = '/login',
  } = options

  useEffect(() => {
    const checkAuth = () => {
      const token = accessToken || tokenStorage.getAccessToken()
      
      // Check authentication
      if (requireAuth && (!token || !isAuthenticated)) {
        router.push(`${redirectTo}?redirect=${encodeURIComponent(pathname)}`)
        setIsLoading(false)
        return
      }

      // Check token expiration
      if (token && isTokenExpired(token)) {
        useUserStore.getState().logout()
        router.push(`${redirectTo}?redirect=${encodeURIComponent(pathname)}`)
        setIsLoading(false)
        return
      }

      // Check roles
      if (requireRoles.length > 0 && user) {
        const userRoles = user.roles || []
        const hasRequiredRole = requireRoles.some(role => userRoles.includes(role))
        
        if (!hasRequiredRole) {
          router.push('/unauthorized')
          setIsLoading(false)
          return
        }
      }

      setIsAuthorized(true)
      setIsLoading(false)
    }

    checkAuth()
  }, [isAuthenticated, user, accessToken, requireAuth, requireRoles, redirectTo, pathname, router])

  return { isAuthorized, isLoading }
}
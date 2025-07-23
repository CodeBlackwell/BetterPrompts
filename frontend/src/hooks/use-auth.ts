'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/store/useUserStore'
import { authService } from '@/lib/api/services'
import { isTokenExpired, shouldRefreshToken, tokenStorage, getTokenExpiresIn } from '@/lib/auth/jwt'
import { toast } from './use-toast'

export function useAuth() {
  const router = useRouter()
  const { 
    user, 
    isAuthenticated, 
    accessToken, 
    refreshToken,
    setToken, 
    setUser, 
    logout: storeLogout 
  } = useUserStore()
  
  const refreshingRef = useRef(false)
  const refreshTimeoutRef = useRef<NodeJS.Timeout>()

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initAuth = () => {
      const storedAccessToken = tokenStorage.getAccessToken()
      const storedRefreshToken = tokenStorage.getRefreshToken()
      
      if (storedAccessToken && !isTokenExpired(storedAccessToken)) {
        setToken(storedAccessToken, storedRefreshToken || undefined)
        // Optionally fetch user profile here
      }
    }
    
    initAuth()
  }, [setToken])

  // Token refresh logic
  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken || refreshingRef.current) return null
    
    try {
      refreshingRef.current = true
      const response = await authService.refreshToken({ refresh_token: refreshToken })
      
      setToken(response.access_token, response.refresh_token)
      setUser(response.user)
      
      return response.access_token
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return null
    } finally {
      refreshingRef.current = false
    }
  }, [refreshToken, setToken, setUser])

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!accessToken) return
    
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      
      if (shouldRefreshToken(accessToken)) {
        // Refresh immediately
        refreshAccessToken()
      } else {
        // Schedule refresh for later
        const expiresIn = getTokenExpiresIn(accessToken)
        if (expiresIn > 300) {
          // Refresh 5 minutes before expiration
          const refreshIn = (expiresIn - 300) * 1000
          refreshTimeoutRef.current = setTimeout(() => {
            refreshAccessToken()
          }, refreshIn)
        }
      }
    }
    
    scheduleRefresh()
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [accessToken, refreshAccessToken])

  // Enhanced logout function
  const logout = useCallback(async () => {
    try {
      // Call API to invalidate token server-side
      if (accessToken) {
        await authService.logout()
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local state regardless
      storeLogout()
      router.push('/login')
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      })
    }
  }, [accessToken, storeLogout, router])

  // Check auth status
  const checkAuth = useCallback(async () => {
    const token = accessToken || tokenStorage.getAccessToken()
    
    if (!token) {
      return false
    }
    
    if (isTokenExpired(token)) {
      // Try to refresh
      const newToken = await refreshAccessToken()
      return !!newToken
    }
    
    return true
  }, [accessToken, refreshAccessToken])

  // Require auth helper
  const requireAuth = useCallback(async (redirectTo = '/login') => {
    const isValid = await checkAuth()
    
    if (!isValid) {
      router.push(`${redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`)
      return false
    }
    
    return true
  }, [checkAuth, router])

  // Require specific role
  const requireRole = useCallback(async (role: string, redirectTo = '/unauthorized') => {
    const isValid = await checkAuth()
    
    if (!isValid) {
      router.push('/login')
      return false
    }
    
    const userRoles = user?.roles || []
    if (!userRoles.includes(role)) {
      router.push(redirectTo)
      return false
    }
    
    return true
  }, [checkAuth, user, router])

  return {
    user,
    isAuthenticated,
    accessToken,
    logout,
    checkAuth,
    requireAuth,
    requireRole,
    refreshAccessToken,
  }
}
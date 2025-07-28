import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authService, LoginRequest, RegisterRequest } from '@/lib/api/auth'
import { useUserStore } from '@/store/useUserStore'
import { ApiError } from '@/lib/api/client'

export function useAuth() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { login: storeLogin, logout: storeLogout, setLoading } = useUserStore()

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true)
    setError(null)
    setLoading(true)

    try {
      const response = await authService.login(credentials)
      storeLogin(response.user)
      
      // Redirect based on user role
      if (response.user.roles?.includes('admin')) {
        router.push('/admin/analytics')
      } else {
        router.push('/dashboard')
      }
      
      return response
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || 'Failed to login')
      return null
    } finally {
      setIsLoading(false)
      setLoading(false)
    }
  }

  const register = async (data: RegisterRequest) => {
    setIsLoading(true)
    setError(null)
    setLoading(true)

    try {
      const response = await authService.register(data)
      storeLogin(response.user)
      
      // Redirect based on user role (though new registrations typically won't be admin)
      if (response.user.roles?.includes('admin')) {
        router.push('/admin/analytics')
      } else {
        router.push('/dashboard')
      }
      
      return response
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || 'Failed to register')
      return null
    } finally {
      setIsLoading(false)
      setLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await authService.logout()
      storeLogout()
      router.push('/')
    } catch (err) {
      // Even if the API call fails, we should still logout locally
      storeLogout()
      router.push('/')
    } finally {
      setIsLoading(false)
    }
  }

  const checkAuth = async () => {
    const token = authService.getStoredToken()
    if (!token) {
      storeLogout()
      return false
    }

    setLoading(true)
    try {
      const user = await authService.getCurrentUser()
      storeLogin(user)
      return true
    } catch (err) {
      storeLogout()
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    login,
    register,
    logout,
    checkAuth,
    isLoading,
    error,
  }
}
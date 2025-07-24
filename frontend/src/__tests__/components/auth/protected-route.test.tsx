import React from 'react'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { ProtectedRoute, useProtectedRoute } from '@/components/auth/protected-route'
import { useUserStore } from '@/store/useUserStore'
import { useRouter, usePathname } from 'next/navigation'
import { isTokenExpired, tokenStorage } from '@/lib/auth/jwt'
import { renderHook } from '@testing-library/react'

// Mock dependencies
jest.mock('@/store/useUserStore')
jest.mock('@/lib/auth/jwt')
jest.mock('next/navigation')

const mockPush = jest.fn()
const mockGetAccessToken = jest.fn()
const mockLogout = jest.fn()

// Mock user data
const mockUser = {
  id: '123',
  email: 'test@example.com',
  username: 'testuser',
  roles: ['user'],
}

const mockAdminUser = {
  ...mockUser,
  roles: ['user', 'admin'],
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Mock useRouter
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    
    // Mock usePathname
    ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
    
    // Mock tokenStorage
    ;(tokenStorage.getAccessToken as jest.Mock) = mockGetAccessToken
    
    // Mock isTokenExpired
    ;(isTokenExpired as jest.Mock).mockReturnValue(false)
    
    // Default useUserStore mock
    ;(useUserStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      accessToken: 'valid-token',
    })
    
    // Mock useUserStore.getState
    ;(useUserStore as any).getState = jest.fn().mockReturnValue({
      logout: mockLogout,
    })
  })

  describe('Authentication Check', () => {
    it('should render children when authenticated', async () => {
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should redirect to login when not authenticated', async () => {
      ;(useUserStore as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        user: null,
        accessToken: null,
      })
      mockGetAccessToken.mockReturnValue(null)

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
      })

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('should use custom redirect path', async () => {
      ;(useUserStore as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        user: null,
        accessToken: null,
      })
      mockGetAccessToken.mockReturnValue(null)

      render(
        <ProtectedRoute redirectTo="/custom-login">
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/custom-login?redirect=%2Fdashboard')
      })
    })

    it('should not require auth when requireAuth is false', async () => {
      ;(useUserStore as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        user: null,
        accessToken: null,
      })

      render(
        <ProtectedRoute requireAuth={false}>
          <div>Public Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(screen.getByText('Public Content')).toBeInTheDocument()
      })

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Token Validation', () => {
    it('should check token from store first', async () => {
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(mockGetAccessToken).not.toHaveBeenCalled()
    })

    it('should fallback to tokenStorage when store token is null', async () => {
      ;(useUserStore as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        accessToken: null,
      })
      mockGetAccessToken.mockReturnValue('storage-token')

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockGetAccessToken).toHaveBeenCalled()
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })
    })

    it('should redirect when token is expired', async () => {
      ;(isTokenExpired as jest.Mock).mockReturnValue(true)

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
      })

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('Role-Based Access Control', () => {
    it('should allow access when user has required role', async () => {
      render(
        <ProtectedRoute requireRoles={['user']}>
          <div>User Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(screen.getByText('User Content')).toBeInTheDocument()
      })

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should redirect to unauthorized when user lacks required role', async () => {
      render(
        <ProtectedRoute requireRoles={['admin']}>
          <div>Admin Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/unauthorized')
      })

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    })

    it('should allow access when user has any of the required roles', async () => {
      ;(useUserStore as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        accessToken: 'valid-token',
      })

      render(
        <ProtectedRoute requireRoles={['admin', 'moderator']}>
          <div>Admin or Moderator Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(screen.getByText('Admin or Moderator Content')).toBeInTheDocument()
      })
    })

    it('should handle empty roles array on user object', async () => {
      ;(useUserStore as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { ...mockUser, roles: undefined },
        accessToken: 'valid-token',
      })

      render(
        <ProtectedRoute requireRoles={['admin']}>
          <div>Admin Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/unauthorized')
      })
    })
  })

  describe('Loading States', () => {
    it('should show default loading spinner while checking auth', () => {
      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      const spinner = screen.getByRole('status', { hidden: true })
      expect(spinner).toHaveClass('animate-spin')
    })

    it('should show custom fallback while checking auth', () => {
      render(
        <ProtectedRoute fallback={<div>Custom Loading...</div>}>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Custom Loading...')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('URL Preservation', () => {
    it('should preserve original URL in redirect parameter', async () => {
      ;(usePathname as jest.Mock).mockReturnValue('/settings/profile')
      ;(useUserStore as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        user: null,
        accessToken: null,
      })
      mockGetAccessToken.mockReturnValue(null)

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fsettings%2Fprofile')
      })
    })

    it('should handle special characters in URL', async () => {
      ;(usePathname as jest.Mock).mockReturnValue('/search?q=test&filter=active')
      ;(useUserStore as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        user: null,
        accessToken: null,
      })
      mockGetAccessToken.mockReturnValue(null)

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/login?redirect=%2Fsearch%3Fq%3Dtest%26filter%3Dactive'
        )
      })
    })
  })
})

describe('useProtectedRoute Hook', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Mock useRouter
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    
    // Mock usePathname
    ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
    
    // Mock tokenStorage
    ;(tokenStorage.getAccessToken as jest.Mock) = mockGetAccessToken
    
    // Mock isTokenExpired
    ;(isTokenExpired as jest.Mock).mockReturnValue(false)
    
    // Default useUserStore mock
    ;(useUserStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      accessToken: 'valid-token',
    })
    
    // Mock useUserStore.getState
    ;(useUserStore as any).getState = jest.fn().mockReturnValue({
      logout: mockLogout,
    })
  })

  it('should return authorized true when authenticated', async () => {
    const { result } = renderHook(() => useProtectedRoute())

    await waitFor(() => {
      expect(result.current.isAuthorized).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should return authorized false and redirect when not authenticated', async () => {
    ;(useUserStore as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null,
      accessToken: null,
    })
    mockGetAccessToken.mockReturnValue(null)

    const { result } = renderHook(() => useProtectedRoute())

    await waitFor(() => {
      expect(result.current.isAuthorized).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
    })
  })

  it('should handle role requirements in hook', async () => {
    const { result } = renderHook(() => 
      useProtectedRoute({ requireRoles: ['admin'] })
    )

    await waitFor(() => {
      expect(result.current.isAuthorized).toBe(false)
      expect(mockPush).toHaveBeenCalledWith('/unauthorized')
    })
  })

  it('should use custom options', async () => {
    ;(useUserStore as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null,
      accessToken: null,
    })
    mockGetAccessToken.mockReturnValue(null)

    const { result } = renderHook(() => 
      useProtectedRoute({ 
        requireAuth: true,
        redirectTo: '/custom-login',
        requireRoles: []
      })
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/custom-login?redirect=%2Fdashboard')
    })
  })

  it('should allow access when requireAuth is false', async () => {
    ;(useUserStore as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null,
      accessToken: null,
    })

    const { result } = renderHook(() => 
      useProtectedRoute({ requireAuth: false })
    )

    await waitFor(() => {
      expect(result.current.isAuthorized).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(mockPush).not.toHaveBeenCalled()
    })
  })
})
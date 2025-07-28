// Debug utilities for authentication and routing issues

export const debugAuth = {
  // Check current auth state
  checkAuthState: () => {
    console.group('🔐 Auth State Debug')
    
    // Check localStorage
    console.log('LocalStorage tokens:', {
      access_token: localStorage.getItem('access_token'),
      refresh_token: localStorage.getItem('refresh_token'),
      auth_token: localStorage.getItem('auth_token')
    })
    
    // Check cookies
    console.log('Cookies:', document.cookie)
    
    // Check if specific auth cookies exist
    const hasCookie = (name: string) => {
      return document.cookie.split(';').some(c => c.trim().startsWith(`${name}=`))
    }
    
    console.log('Cookie check:', {
      auth_token: hasCookie('auth_token'),
      access_token: hasCookie('access_token'),
      token: hasCookie('token')
    })
    
    // Check Zustand store
    const zustandState = localStorage.getItem('user-store')
    if (zustandState) {
      try {
        const parsed = JSON.parse(zustandState)
        console.log('Zustand store:', parsed.state)
      } catch (e) {
        console.error('Failed to parse Zustand store:', e)
      }
    }
    
    console.groupEnd()
  },

  // Test navigation
  testNavigation: async () => {
    console.group('🧭 Navigation Test')
    
    // Test different navigation methods
    const { push } = await import('next/navigation')
    
    console.log('Testing router.push...')
    try {
      await push('/admin/analytics')
      console.log('✅ router.push successful')
    } catch (e) {
      console.error('❌ router.push failed:', e)
    }
    
    console.log('Current location:', window.location.pathname)
    console.groupEnd()
  },

  // Simulate login and redirect
  simulateAdminLogin: async () => {
    console.group('🚀 Simulating Admin Login')
    
    // Mock response
    const mockResponse = {
      access_token: 'mock-token-123',
      refresh_token: 'mock-refresh-123',
      user: {
        id: '1',
        email: 'admin@example.com',
        roles: ['admin', 'user']
      }
    }
    
    console.log('Mock login response:', mockResponse)
    
    // Store in localStorage
    localStorage.setItem('access_token', mockResponse.access_token)
    localStorage.setItem('refresh_token', mockResponse.refresh_token)
    
    // Set cookie
    document.cookie = `auth_token=${mockResponse.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
    
    // Check if admin
    const isAdmin = mockResponse.user.roles?.includes('admin')
    console.log('Is admin?', isAdmin)
    
    // Try navigation
    const targetPath = isAdmin ? '/admin/analytics' : '/dashboard'
    console.log('Target path:', targetPath)
    
    // Method 1: router.push
    try {
      const { push } = await import('next/navigation')
      await push(targetPath)
      console.log('✅ Navigation with router.push successful')
    } catch (e) {
      console.error('❌ router.push failed:', e)
      
      // Method 2: window.location
      console.log('Trying window.location fallback...')
      window.location.href = targetPath
    }
    
    console.groupEnd()
  },

  // Clear all auth data
  clearAuth: () => {
    console.group('🧹 Clearing Auth Data')
    
    // Clear localStorage
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user-store')
    
    // Clear cookies
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
    
    console.log('✅ Auth data cleared')
    console.groupEnd()
  }
}

// Export to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).debugAuth = debugAuth
}
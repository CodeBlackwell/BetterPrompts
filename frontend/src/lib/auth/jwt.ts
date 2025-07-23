export interface JWTPayload {
  sub: string // user ID
  email: string
  username?: string
  roles?: string[]
  exp: number
  iat: number
}

/**
 * Decode JWT token without verification (client-side only)
 * Actual verification should happen server-side
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid token format')
    }
    
    // Decode the payload (second part)
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as JWTPayload
  } catch (error) {
    console.error('Failed to decode token:', error)
    return null
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token)
  if (!decoded) return true
  
  const currentTime = Date.now() / 1000
  return decoded.exp < currentTime
}


/**
 * Check if user has required role
 */
export function hasRole(token: string, role: string): boolean {
  const decoded = decodeToken(token)
  if (!decoded || !decoded.roles) return false
  
  return decoded.roles.includes(role)
}

/**
 * Get user ID from token
 */
export function getUserIdFromToken(token: string): string | null {
  const decoded = decodeToken(token)
  return decoded?.sub || null
}

/**
 * Storage keys for tokens
 */
export const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const

/**
 * Secure token storage utilities
 */
export const tokenStorage = {
  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)
  },
  
  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN)
  },
  
  setTokens: (accessToken: string, refreshToken?: string) => {
    if (typeof window === 'undefined') return
    
    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, accessToken)
    if (refreshToken) {
      localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
    }
  },
  
  clearTokens: () => {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN)
  },
}

/**
 * Calculate when to refresh token (before it expires)
 * Refresh 5 minutes before expiration
 */
export function shouldRefreshToken(token: string): boolean {
  const expiresIn = getTokenExpiresIn(token)
  return expiresIn > 0 && expiresIn < 300 // 5 minutes
}

/**
 * Get time until token expires in seconds (added missing function)
 */
export function getTokenExpiresIn(token: string): number {
  const decoded = decodeToken(token)
  if (!decoded) return 0
  
  const currentTime = Date.now() / 1000
  return Math.max(0, decoded.exp - currentTime)
}
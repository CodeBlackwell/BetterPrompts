import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/terms',
  '/privacy',
  '/about',
  '/contact',
  '/docs',
]

// Define API routes that don't require authentication
const publicApiRoutes = [
  '/api/health',
  '/api/v1/health',
]

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/enhance',
  '/history',
  '/profile',
  '/settings',
  '/admin',
  '/onboarding',
]

// Routes that require specific roles
const roleBasedRoutes = {
  admin: ['/admin', '/admin/*'],
  pro: ['/pro', '/pro/*'],
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow public routes and static files
  if (
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') || // Auth endpoints are public
    pathname.includes('.') || // Static files
    publicApiRoutes.includes(pathname)
  ) {
    return NextResponse.next()
  }

  // Check for auth token in cookies (set by API)
  const token = request.cookies.get('auth_token')?.value

  // If accessing a protected route without a token, redirect to login
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  if (isProtectedRoute && !token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Add redirect param to return user to requested page after login
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // For authenticated requests, we could validate the JWT here
  // but it's better to let the API handle validation to avoid
  // duplicating JWT secret management
  
  // Optional: Add JWT validation for extra security
  if (token) {
    try {
      // In production, you might want to validate JWT structure
      // or check expiration client-side for better UX
      // For now, we'll let the API handle full validation
      
      // Add auth header for API requests
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('Authorization', `Bearer ${token}`)
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    } catch (error) {
      // Invalid token - clear it and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth_token')
      return response
    }
  }

  return NextResponse.next()
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/health (health check endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/health|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
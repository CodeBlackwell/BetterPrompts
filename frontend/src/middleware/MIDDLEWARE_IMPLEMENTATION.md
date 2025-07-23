# Protected Route Middleware Implementation

## Overview

The protected route middleware has been implemented for the BetterPrompts Next.js application with JWT validation, automatic token refresh, and role-based access control.

## Key Features

### 1. **Next.js Edge Middleware** (`src/middleware.ts`)
- Runs on the Edge Runtime for optimal performance
- Protects routes at the request level before page rendering
- Handles redirects for unauthenticated users
- Preserves original destination for post-login redirect
- Adds Authorization headers to API requests

### 2. **JWT Utilities** (`src/lib/auth/jwt.ts`)
- Client-side JWT decoding (without verification)
- Token expiration checking
- Role verification from JWT claims
- Secure token storage utilities
- Automatic refresh scheduling

### 3. **Protected Route Component** (`src/components/auth/protected-route.tsx`)
- React component wrapper for protected pages
- Handles authentication checking
- Role-based access control
- Loading states during auth verification
- Automatic redirects

### 4. **Auth Hook** (`src/hooks/use-auth.ts`)
- Centralized authentication logic
- Automatic token refresh before expiration
- Auth state management
- Role checking utilities
- Logout functionality with API cleanup

### 5. **Enhanced Zustand Store** (`src/store/useUserStore.ts`)
- Token persistence in localStorage
- Synchronized auth state
- Automatic cleanup on logout

## Usage Examples

### 1. Protecting a Page with Middleware

The middleware automatically protects routes listed in `protectedRoutes`:

```typescript
// Automatically protected routes:
const protectedRoutes = [
  '/dashboard',
  '/enhance',
  '/history',
  '/profile',
  '/settings',
  '/admin',
  '/onboarding',
]
```

### 2. Using Protected Route Component

```tsx
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      {/* Your protected content */}
    </ProtectedRoute>
  )
}
```

### 3. Role-Based Protection

```tsx
<ProtectedRoute requireRoles={['admin']}>
  {/* Admin-only content */}
</ProtectedRoute>
```

### 4. Using the Auth Hook

```tsx
import { useAuth } from '@/hooks/use-auth'

function MyComponent() {
  const { user, isAuthenticated, logout, requireRole } = useAuth()
  
  const handleAdminAction = async () => {
    if (await requireRole('admin')) {
      // Perform admin action
    }
  }
  
  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user?.username}!</p>
      ) : (
        <p>Please log in</p>
      )}
    </div>
  )
}
```

### 5. Programmatic Route Protection

```tsx
import { useProtectedRoute } from '@/components/auth/protected-route'

function MyComponent() {
  const { isAuthorized, isLoading } = useProtectedRoute({
    requireAuth: true,
    requireRoles: ['pro'],
    redirectTo: '/upgrade'
  })
  
  if (isLoading) return <Loading />
  if (!isAuthorized) return null
  
  return <ProtectedContent />
}
```

## Security Features

1. **JWT Validation**
   - Client-side structure validation
   - Expiration checking
   - Server-side verification (API Gateway)

2. **Token Storage**
   - Secure localStorage for persistence
   - Automatic cleanup on logout
   - Synchronized with Zustand store

3. **Automatic Token Refresh**
   - Refreshes 5 minutes before expiration
   - Prevents unnecessary logouts
   - Handles refresh failures gracefully

4. **CORS Protection**
   - Credentials included in requests
   - Origin validation on API Gateway
   - Secure cookie handling

## Configuration

### Public Routes
Routes that don't require authentication:
- `/`, `/login`, `/register`, `/forgot-password`
- `/terms`, `/privacy`, `/about`, `/contact`
- `/docs`

### Protected Routes
Routes that require authentication:
- `/dashboard`, `/enhance`, `/history`
- `/profile`, `/settings`
- `/admin` (also requires admin role)
- `/onboarding`

### Role-Based Routes
```typescript
const roleBasedRoutes = {
  admin: ['/admin', '/admin/*'],
  pro: ['/pro', '/pro/*'],
}
```

## API Integration

The middleware works seamlessly with:
- API Gateway JWT validation
- Refresh token endpoint
- Protected API routes
- CORS configuration

## Next Steps

1. **Add Social Login**: Integrate OAuth providers
2. **Enhance Role Management**: More granular permissions
3. **Add Session Management**: Track active sessions
4. **Implement Remember Me**: Longer refresh token TTL
5. **Add MFA Support**: Two-factor authentication

## Testing

To test the middleware:

1. **Unauthenticated Access**:
   - Navigate to `/dashboard` without logging in
   - Should redirect to `/login?redirect=/dashboard`

2. **Authenticated Access**:
   - Log in successfully
   - Navigate to `/dashboard`
   - Should show protected content

3. **Token Expiration**:
   - Wait for token to expire
   - Try accessing protected route
   - Should redirect to login

4. **Role-Based Access**:
   - Log in as non-admin user
   - Try accessing `/admin`
   - Should redirect to `/unauthorized`

## Troubleshooting

### Common Issues

1. **Infinite Redirect Loop**
   - Check middleware matcher configuration
   - Ensure public routes are excluded

2. **Token Not Persisting**
   - Verify localStorage is available
   - Check Zustand store persistence

3. **Unauthorized on Valid Token**
   - Verify API Gateway CORS settings
   - Check token format and claims

4. **Refresh Not Working**
   - Ensure refresh token is stored
   - Check API refresh endpoint
   - Verify refresh logic timing
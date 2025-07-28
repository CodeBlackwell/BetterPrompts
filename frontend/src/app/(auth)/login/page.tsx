'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { debugAuth } from '@/utils/debug-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { authService } from '@/lib/api/services'
import { useUserStore } from '@/store/useUserStore'
import { Loader2, Mail, Lock, AlertCircle, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { setUser, setToken } = useUserStore()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, rememberMe: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await authService.login({
        email_or_username: formData.email,
        password: formData.password,
        remember_me: formData.rememberMe
      })

      // Store auth data
      setToken(response.access_token, response.refresh_token)
      setUser(response.user)
      
      // Set auth cookie for middleware (in case backend doesn't set it)
      // Note: This is a client-side cookie, server-side cookies should be set by the backend
      document.cookie = `auth_token=${response.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`

      // Show success message
      toast({
        title: 'Welcome back!',
        description: `Logged in as ${response.user.email}`,
      })

      // Add debugging
      console.log('Login response:', response)
      console.log('User roles:', response.user.roles)
      console.log('Is admin?', response.user.roles?.includes('admin'))

      // Redirect based on user role
      const redirectTo = new URLSearchParams(window.location.search).get('from')
      
      // Check if user is admin and redirect accordingly
      const targetPath = response.user.roles?.includes('admin') 
        ? (redirectTo || '/admin/analytics')
        : (redirectTo || '/dashboard')
      
      console.log('Redirecting to:', targetPath)
      
      // Ensure state updates are complete before navigation
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Try router.push first (preferred for SPA navigation)
      try {
        await router.push(targetPath)
        console.log('Router navigation successful')
      } catch (routerError) {
        console.error('Router navigation failed:', routerError)
        // Fallback to window.location for guaranteed navigation
        window.location.href = targetPath
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.response?.data?.error || err.message || 'Invalid email or password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-9"
                  autoComplete="email"
                  data-testid="email-input"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-9"
                  autoComplete="current-password"
                  data-testid="password-input"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={formData.rememberMe}
                  onCheckedChange={handleCheckboxChange}
                  disabled={isLoading}
                />
                <Label 
                  htmlFor="rememberMe" 
                  className="text-sm font-normal cursor-pointer select-none"
                >
                  Remember me
                </Label>
              </div>
              
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                Forgot password?
              </Link>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="login-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                href="/register"
                className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                Sign up
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
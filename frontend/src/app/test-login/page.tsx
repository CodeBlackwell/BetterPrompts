'use client'

import { useUserStore } from '@/store/useUserStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, User } from 'lucide-react'

export default function TestLoginPage() {
  const router = useRouter()
  const { user, isAuthenticated, accessToken, logout } = useUserStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Not Authenticated
            </CardTitle>
            <CardDescription>
              You need to log in to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Authentication Test Page
            </CardTitle>
            <CardDescription>
              This page shows your current authentication status and user information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Authentication Status</h3>
                <p className="text-sm">
                  <span className="font-medium">Status:</span>{' '}
                  <span className="text-green-600">Authenticated ✓</span>
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">User Information</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">ID:</span> {user?.id}</p>
                  <p><span className="font-medium">Email:</span> {user?.email}</p>
                  <p><span className="font-medium">Username:</span> {user?.username || 'N/A'}</p>
                  <p><span className="font-medium">Full Name:</span> {user?.full_name || user?.name || 'N/A'}</p>
                  <p><span className="font-medium">Roles:</span> {user?.roles?.join(', ') || 'user'}</p>
                  <p><span className="font-medium">Created:</span> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Token Information</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Access Token:</span></p>
                  <code className="block p-2 bg-background rounded text-xs break-all">
                    {accessToken ? `${accessToken.substring(0, 20)}...` : 'N/A'}
                  </code>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={() => router.push('/')} variant="outline">
                Go to Home
              </Button>
              <Button onClick={handleLogout} variant="destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
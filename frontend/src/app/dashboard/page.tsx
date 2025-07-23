'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Brain, 
  Sparkles, 
  BarChart3, 
  History, 
  Settings,
  ArrowRight 
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.first_name || user?.username || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Enhance your prompts with AI-powered techniques.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Quick Enhance
              </CardTitle>
              <CardDescription>
                Transform your prompts instantly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/enhance">
                <Button className="w-full group">
                  Start Enhancing
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                View your enhancement history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/history">
                <Button variant="outline" className="w-full">
                  View History
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Techniques
              </CardTitle>
              <CardDescription>
                Explore available techniques
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/techniques">
                <Button variant="outline" className="w-full">
                  Browse Techniques
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Your Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Total Enhancements</span>
                    <span className="font-semibold">0</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Techniques Used</span>
                    <span className="font-semibold">0</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Average Improvement</span>
                    <span className="font-semibold">-</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/profile" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  Edit Profile
                </Button>
              </Link>
              <Link href="/settings" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  Account Settings
                </Button>
              </Link>
              <Link href="/api-keys" className="block">
                <Button variant="ghost" className="w-full justify-start">
                  API Keys
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
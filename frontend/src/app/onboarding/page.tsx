'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/store/useUserStore'
import { CheckCircle2, Sparkles, ArrowRight, Zap, Shield, Brain } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useUserStore()

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return null
  }

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Enhancement',
      description: 'Transform simple prompts into powerful, detailed instructions'
    },
    {
      icon: Zap,
      title: 'Multiple Techniques',
      description: 'Chain of Thought, Few-Shot Learning, and more at your fingertips'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your prompts and data are always encrypted and secure'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 px-4 py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold">Welcome to BetterPrompts, {user?.first_name || user?.username}!</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            You're all set to start creating amazing prompts. Let's show you around.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="relative overflow-hidden">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Quick Start Guide
              </h3>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="font-semibold text-primary">1.</span>
                  <span>Type or paste your prompt in the main input area</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-semibold text-primary">2.</span>
                  <span>Our AI will analyze and suggest the best enhancement techniques</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-semibold text-primary">3.</span>
                  <span>Review the enhanced prompt and copy it for your use</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-semibold text-primary">4.</span>
                  <span>Save your favorites and track your prompt history</span>
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => router.push('/enhance')}
            className="group"
          >
            Start Creating
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push('/settings')}
          >
            Customize Settings
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Need help? Check out our{' '}
          <a href="/docs" className="text-primary hover:underline">
            documentation
          </a>{' '}
          or{' '}
          <a href="/support" className="text-primary hover:underline">
            contact support
          </a>
        </p>
      </div>
    </div>
  )
}
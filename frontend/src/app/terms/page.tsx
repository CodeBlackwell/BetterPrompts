import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/register" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to registration
        </Link>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: July 22, 2025</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using BetterPrompts, you accept and agree to be bound by the terms 
              and provision of this agreement.
            </p>

            <h2>2. Use License</h2>
            <p>
              Permission is granted to temporarily use BetterPrompts for personal, non-commercial 
              transitory viewing only.
            </p>

            <h2>3. Disclaimer</h2>
            <p>
              The materials on BetterPrompts are provided on an 'as is' basis. BetterPrompts makes 
              no warranties, expressed or implied, and hereby disclaims and negates all other warranties 
              including, without limitation, implied warranties or conditions of merchantability, 
              fitness for a particular purpose, or non-infringement of intellectual property or other 
              violation of rights.
            </p>

            <h2>4. Limitations</h2>
            <p>
              In no event shall BetterPrompts or its suppliers be liable for any damages (including, 
              without limitation, damages for loss of data or profit, or due to business interruption) 
              arising out of the use or inability to use BetterPrompts.
            </p>

            <h2>5. Privacy</h2>
            <p>
              Your use of BetterPrompts is also governed by our Privacy Policy. Please review our 
              Privacy Policy, which also governs the Site and informs users of our data collection 
              practices.
            </p>

            <p className="text-sm text-muted-foreground mt-8">
              This is a placeholder Terms of Service page. In a production environment, this would 
              contain comprehensive legal terms reviewed by legal counsel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
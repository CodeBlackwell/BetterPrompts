import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: July 22, 2025</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h2>1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account, 
              use our services, or contact us for support.
            </p>

            <h2>2. How We Use Your Information</h2>
            <p>
              We use the information we collect to provide, maintain, and improve our services, 
              process transactions, send you technical notices and support messages, and respond 
              to your comments and questions.
            </p>

            <h2>3. Information Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties. 
              This does not include trusted third parties who assist us in operating our website, 
              conducting our business, or servicing you.
            </p>

            <h2>4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect the security 
              of your personal information against unauthorized access, alteration, disclosure, or 
              destruction.
            </p>

            <h2>5. Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal information. You can 
              do this by logging into your account settings or contacting us directly.
            </p>

            <h2>6. Cookies</h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our service 
              and hold certain information to improve your experience.
            </p>

            <h2>7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at 
              privacy@betterprompts.io
            </p>

            <p className="text-sm text-muted-foreground mt-8">
              This is a placeholder Privacy Policy page. In a production environment, this would 
              contain comprehensive privacy terms reviewed by legal counsel and comply with GDPR, 
              CCPA, and other applicable privacy regulations.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
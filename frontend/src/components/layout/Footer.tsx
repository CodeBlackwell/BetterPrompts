'use client'

import Link from 'next/link'
import { Sparkles, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import Container from './Container'
import { cn } from '@/lib/utils'

const footerLinks = {
  Product: [
    { label: 'Features', href: '/features' },
    { label: 'Techniques', href: '/techniques' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Changelog', href: '/changelog' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/api' },
    { label: 'Blog', href: '/blog' },
    { label: 'Community', href: '/community' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
  Connect: [
    { label: 'Twitter', href: 'https://twitter.com' },
    { label: 'GitHub', href: 'https://github.com' },
    { label: 'Discord', href: 'https://discord.com' },
    { label: 'Contact', href: '/contact' },
  ],
}

export default function Footer() {
  const [expandedSections, setExpandedSections] = useState<string[]>([])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  return (
    <footer className="mt-auto border-t bg-gray-50" role="contentinfo">
      <Container>
        <div className="py-8 sm:py-12">
          {/* Footer content grid */}
          {/* Mobile-friendly accordion for small screens */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-5 md:gap-8">
            {/* Brand section */}
            <div className="col-span-1 sm:col-span-2 md:col-span-1">
              <Link 
                href="/" 
                className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
              >
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
                <span>BetterPrompts</span>
              </Link>
              <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600">
                Making advanced prompt engineering accessible to everyone.
              </p>
            </div>

            {/* Links sections - collapsible on mobile */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title} className="border-b border-gray-200 pb-4 md:border-0 md:pb-0">
                <button
                  onClick={() => toggleSection(title)}
                  className="flex w-full items-center justify-between text-sm font-semibold text-gray-900 md:cursor-default md:pointer-events-none"
                  aria-expanded={expandedSections.includes(title)}
                  aria-controls={`footer-${title}`}
                >
                  {title}
                  <ChevronDown 
                    className={cn(
                      "h-4 w-4 transition-transform md:hidden",
                      expandedSections.includes(title) && "rotate-180"
                    )}
                  />
                </button>
                <ul 
                  id={`footer-${title}`}
                  className={cn(
                    "mt-4 space-y-2 md:space-y-3",
                    "md:block",
                    expandedSections.includes(title) ? "block" : "hidden"
                  )}
                >
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block py-1 text-xs sm:text-sm text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                        {...(link.href.startsWith('http') && {
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          'aria-label': `${link.label} (opens in new tab)`
                        })}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom section */}
          <div className="mt-8 sm:mt-12 border-t pt-6 sm:pt-8">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
              <p className="text-xs sm:text-sm text-gray-600">
                © {new Date().getFullYear()} BetterPrompts. All rights reserved.
              </p>
              <div className="flex gap-4 sm:gap-6">
                <Link
                  href="/privacy"
                  className="text-xs sm:text-sm text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="text-xs sm:text-sm text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                >
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  )
}
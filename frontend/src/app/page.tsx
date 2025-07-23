'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight } from 'lucide-react'
import Container from '@/components/layout/Container'
import { ViewportLazyLoad, SkeletonLoader } from '@/components/utils/LazyLoad'

// Lazy load heavy components
const HeroSection = dynamic(() => import('@/components/home/HeroSection'), {
  loading: () => <div className="h-96 animate-pulse bg-gray-50" />,
})

const FeaturesSection = dynamic(() => import('@/components/home/FeaturesSection'), {
  loading: () => <SkeletonLoader type="card" />,
  ssr: true,
})

const CTASection = dynamic(() => import('@/components/home/CTASection'), {
  loading: () => <SkeletonLoader type="default" />,
  ssr: true,
})

export default function Home() {
  return (
    <>
      {/* Hero Section - Load immediately */}
      <HeroSection />

      {/* Features Section - Lazy load when in viewport */}
      <ViewportLazyLoad fallback={<SkeletonLoader type="card" />}>
        <FeaturesSection />
      </ViewportLazyLoad>

      {/* CTA Section - Lazy load when in viewport */}
      <ViewportLazyLoad fallback={<SkeletonLoader type="default" />}>
        <CTASection />
      </ViewportLazyLoad>
    </>
  )
}
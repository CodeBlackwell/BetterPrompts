'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Container from '@/components/layout/Container'

const techniques = [
  'Chain of Thought',
  'Tree of Thoughts',
  'Few-shot Learning',
  'Zero-shot CoT',
  'Self-Consistency',
  'Constitutional AI',
]

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      <Container>
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              Prompt Engineering
              <span className="block gradient-text">Made Simple</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600 sm:text-xl">
              Transform your ideas into optimized prompts with AI-powered suggestions. 
              No expertise required - we handle the complexity for you.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/enhance"
                className="btn-primary text-base px-8 py-3"
              >
                Start Enhancing
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/docs"
                className="btn-secondary text-base px-8 py-3"
              >
                Learn More
              </Link>
            </div>
          </motion.div>

          {/* Technique Pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="mt-16">
              <p className="mb-4 text-sm font-medium text-gray-500">
                Powered by advanced techniques:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {techniques.map((technique, index) => (
                  <motion.span
                    key={technique}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                  >
                    <span className="inline-block rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                      {technique}
                    </span>
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Container>

      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[50%] top-0 h-[500px] w-[500px] -translate-x-[50%] rounded-full bg-gradient-to-br from-blue-100 to-purple-100 opacity-20 blur-3xl" />
      </div>
    </section>
  )
}
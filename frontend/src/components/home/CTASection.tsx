'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Container from '@/components/layout/Container'

export default function CTASection() {
  return (
    <section className="py-20 sm:py-32">
      <Container>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 px-8 py-16 text-center text-white sm:px-16 sm:py-20">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Ready to Transform Your Prompts?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-blue-100">
              Join thousands of users who are already creating better prompts with less effort.
            </p>
            <Link
              href="/enhance"
              className="inline-flex items-center rounded-lg bg-white px-8 py-3 text-base font-medium text-blue-600 transition-colors hover:bg-gray-100"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>

            {/* Background decoration */}
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          </div>
        </motion.div>
      </Container>
    </section>
  )
}
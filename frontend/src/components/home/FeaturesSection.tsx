'use client'

import { motion } from 'framer-motion'
import { Brain, Zap, Shield, Users, BarChart3, Sparkles } from 'lucide-react'
import Container from '@/components/layout/Container'

const features = [
  {
    icon: Brain,
    title: 'Intelligent Analysis',
    description: 'Our AI analyzes your input to understand intent, complexity, and optimal techniques.',
  },
  {
    icon: Zap,
    title: 'Instant Enhancement',
    description: 'Get enhanced prompts in seconds with state-of-the-art prompt engineering techniques.',
  },
  {
    icon: Shield,
    title: 'Enterprise Ready',
    description: 'Built with security, compliance, and scalability for enterprise deployments.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Share prompt libraries, templates, and best practices across your organization.',
  },
  {
    icon: BarChart3,
    title: 'Performance Tracking',
    description: 'Monitor effectiveness and continuously improve your prompt strategies.',
  },
  {
    icon: Sparkles,
    title: 'Always Learning',
    description: 'Our models continuously improve based on user feedback and latest research.',
  },
]

export default function FeaturesSection() {
  return (
    <section className="py-20 sm:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Everything You Need
          </h2>
          <p className="text-lg text-gray-600">
            Comprehensive tools and features to elevate your prompting game
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="card group">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}
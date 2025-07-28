'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import Container from '@/components/layout/Container'
import { cn } from '@/lib/utils'

export default function AnonymousEnhanceSection() {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [enhancedOutput, setEnhancedOutput] = useState('')
  const [error, setError] = useState('')
  const [techniques, setTechniques] = useState<string[]>([])
  const [validationError, setValidationError] = useState('')
  
  // Match backend validation limits
  const MIN_LENGTH = 1
  const MAX_LENGTH = 5000

  const validatePrompt = (text: string): boolean => {
    const trimmed = text.trim()
    
    if (trimmed.length < MIN_LENGTH) {
      setValidationError('Please enter a prompt to enhance')
      return false
    }
    
    if (trimmed.length > MAX_LENGTH) {
      setValidationError(`Prompt must be less than ${MAX_LENGTH} characters`)
      return false
    }
    
    setValidationError('')
    return true
  }

  const handleEnhance = async () => {
    if (!validatePrompt(prompt)) return
    
    setIsLoading(true)
    setError('')
    setEnhancedOutput('')
    
    try {
      // Check if we should simulate an error (for testing)
      if (typeof window !== 'undefined' && (window as any).__simulateError) {
        throw new Error('Network error')
      }
      
      // TODO: Replace with actual API call
      // Simulate API delay (reduced for performance tests)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Mock response
      setEnhancedOutput(`Enhanced version of: "${prompt}"\n\nUsing advanced prompting techniques, this prompt has been optimized for better AI responses...`)
      setTechniques(['Chain of Thought', 'Few-shot Learning'])
    } catch (err) {
      setError('An error occurred while enhancing your prompt. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const characterCount = prompt.length

  return (
    <section data-testid="homepage-enhance-section" className="py-20 sm:py-32 bg-gray-50">
      <Container>
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4 sm:text-4xl">
              Try It Now - No Sign Up Required
            </h2>
            <p className="text-lg text-gray-600">
              Experience the power of AI-enhanced prompts instantly
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8">
              {/* Input Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Enter your prompt
                </label>
                <textarea
                  data-testid="anonymous-prompt-input"
                  value={prompt}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setPrompt(newValue);
                    // Clear validation error when user types
                    if (validationError && newValue.trim()) {
                      validatePrompt(newValue);
                    }
                  }}
                  placeholder="Type your prompt here..."
                  className={cn(
                    "w-full h-32 px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2",
                    validationError ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"
                  )}
                  maxLength={MAX_LENGTH + 100}
                  disabled={isLoading}
                />
                <div className="mt-2 flex justify-between items-center">
                  {validationError && (
                    <div className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {validationError}
                    </div>
                  )}
                  <span data-testid="anonymous-character-count" className={cn(
                    "text-sm ml-auto",
                    characterCount > MAX_LENGTH ? "text-red-500 font-medium" : "text-gray-500"
                  )}>
                    {characterCount}/{MAX_LENGTH}
                  </span>
                </div>
              </div>

              {/* Enhance Button */}
              <button
                data-testid="anonymous-enhance-button"
                onClick={handleEnhance}
                disabled={!prompt.trim() || isLoading || !!validationError}
                className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 data-testid="anonymous-loading-spinner" className="animate-spin h-5 w-5 mr-2" />
                    <span data-testid="loading-message">Enhancing...</span>
                  </>
                ) : (
                  <>
                    Enhance Prompt
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>

              {/* Error Message */}
              {error && (
                <div data-testid="error-message" className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
                  {error}
                  <button
                    data-testid="retry-button"
                    onClick={handleEnhance}
                    className="ml-2 underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Output Section */}
              {enhancedOutput && (
                <div data-testid="anonymous-output-container" className="mt-6">
                  <h3 className="font-semibold mb-3">Enhanced Prompt</h3>
                  <div
                    data-testid="anonymous-enhanced-output"
                    className="p-4 bg-gray-50 rounded-lg mb-4"
                  >
                    {enhancedOutput}
                  </div>
                  
                  {/* Techniques Used */}
                  <div className="mb-4">
                    <p data-testid="technique-explanation" className="text-sm text-gray-600 mb-2">
                      This enhancement uses the following techniques:
                    </p>
                    <ul data-testid="applied-techniques" className="flex flex-wrap gap-2">
                      {techniques.map((technique) => (
                        <li
                          key={technique}
                          className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                        >
                          {technique}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Copy Button */}
                  <button
                    data-testid="anonymous-copy-button"
                    onClick={() => navigator.clipboard.writeText(enhancedOutput)}
                    className="btn-secondary"
                  >
                    Copy to Clipboard
                  </button>

                  {/* Sign Up CTA */}
                  <div data-testid="signup-cta" className="mt-6 p-4 bg-blue-50 rounded-lg text-center">
                    <p className="text-sm text-gray-700 mb-2">
                      Want to save your prompts and access advanced features?
                    </p>
                    <a
                      data-testid="learn-more-link"
                      href="/register"
                      className="text-blue-600 font-medium hover:underline"
                    >
                      Sign up for free →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  )
}
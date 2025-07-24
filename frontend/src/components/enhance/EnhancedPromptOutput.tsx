'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, RefreshCw, Sparkles, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface EnhancedPromptOutputProps {
  enhancedPrompt: string
  originalPrompt?: string
  techniqueUsed?: string
  className?: string
  onRegenerate?: () => void
  showComparison?: boolean
}

export default function EnhancedPromptOutput({
  enhancedPrompt,
  originalPrompt,
  techniqueUsed,
  className,
  onRegenerate,
  showComparison = false
}: EnhancedPromptOutputProps) {
  const [copied, setCopied] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(enhancedPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const calculateImprovement = () => {
    if (!originalPrompt) return 0
    // Simple metric: character count increase as a percentage
    const improvement = ((enhancedPrompt.length - originalPrompt.length) / originalPrompt.length) * 100
    return Math.round(improvement)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={className}
    >
      <Card className="overflow-hidden border-green-200 bg-gradient-to-br from-green-50/50 to-blue-50/50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Sparkles className="h-5 w-5 text-green-600" />
                Enhanced Prompt
              </CardTitle>
              <CardDescription>
                Your optimized prompt is ready to use
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {techniqueUsed && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {techniqueUsed.replace(/_/g, ' ')}
                </Badge>
              )}
              {originalPrompt && (
                <Badge variant="outline" className="text-xs">
                  +{calculateImprovement()}% enhanced
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Enhanced Prompt Display */}
          <div className="relative">
            <div className="rounded-lg bg-white/80 backdrop-blur border border-gray-200 p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm sm:text-base text-gray-800 leading-relaxed">
                {enhancedPrompt}
              </pre>
            </div>
            
            {/* Copy button overlay */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="absolute top-2 right-2 h-8 px-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Original Prompt Comparison */}
          {showComparison && originalPrompt && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  {showOriginal ? 'Hide' : 'Show'} original prompt
                </Button>
                
                {showOriginal && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg bg-gray-50 border border-gray-200 p-4"
                  >
                    <p className="text-xs font-medium text-gray-500 mb-2">Original:</p>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-600">
                      {originalPrompt}
                    </pre>
                  </motion.div>
                )}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleCopy}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Enhanced Prompt
            </Button>
            
            {onRegenerate && (
              <Button
                onClick={onRegenerate}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Another Technique
              </Button>
            )}
          </div>

          {/* Tips */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong className="font-semibold">Pro tip:</strong> This enhanced prompt includes 
              {techniqueUsed?.includes('chain') && ' step-by-step reasoning'}
              {techniqueUsed?.includes('few_shot') && ' examples to guide the AI'}
              {techniqueUsed?.includes('tree') && ' multiple perspectives'}
              {techniqueUsed?.includes('role') && ' role-based context'}
              {!techniqueUsed && ' optimizations'} for better results.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
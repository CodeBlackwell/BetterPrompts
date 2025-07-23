'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, ChevronDown, AlertCircle, WifiOff, X, RefreshCw } from 'lucide-react'
import TechniqueCard from './TechniqueCard'
import TechniqueCardSkeleton from './TechniqueCardSkeleton'
import StreamingProgress, { ENHANCEMENT_STEPS, StreamingStep } from './StreamingProgress'
import { cn } from '@/lib/utils'
import { useEnhance, useTechniques } from '@/hooks/useEnhance'
import { useApiStatus } from '@/hooks/useApiStatus'
import { useEnhanceStore } from '@/store/useEnhanceStore'
import { Technique } from '@/lib/api/enhance'
import { ErrorState, NetworkError } from '@/components/ui/error-states'
import { PageLoader, Skeleton } from '@/components/ui/loading-states'
import { KeyboardIndicator, LiveRegion } from '@/components/ui/accessibility'
import { FeedbackButton, QuickFeedback } from '@/components/feedback/FeedbackButton'

interface EnhancementFlowProps {
  className?: string
  onComplete?: (result: { prompt: string, technique: string }) => void
}

export default function EnhancementFlow({ className, onComplete }: EnhancementFlowProps) {
  const [userInput, setUserInput] = useState('')
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null)
  const [showTechniques, setShowTechniques] = useState(false)
  const [techniques, setTechniques] = useState<Technique[]>([])
  const [promptHistoryId, setPromptHistoryId] = useState<string | null>(null)
  const [enhancedTechniques, setEnhancedTechniques] = useState<string[]>([])
  
  // Store state
  const {
    streaming,
    setCurrentInput,
    setCurrentOutput,
    updateStreamingStep,
    completeStreamingStep,
    setStreamingError,
    updateStreamingData,
    resetStreaming,
    setIsEnhancing
  } = useEnhanceStore()
  
  // API hooks
  const { enhance, isLoading: isEnhancing, error: enhanceError } = useEnhance()
  const { fetchTechniques, isLoading: loadingTechniques, error: techniquesError } = useTechniques()
  const { isConnected, isChecking } = useApiStatus()

  // Load techniques on mount
  useEffect(() => {
    fetchTechniques().then(techs => {
      setTechniques(techs)
    }).catch(err => {
      console.error('Failed to load techniques:', err)
    })
  }, [fetchTechniques])

  // Simulate streaming progress (will be replaced with real WebSocket/SSE)
  const simulateStreamingProgress = useCallback(async () => {
    const steps = ENHANCEMENT_STEPS
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      updateStreamingStep(step, 0)
      
      // Simulate progress for each step
      const duration = 1500 + Math.random() * 1000 // 1.5-2.5s per step
      const progressInterval = setInterval(() => {
        updateStreamingStep(step, Math.min(100, Math.random() * 100))
      }, 100)
      
      await new Promise(resolve => setTimeout(resolve, duration))
      clearInterval(progressInterval)
      
      completeStreamingStep(step)
      
      // Simulate streaming data updates
      if (step === 'classifying_intent') {
        updateStreamingData({ intent: 'creative_writing' })
      } else if (step === 'selecting_techniques') {
        updateStreamingData({ techniques: ['chain_of_thought', 'few_shot'] })
      }
    }
    
    updateStreamingStep('complete', 100)
  }, [updateStreamingStep, completeStreamingStep, updateStreamingData])

  const handleEnhance = async () => {
    if (!userInput.trim() || !isConnected) return

    setShowTechniques(true)
    setCurrentInput(userInput)
    setIsEnhancing(true)
    resetStreaming()
    
    // Start streaming simulation
    const streamingPromise = simulateStreamingProgress()
    
    try {
      const response = await enhance({
        input: userInput,
        technique: selectedTechnique || undefined,
        options: {
          explanation: true
        }
      })

      if (response) {
        await streamingPromise // Wait for streaming to complete
        setCurrentOutput(response.enhanced.prompt)
        
        // Store data for feedback
        if (response.history_id) {
          setPromptHistoryId(response.history_id)
        }
        if (response.techniques_used) {
          setEnhancedTechniques(response.techniques_used)
        }
        
        if (onComplete) {
          onComplete({
            prompt: response.enhanced.prompt,
            technique: response.enhanced.technique
          })
        }
      }
    } catch (error) {
      setStreamingError(error instanceof Error ? error.message : 'Enhancement failed')
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleCancelEnhancement = () => {
    // In a real implementation, this would cancel the WebSocket/SSE connection
    resetStreaming()
    setIsEnhancing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && !streaming.currentStep) {
      handleEnhance()
    }
  }

  const isStreaming = streaming.currentStep !== null && streaming.currentStep !== 'complete' && streaming.currentStep !== 'error'

  return (
    <div className={cn("space-y-6", className)}>
      {/* Connection Status Banner */}
      <AnimatePresence>
        {!isConnected && !isChecking && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center">
              <WifiOff className="h-5 w-5 text-orange-500 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-orange-800 font-medium">Connection Issue</p>
                <p className="text-xs text-orange-600 mt-1">
                  Unable to connect to the server. Please check your internet connection.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Section */}
      <div className={cn("transition-opacity", isStreaming && "opacity-50 pointer-events-none")}>
        <div className="relative">
          <label htmlFor="user-input" className="sr-only">
            Enter your prompt
          </label>
          <textarea
            id="user-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt here... (e.g., 'Help me write a blog post about sustainable living')"
            className="w-full min-h-[120px] sm:min-h-[150px] p-3 sm:p-4 pr-12 text-sm sm:text-base border rounded-xl resize-none transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            disabled={isStreaming}
            aria-label="Prompt input"
            aria-describedby="prompt-helper"
          />
          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex items-center gap-2">
            <KeyboardIndicator keys={['Ctrl', 'Enter']} className="text-xs text-gray-400">
              <span className="hidden sm:inline">Submit</span>
            </KeyboardIndicator>
          </div>
        </div>
        
        <div id="prompt-helper" className="sr-only">
          Press Control + Enter to submit your prompt for enhancement
        </div>
        
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-between">
          <button
            onClick={handleEnhance}
            disabled={!userInput.trim() || isStreaming || !isConnected}
            className={cn(
              "btn-primary w-full sm:w-auto justify-center",
              (isStreaming || !isConnected) && "cursor-not-allowed opacity-50"
            )}
            aria-busy={isStreaming}
          >
            {!isConnected ? (
              <>
                <WifiOff className="mr-2 h-4 w-4" />
                Offline
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Enhance Prompt
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowTechniques(!showTechniques)}
            className="btn-ghost text-sm w-full sm:w-auto justify-center"
            disabled={isStreaming}
            aria-expanded={showTechniques}
            aria-controls="techniques-section"
          >
            <span className="mr-2">Techniques</span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform duration-200",
              showTechniques && "rotate-180"
            )} />
          </button>
        </div>
      </div>

      {/* Streaming Progress */}
      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative">
            <StreamingProgress
              currentStep={streaming.currentStep!}
              progress={streaming.stepProgress}
              error={streaming.error || undefined}
              completedSteps={streaming.completedSteps}
              estimatedTimeRemaining={streaming.estimatedTimeRemaining}
              showDetails={true}
            />
            
            {/* Cancel button */}
            <button
              onClick={handleCancelEnhancement}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Cancel enhancement"
            >
              <X className="h-4 w-4" />
            </button>
            
            {/* Streaming Data Display */}
            {streaming.streamingData && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {streaming.streamingData.intent && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Detected Intent:</span> {streaming.streamingData.intent}
                  </p>
                )}
                {streaming.streamingData.techniques && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Selected Techniques:</span>{' '}
                    {streaming.streamingData.techniques.join(', ')}
                  </p>
                )}
                </div>
              </motion.div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Techniques Section */}
      <AnimatePresence>
        {showTechniques && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div id="techniques-section" className="overflow-hidden">
              <div className="space-y-4">
              {/* Loading state */}
              {loadingTechniques && (
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <TechniqueCardSkeleton key={i} />
                  ))}
                </div>
              )}
              
              {/* Error state */}
              {techniquesError && (
                <ErrorState
                  title="Failed to load techniques"
                  message={techniquesError}
                  onRetry={() => {
                    fetchTechniques().then(techs => {
                      setTechniques(techs)
                    })
                  }}
                  variant="card"
                />
              )}
              
              {/* Techniques grid */}
              {!loadingTechniques && !techniquesError && techniques.length > 0 && (
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {techniques.map((technique) => (
                    <TechniqueCard
                      key={technique.id}
                      technique={{
                        id: technique.id,
                        name: technique.name,
                        description: technique.description,
                        confidence: technique.effectiveness.overall
                      }}
                      isSelected={selectedTechnique === technique.id}
                      onClick={() => setSelectedTechnique(technique.id)}
                    />
                  ))}
                </div>
              )}
              
              {/* Live region for screen reader announcements */}
              <LiveRegion priority="polite">
                {selectedTechnique && `Selected technique: ${techniques.find(t => t.id === selectedTechnique)?.name}`}
              </LiveRegion>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success State */}
      <AnimatePresence>
        {streaming.currentStep === 'complete' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-start">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-green-900">Enhancement Complete!</h3>
                <p className="text-xs sm:text-sm text-green-700 mt-1">
                  Your prompt has been successfully enhanced. The result is ready to use.
                </p>
                
                {/* Feedback section */}
                {promptHistoryId && (
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <QuickFeedback promptHistoryId={promptHistoryId} />
                    <FeedbackButton
                      promptHistoryId={promptHistoryId}
                      techniques={enhancedTechniques}
                      size="sm"
                      variant="outline"
                    />
                  </div>
                )}
              </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
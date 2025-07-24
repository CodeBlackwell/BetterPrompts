import { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { promptService, EnhanceRequest, EnhanceResponse, AnalyzeRequest, AnalyzeResponse, Technique } from '@/lib/api/services'
import { useToast } from '@/components/ui/use-toast'
import { apiCache, cacheKeys, hashText } from '@/lib/api/cache'

export function useEnhancement() {
  const { toast } = useToast()
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([])

  // Analyze prompt mutation with caching
  const analyzeMutation = useMutation<AnalyzeResponse, Error, AnalyzeRequest>({
    mutationFn: async (data) => {
      // Check cache first
      const cacheKey = cacheKeys.analysis(hashText(data.text))
      const cached = apiCache.get<AnalyzeResponse>(cacheKey)
      if (cached) return cached

      // Make request
      const result = await promptService.analyze(data)
      
      // Cache result
      apiCache.set(cacheKey, result, 5 * 60 * 1000) // 5 minutes
      
      return result
    },
    onSuccess: (data) => {
      // Auto-select suggested techniques
      if (data.suggested_techniques?.length > 0) {
        setSelectedTechniques(data.suggested_techniques)
      }
    },
    onError: (error) => {
      toast({
        title: 'Analysis failed',
        description: error.message || 'Failed to analyze prompt',
        variant: 'destructive',
      })
    },
  })

  // Enhance prompt mutation with caching
  const enhanceMutation = useMutation<EnhanceResponse, Error, EnhanceRequest>({
    mutationFn: async (data) => {
      // Check cache first
      const cacheKey = cacheKeys.enhancement(
        hashText(data.text), 
        data.techniques || []
      )
      const cached = apiCache.get<EnhanceResponse>(cacheKey)
      if (cached) return cached

      // Make request
      const result = await promptService.enhance(data)
      
      // Cache result
      apiCache.set(cacheKey, result, 10 * 60 * 1000) // 10 minutes
      
      return result
    },
    onError: (error) => {
      toast({
        title: 'Enhancement failed',
        description: error.message || 'Failed to enhance prompt',
        variant: 'destructive',
      })
    },
  })

  // Get available techniques with React Query caching
  const techniquesQuery = useQuery<Technique[], Error>({
    queryKey: ['techniques'],
    queryFn: promptService.getTechniques,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  })

  // Combined function to analyze and enhance
  const analyzeAndEnhance = useCallback(async (text: string, options?: {
    intent?: string
    complexity?: 'simple' | 'moderate' | 'complex'
    target_model?: string
    techniques?: string[]
    autoEnhance?: boolean
  }) => {
    try {
      // First analyze the prompt
      const analyzeResult = await analyzeMutation.mutateAsync({
        text,
        context: options,
      })

      // If autoEnhance is true, automatically enhance with suggested techniques
      if (options?.autoEnhance !== false) {
        const enhanceResult = await enhanceMutation.mutateAsync({
          text,
          intent: options?.intent || analyzeResult.intent,
          complexity: options?.complexity || analyzeResult.complexity as any,
          target_model: options?.target_model || 'gpt-4',
          techniques: options?.techniques || analyzeResult.suggested_techniques,
          context: {
            ...options,
            analysis_metadata: analyzeResult.metadata,
          },
        })

        return {
          analysis: analyzeResult,
          enhancement: enhanceResult,
        }
      }

      return {
        analysis: analyzeResult,
        enhancement: null,
      }
    } catch (error) {
      // Error is already handled by the mutations
      throw error
    }
  }, [analyzeMutation, enhanceMutation])

  // Function to enhance with custom techniques
  const enhanceWithTechniques = useCallback(async (text: string, techniques: string[], options?: {
    intent?: string
    complexity?: 'simple' | 'moderate' | 'complex'
    target_model?: string
  }) => {
    return enhanceMutation.mutateAsync({
      text,
      techniques,
      intent: options?.intent,
      complexity: options?.complexity,
      target_model: options?.target_model || 'gpt-4',
    })
  }, [enhanceMutation])

  // Function to toggle technique selection
  const toggleTechnique = useCallback((techniqueId: string) => {
    setSelectedTechniques(prev => 
      prev.includes(techniqueId)
        ? prev.filter(id => id !== techniqueId)
        : [...prev, techniqueId]
    )
  }, [])

  // Function to clear all selections
  const clearTechniques = useCallback(() => {
    setSelectedTechniques([])
  }, [])

  // Function to clear cache
  const clearCache = useCallback((pattern?: string) => {
    apiCache.clear(pattern)
    // Also invalidate React Query cache
    if (pattern?.includes('technique')) {
      techniquesQuery.refetch()
    }
  }, [techniquesQuery])

  return {
    // State
    selectedTechniques,
    setSelectedTechniques,
    
    // Queries
    techniques: techniquesQuery.data || [],
    techniquesLoading: techniquesQuery.isLoading,
    techniquesError: techniquesQuery.error,
    
    // Mutations
    analyzeMutation,
    enhanceMutation,
    
    // Combined functions
    analyzeAndEnhance,
    enhanceWithTechniques,
    
    // UI helpers
    toggleTechnique,
    clearTechniques,
    clearCache,
    
    // Loading states
    isAnalyzing: analyzeMutation.isPending,
    isEnhancing: enhanceMutation.isPending,
    isProcessing: analyzeMutation.isPending || enhanceMutation.isPending,
    
    // Cache stats (for debugging)
    cacheStats: apiCache.stats(),
  }
}
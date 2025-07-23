'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { historyService } from '@/lib/api/services'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Copy, Download, Trash2, Star, Calendar, Clock, Hash, Zap, Target, Brain } from 'lucide-react'
// Using native date formatting instead of date-fns

export default function HistoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  
  const [historyItem, setHistoryItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchHistoryItem()
  }, [id])

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const fetchHistoryItem = async () => {
    try {
      setLoading(true)
      setError(null)
      const item = await historyService.getHistoryItem(id)
      setHistoryItem(item)
    } catch (err: any) {
      setError(err.message || 'Failed to load history item')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this prompt? This action cannot be undone.')) {
      return
    }

    try {
      setDeleting(true)
      await historyService.deleteHistoryItem(id)
      setToastMessage({
        type: 'success',
        message: 'Prompt deleted successfully'
      })
      
      // Navigate back to history list after short delay
      setTimeout(() => {
        router.push('/history')
      }, 1000)
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        message: err.message || 'Failed to delete prompt'
      })
      setDeleting(false)
    }
  }

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setToastMessage({
      type: 'success',
      message: `${type} copied to clipboard`
    })
  }

  const handleExport = () => {
    if (!historyItem) return
    
    const exportData = {
      id: historyItem.id,
      created_at: historyItem.created_at,
      original_prompt: historyItem.original_input,
      enhanced_prompt: historyItem.enhanced_output,
      intent: historyItem.intent,
      complexity: historyItem.complexity,
      techniques: historyItem.techniques_used,
      confidence: historyItem.confidence,
      metadata: historyItem.metadata
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prompt-${historyItem.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    setToastMessage({
      type: 'success',
      message: 'Prompt exported successfully'
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/history')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to History
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!historyItem) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/history')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to History
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Prompt Details</h1>
            <p className="text-muted-foreground">
              View and manage your enhanced prompt
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              title="Export prompt"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete prompt"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{historyItem.intent || 'Unknown Intent'}</CardTitle>
              <CardDescription className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(historyItem.created_at).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(historyItem.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </CardDescription>
            </div>
            
            {historyItem.is_favorite && (
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Original Prompt */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold">Original Prompt</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(historyItem.original_input, 'Original prompt')}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{historyItem.original_input}</p>
            </div>
          </div>

          {/* Enhanced Prompt */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold">Enhanced Prompt</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(historyItem.enhanced_output, 'Enhanced prompt')}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <p className="text-sm whitespace-pre-wrap">{historyItem.enhanced_output}</p>
            </div>
          </div>

          {/* Metadata Section */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Analysis Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Intent */}
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Intent</p>
                  <p className="text-sm font-medium">{historyItem.intent || 'Not specified'}</p>
                </div>
              </div>

              {/* Complexity */}
              <div className="flex items-center gap-3">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Complexity</p>
                  <p className="text-sm font-medium capitalize">{historyItem.complexity || 'Not specified'}</p>
                </div>
              </div>

              {/* Confidence */}
              {historyItem.confidence !== undefined && (
                <div className="flex items-center gap-3">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-sm font-medium">{Math.round(historyItem.confidence * 100)}%</p>
                  </div>
                </div>
              )}

              {/* Processing Time */}
              {historyItem.processing_time_ms !== undefined && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Processing Time</p>
                    <p className="text-sm font-medium">{historyItem.processing_time_ms}ms</p>
                  </div>
                </div>
              )}

              {/* Token Count */}
              {historyItem.token_count !== undefined && (
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Token Count</p>
                    <p className="text-sm font-medium">{historyItem.token_count}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Techniques Used */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Techniques Applied</h3>
            <div className="flex flex-wrap gap-2">
              {historyItem.techniques_used.map((technique: string) => (
                <Badge key={technique} variant="secondary">
                  {technique.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Badge>
              ))}
            </div>
          </div>

          {/* Feedback Section */}
          {(historyItem.feedback_score || historyItem.feedback_text) && (
            <div>
              <h3 className="text-sm font-semibold mb-3">User Feedback</h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                {historyItem.feedback_score && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= historyItem.feedback_score
                              ? 'text-yellow-500 fill-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {historyItem.feedback_text && (
                  <p className="text-sm">{historyItem.feedback_text}</p>
                )}
              </div>
            </div>
          )}

          {/* Additional Metadata */}
          {historyItem.metadata && Object.keys(historyItem.metadata).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Additional Information</h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(historyItem.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert className={toastMessage.type === 'error' ? 'border-red-500' : 'border-green-500'}>
            <AlertDescription>{toastMessage.message}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
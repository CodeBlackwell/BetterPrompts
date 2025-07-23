'use client'

import { useState, useEffect, useCallback } from 'react'
import { historyService, PromptHistoryItem, HistoryFilters } from '@/lib/api/history'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, Filter, Trash2, ChevronLeft, ChevronRight, Copy, ExternalLink, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function HistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<PromptHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<HistoryFilters>({
    page: 1,
    limit: 20
  })
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIntent, setSelectedIntent] = useState<string>('all')
  const [selectedTechnique, setSelectedTechnique] = useState<string>('all')
  
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Fetch history data
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await historyService.getHistory({
        ...filters,
        search: searchQuery || undefined,
        intent: selectedIntent !== 'all' ? selectedIntent : undefined,
        technique: selectedTechnique !== 'all' ? selectedTechnique : undefined
      })
      
      setHistory(response.items)
      setTotalItems(response.total)
      setHasMore(response.has_more)
    } catch (err: any) {
      setError(err.message || 'Failed to load history')
      setToastMessage({
        type: 'error',
        message: err.message || 'Failed to load history'
      })
    } finally {
      setLoading(false)
    }
  }, [filters, searchQuery, selectedIntent, selectedTechnique])

  // Initial load and when filters change
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Auto-hide toast message
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== filters.search) {
        setFilters(prev => ({ ...prev, search: searchQuery, page: 1 }))
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [searchQuery, filters.search])

  // Delete history item
  const handleDelete = async (id: string) => {
    try {
      await historyService.deleteHistoryItem(id)
      setToastMessage({
        type: 'success',
        message: 'History item deleted successfully'
      })
      
      // Refresh the list
      fetchHistory()
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        message: err.message || 'Failed to delete item'
      })
    }
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setToastMessage({
      type: 'success',
      message: 'Prompt copied to clipboard'
    })
  }

  // Get unique intents and techniques for filters
  const uniqueIntents = Array.from(new Set(history.map(item => item.intent).filter(Boolean)))
  const uniqueTechniques = Array.from(new Set(history.flatMap(item => item.techniques_used)))

  const totalPages = Math.ceil(totalItems / (filters.limit || 20))

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prompt History</h1>
        <p className="text-muted-foreground">
          View and manage your enhanced prompts
        </p>
      </div>

      {/* Filters Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <select
              value={selectedIntent}
              onChange={(e) => setSelectedIntent(e.target.value)}
              className="flex h-10 w-full sm:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">All intents</option>
              {uniqueIntents.map(intent => (
                <option key={intent} value={intent!}>
                  {intent}
                </option>
              ))}
            </select>
            
            <select
              value={selectedTechnique}
              onChange={(e) => setSelectedTechnique(e.target.value)}
              className="flex h-10 w-full sm:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">All techniques</option>
              {uniqueTechniques.map(technique => (
                <option key={technique} value={technique}>
                  {technique}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* History Items */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full mb-4" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery || selectedIntent !== 'all' || selectedTechnique !== 'all' 
                ? 'No prompts found matching your filters' 
                : 'No prompts in your history yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <Card 
              key={item.id} 
              className="relative hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={(e) => {
                // Don't navigate if clicking on a button
                if ((e.target as HTMLElement).closest('button')) return
                router.push(`/history/${item.id}`)
              }}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {item.intent || 'Unknown Intent'}
                    </CardTitle>
                    <CardDescription>
                      {new Date(item.created_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/history/${item.id}`)}
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(item.enhanced_output)}
                      title="Copy enhanced prompt"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Original Prompt:</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {item.original_input}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-1">Enhanced Prompt:</p>
                  <p className="text-sm bg-primary/5 p-3 rounded">
                    {item.enhanced_output}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 text-xs">
                  {item.techniques_used.map((technique) => (
                    <span
                      key={technique}
                      className="px-2 py-1 bg-secondary rounded-full"
                    >
                      {technique}
                    </span>
                  ))}
                  {item.complexity && (
                    <span className="px-2 py-1 bg-muted rounded-full">
                      {item.complexity} complexity
                    </span>
                  )}
                  {item.confidence && (
                    <span className="px-2 py-1 bg-muted rounded-full">
                      {Math.round(item.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Showing {(((filters.page || 1) - 1) * (filters.limit || 20)) + 1} - {Math.min((filters.page || 1) * (filters.limit || 20), totalItems)} of {totalItems}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
              disabled={(filters.page || 1) === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
              disabled={!hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

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
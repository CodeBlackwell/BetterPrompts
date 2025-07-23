'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { adminService, promptService } from '@/lib/api/services'
import { 
  Activity, TrendingUp, Users, Zap, Target, Brain, 
  Calendar, Download, RefreshCw, Filter, ChevronDown,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  description?: string
  loading?: boolean
}

function MetricCard({ title, value, change, icon, description, loading }: MetricCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-1" />
          <Skeleton className="h-3 w-48" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || change !== undefined) && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {change !== undefined && (
              <>
                {change > 0 ? (
                  <ArrowUp className="h-3 w-3 text-green-600" />
                ) : change < 0 ? (
                  <ArrowDown className="h-3 w-3 text-red-600" />
                ) : (
                  <Minus className="h-3 w-3 text-gray-600" />
                )}
                <span className={change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}>
                  {Math.abs(change)}%
                </span>
              </>
            )}
            {change !== undefined && description && <span className="text-muted-foreground">•</span>}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface TechniqueRowProps {
  name: string
  usage: number
  successRate: number
  avgTime: number
  trend: 'up' | 'down' | 'stable'
}

function TechniqueRow({ name, usage, successRate, avgTime, trend }: TechniqueRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex-1">
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {usage.toLocaleString()} uses • {successRate}% success
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium">{avgTime}ms</p>
          <p className="text-xs text-muted-foreground">avg time</p>
        </div>
        <div className="flex items-center">
          {trend === 'up' ? (
            <ArrowUp className="h-4 w-4 text-green-600" />
          ) : trend === 'down' ? (
            <ArrowDown className="h-4 w-4 text-red-600" />
          ) : (
            <Minus className="h-4 w-4 text-gray-600" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState('7d')
  const [refreshing, setRefreshing] = useState(false)
  
  // Mock data - in production this would come from the API
  const [metrics, setMetrics] = useState({
    totalPrompts: 12543,
    totalPromptsChange: 15,
    activeUsers: 892,
    activeUsersChange: 8,
    avgSuccessRate: 87.3,
    avgSuccessRateChange: 2,
    avgResponseTime: 423,
    avgResponseTimeChange: -12
  })

  const [techniqueStats] = useState([
    { name: 'Chain of Thought', usage: 3421, successRate: 92, avgTime: 412, trend: 'up' as const },
    { name: 'Few-Shot Learning', usage: 2856, successRate: 89, avgTime: 385, trend: 'up' as const },
    { name: 'Role Playing', usage: 2103, successRate: 87, avgTime: 398, trend: 'stable' as const },
    { name: 'Structured Output', usage: 1876, successRate: 91, avgTime: 445, trend: 'up' as const },
    { name: 'Tree of Thoughts', usage: 1654, successRate: 85, avgTime: 523, trend: 'down' as const },
    { name: 'Self Consistency', usage: 1432, successRate: 88, avgTime: 478, trend: 'stable' as const },
    { name: 'Emotional Appeal', usage: 987, successRate: 82, avgTime: 367, trend: 'up' as const },
    { name: 'Analogical Reasoning', usage: 754, successRate: 84, avgTime: 402, trend: 'down' as const }
  ])

  const [intentBreakdown] = useState([
    { intent: 'Question Answering', count: 4521, percentage: 35 },
    { intent: 'Content Creation', count: 3221, percentage: 25 },
    { intent: 'Code Generation', count: 2576, percentage: 20 },
    { intent: 'Analysis', count: 1543, percentage: 12 },
    { intent: 'Summarization', count: 1032, percentage: 8 }
  ])

  const [usageByHour] = useState([
    { hour: '00:00', count: 234 },
    { hour: '04:00', count: 156 },
    { hour: '08:00', count: 489 },
    { hour: '12:00', count: 756 },
    { hour: '16:00', count: 923 },
    { hour: '20:00', count: 678 }
  ])

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In production, fetch real data from:
      // - adminService.getSystemMetrics()
      // - adminService.getUsageMetrics()
      // - promptService.getTechniques()
      
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err)
      setError(err.message || 'Failed to load analytics data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAnalytics()
  }

  const handleExport = () => {
    const exportData = {
      timeRange,
      generatedAt: new Date().toISOString(),
      metrics,
      techniqueStats,
      intentBreakdown,
      usageByHour
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getMaxUsage = () => Math.max(...usageByHour.map(h => h.count))

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor usage patterns, technique effectiveness, and system performance
            </p>
          </div>
          
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Total Prompts"
          value={loading ? '-' : metrics.totalPrompts.toLocaleString()}
          change={metrics.totalPromptsChange}
          icon={<Activity className="h-4 w-4" />}
          description="vs previous period"
          loading={loading}
        />
        <MetricCard
          title="Active Users"
          value={loading ? '-' : metrics.activeUsers.toLocaleString()}
          change={metrics.activeUsersChange}
          icon={<Users className="h-4 w-4" />}
          description="unique users"
          loading={loading}
        />
        <MetricCard
          title="Success Rate"
          value={loading ? '-' : `${metrics.avgSuccessRate}%`}
          change={metrics.avgSuccessRateChange}
          icon={<Target className="h-4 w-4" />}
          description="based on feedback"
          loading={loading}
        />
        <MetricCard
          title="Avg Response Time"
          value={loading ? '-' : `${metrics.avgResponseTime}ms`}
          change={metrics.avgResponseTimeChange}
          icon={<Zap className="h-4 w-4" />}
          description="p50 latency"
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Popular Techniques */}
        <Card>
          <CardHeader>
            <CardTitle>Popular Techniques</CardTitle>
            <CardDescription>Most used prompt engineering techniques</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div>
                {techniqueStats.map((tech, index) => (
                  <TechniqueRow key={index} {...tech} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Intent Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Intent Breakdown</CardTitle>
            <CardDescription>Distribution of prompt intents</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {intentBreakdown.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.intent}</span>
                      <span className="font-medium">{item.count.toLocaleString()} ({item.percentage}%)</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Pattern */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Usage Pattern</CardTitle>
          <CardDescription>Prompt generation activity by time</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div>
              <div className="space-y-4">
                {usageByHour.map((hour, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-12">{hour.hour}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-secondary rounded-full h-6 relative overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${(hour.count / getMaxUsage()) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{hour.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Current system status and performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">API Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Operational</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Database Load</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">23%</span>
                  <Badge variant="secondary">Normal</Badge>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">94.2%</span>
                  <Badge variant="secondary">Optimal</Badge>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">0.12%</span>
                  <Badge variant="secondary">Low</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
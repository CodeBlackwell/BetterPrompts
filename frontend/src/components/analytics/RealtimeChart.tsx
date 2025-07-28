import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface DataPoint {
  timestamp: string
  value: number
}

interface RealtimeChartProps {
  data: DataPoint[]
  title: string
  description?: string
  color?: string
  height?: number
  maxPoints?: number
}

export function RealtimeChart({ 
  data, 
  title, 
  description,
  color = '#3b82f6',
  height = 200,
  maxPoints = 20
}: RealtimeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [displayData, setDisplayData] = useState<DataPoint[]>([])

  // Update display data when new data arrives
  useEffect(() => {
    setDisplayData(prev => {
      const combined = [...prev, ...data]
      // Keep only the last maxPoints
      return combined.slice(-maxPoints)
    })
  }, [data, maxPoints])

  // Draw chart when display data changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || displayData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate scales
    const padding = 20
    const chartWidth = canvas.width - padding * 2
    const chartHeight = canvas.height - padding * 2

    const values = displayData.map(d => d.value)
    const minValue = Math.min(...values) * 0.9
    const maxValue = Math.max(...values) * 1.1
    const valueRange = maxValue - minValue || 1

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(canvas.width - padding, y)
      ctx.stroke()
    }

    // Draw line chart
    ctx.setLineDash([])
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()

    displayData.forEach((point, index) => {
      const x = padding + (chartWidth / (displayData.length - 1)) * index
      const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()

    // Draw points
    ctx.fillStyle = color
    displayData.forEach((point, index) => {
      const x = padding + (chartWidth / (displayData.length - 1)) * index
      const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight

      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })

    // Draw labels
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'

    // Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const value = minValue + (valueRange / 4) * (4 - i)
      const y = padding + (chartHeight / 4) * i
      ctx.fillText(value.toFixed(0), padding - 5, y + 4)
    }

    // X-axis labels (show first and last)
    if (displayData.length > 0) {
      ctx.textAlign = 'center'
      const firstTime = new Date(displayData[0].timestamp).toLocaleTimeString()
      const lastTime = new Date(displayData[displayData.length - 1].timestamp).toLocaleTimeString()
      
      ctx.fillText(firstTime, padding, canvas.height - 5)
      ctx.fillText(lastTime, canvas.width - padding, canvas.height - 5)
    }
  }, [displayData, color, height])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <CardDescription className="text-sm">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <canvas 
          ref={canvasRef} 
          className="w-full"
          style={{ height: `${height}px` }}
        />
        {displayData.length === 0 && (
          <div 
            className="flex items-center justify-center text-muted-foreground text-sm"
            style={{ height: `${height}px` }}
          >
            Waiting for data...
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// Performance monitoring utilities for Next.js

// Web Vitals reporting
export function reportWebVitals(metric: any) {
  if (metric.label === 'web-vital') {
    console.log('Web Vital:', metric)
    
    // Send to analytics service (e.g., Google Analytics, Vercel Analytics)
    // Example with Google Analytics:
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      })
    }
  }
}

// Performance Observer for custom metrics
export function initPerformanceObserver() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return
  }

  // Observe Largest Contentful Paint
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      console.log('LCP:', lastEntry.startTime)
    })
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
  } catch (e) {
    console.error('LCP Observer error:', e)
  }

  // Observe First Input Delay
  try {
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const delay = entry.processingStart - entry.startTime
        console.log('FID:', delay)
      }
    })
    fidObserver.observe({ entryTypes: ['first-input'] })
  } catch (e) {
    console.error('FID Observer error:', e)
  }

  // Observe Cumulative Layout Shift
  try {
    let clsValue = 0
    let clsEntries: any[] = []

    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
          clsEntries.push(entry)
        }
      }
    })
    clsObserver.observe({ entryTypes: ['layout-shift'] })

    // Report CLS when page is about to unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        console.log('CLS:', clsValue)
      })
    }
  } catch (e) {
    console.error('CLS Observer error:', e)
  }
}

// Measure component render time
export function measureRenderTime(componentName: string) {
  const startTime = performance.now()
  
  return () => {
    const endTime = performance.now()
    const renderTime = endTime - startTime
    console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`)
    
    // Send to monitoring service if render time exceeds threshold
    if (renderTime > 100) {
      console.warn(`Slow render detected for ${componentName}: ${renderTime.toFixed(2)}ms`)
    }
  }
}

// Resource timing analysis
export function analyzeResourceTiming() {
  if (typeof window === 'undefined' || !window.performance) {
    return
  }

  const resources = window.performance.getEntriesByType('resource')
  const slowResources = resources.filter(resource => resource.duration > 500)
  
  if (slowResources.length > 0) {
    console.log('Slow resources detected:', slowResources)
  }
  
  // Group resources by type
  const resourcesByType = resources.reduce((acc, resource) => {
    const type = resource.name.split('.').pop() || 'unknown'
    if (!acc[type]) acc[type] = []
    acc[type].push(resource)
    return acc
  }, {} as Record<string, any[]>)
  
  console.log('Resources by type:', resourcesByType)
}

// Navigation timing analysis
export function analyzeNavigationTiming() {
  if (typeof window === 'undefined' || !window.performance) {
    return
  }

  const navigation = window.performance.getEntriesByType('navigation')[0] as any
  if (!navigation) return

  const metrics = {
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    ttfb: navigation.responseStart - navigation.requestStart,
    download: navigation.responseEnd - navigation.responseStart,
    domParsing: navigation.domInteractive - navigation.domLoading,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    totalTime: navigation.loadEventEnd - navigation.fetchStart,
  }

  console.log('Navigation timing metrics:', metrics)
  
  // Alert if page load is too slow
  if (metrics.totalTime > 3000) {
    console.warn('Page load time exceeds 3 seconds:', metrics.totalTime)
  }
}

// Initialize all performance monitoring
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') {
    return
  }

  // Initialize observers
  initPerformanceObserver()
  
  // Analyze performance after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      analyzeResourceTiming()
      analyzeNavigationTiming()
    }, 2000) // Wait for all resources to finish
  })
}
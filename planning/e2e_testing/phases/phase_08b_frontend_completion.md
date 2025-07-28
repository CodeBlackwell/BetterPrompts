# Phase 8b: Frontend Integration Completion

## Overview
- **Purpose**: Complete frontend integration to enable Phase 8 test execution
- **Duration**: 2-3 hours
- **Complexity**: Low - Connect existing components
- **Status**: ✅ IMPLEMENTED (July 28, 2025)
- **Priority**: CRITICAL - Blocking test execution

## Implementation Status
As of July 28, 2025, this phase has been implemented:
- ✅ Frontend analytics page connected to real APIs
- ✅ WebSocket integration completed  
- ✅ RealtimeChart component created
- ✅ Authentication test IDs added
- ✅ Environment configuration done
- ❌ Admin routing/middleware still needed for test execution

See `/e2e/phase8/PHASE8B_IMPLEMENTATION_REPORT.md` for full details.

## Current State

### ✅ What's Already Done
1. **Backend API Endpoints**: All metrics endpoints return proper data
2. **WebSocket Server**: Broadcasting metrics every 5 seconds
3. **Database**: Schema created with test data
4. **Frontend Hook**: `useMetricsWebSocket.ts` ready to use
5. **Analytics Page**: Exists at `/admin/analytics` with UI components
6. **Test Suite**: 33 E2E tests and 6 k6 scenarios ready to run

### 🚧 What's Missing
1. WebSocket connection not established in analytics page
2. API endpoints not being called
3. Real-time updates not processed
4. Authentication field naming mismatch

## Implementation Tasks

### Task 1: Fix Authentication Field Naming (15 mins)

#### Problem
The API expects `email_or_username` but tests might use different field names.

#### Solution
Update the authentication service or create a compatibility layer:

```typescript
// frontend/src/lib/api/auth.ts
export async function login(email: string, password: string) {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_or_username: email, // Snake case field name
      password: password
    })
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  return response.json();
}
```

### Task 2: Update Analytics Page API Calls (30 mins)

#### Current State
The analytics page uses mock data in the `fetchAnalytics` function.

#### Required Changes
Replace the mock implementation with real API calls:

```typescript
// frontend/src/app/admin/analytics/page.tsx

const fetchAnalytics = async () => {
  try {
    setLoading(true);
    setError(null);
    
    // Add authentication token
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Fetch all metrics in parallel
    const [performance, infrastructure, business, sla, techniques] = await Promise.all([
      fetch('/api/v1/admin/metrics/performance', { headers }).then(r => r.json()),
      fetch('/api/v1/admin/metrics/infrastructure', { headers }).then(r => r.json()),
      fetch('/api/v1/admin/metrics/business', { headers }).then(r => r.json()),
      fetch('/api/v1/admin/metrics/sla', { headers }).then(r => r.json()),
      fetch('/api/v1/admin/metrics/techniques', { headers }).then(r => r.json()),
    ]);
    
    // Update state with real data
    setPerformanceMetrics(performance);
    setInfrastructureMetrics(infrastructure);
    setBusinessMetrics(business);
    setSlaMetrics(sla);
    
    // Process technique stats
    if (techniques.techniques) {
      setTechniqueStats(techniques.techniques.map((t: any) => ({
        name: t.technique.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        usage: t.usage_count,
        successRate: Math.round(t.success_rate * 100),
        avgTime: t.avg_time_ms,
        trend: t.trend
      })));
    }
    
  } catch (err: any) {
    console.error('Failed to fetch analytics:', err);
    setError(err.message || 'Failed to load analytics data');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};
```

### Task 3: Connect WebSocket for Real-time Updates (45 mins)

#### Update Analytics Page
Add WebSocket message handling:

```typescript
// frontend/src/app/admin/analytics/page.tsx

// Update the WebSocket configuration
const { isConnected, metrics: wsMetrics, lastUpdate } = useMetricsWebSocket({
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws',
  channels: ['performance', 'usage', 'technique_stats'],
  onMessage: (message) => {
    // Update metrics based on channel
    switch(message.channel) {
      case 'performance':
        setPerformanceMetrics(prev => ({ ...prev, ...message.data }));
        updateMetricsDisplay(message.data);
        break;
      case 'usage':
        setUsageMetrics(prev => ({ ...prev, ...message.data }));
        break;
      case 'technique_stats':
        processTechniqueStats(message.data);
        break;
    }
  },
  onConnect: () => {
    console.log('WebSocket connected for real-time metrics');
  },
  onDisconnect: () => {
    console.log('WebSocket disconnected');
  }
});

// Add effect to update UI when WebSocket data arrives
useEffect(() => {
  if (wsMetrics.performance) {
    // Update the displayed metrics
    setMetrics(prev => ({
      ...prev,
      avgResponseTime: wsMetrics.performance.response_time?.p50 || prev.avgResponseTime,
      throughput: wsMetrics.performance.throughput || prev.throughput
    }));
  }
}, [wsMetrics]);
```

### Task 4: Update Chart Components (30 mins)

Create or update components to display real-time data:

```typescript
// frontend/src/components/analytics/RealtimeChart.tsx
import { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';

export function RealtimeChart({ data, title }: { data: any[], title: string }) {
  const chartRef = useRef(null);
  
  // Update chart when new data arrives
  useEffect(() => {
    if (chartRef.current && data.length > 0) {
      // Update chart data
      const chart = chartRef.current;
      chart.data.labels = data.map(d => d.timestamp);
      chart.data.datasets[0].data = data.map(d => d.value);
      chart.update('none'); // No animation for real-time
    }
  }, [data]);
  
  return (
    <div>
      <h3>{title}</h3>
      <Line
        ref={chartRef}
        data={{
          labels: [],
          datasets: [{
            label: title,
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }]
        }}
        options={{
          responsive: true,
          scales: {
            x: { display: true },
            y: { display: true }
          }
        }}
      />
    </div>
  );
}
```

### Task 5: Fix CORS for WebSocket (15 mins)

Update the WebSocket upgrade handler to properly handle CORS:

```go
// backend/services/api-gateway/cmd/server/main.go

upgrader := gorillaws.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        // In development, allow all origins
        if os.Getenv("ENVIRONMENT") == "development" {
            return true
        }
        
        // In production, check origin
        origin := r.Header.Get("Origin")
        return origin == "https://betterprompts.ai" || 
               origin == "http://localhost:3000"
    },
}
```

### Task 6: Update Environment Variables (5 mins)

Add WebSocket URL to frontend environment:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
```

## Testing Plan

### Step 1: Verify Backend
```bash
# Test metrics endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/v1/admin/metrics/performance
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/v1/admin/metrics/infrastructure

# Test WebSocket
wscat -c ws://localhost:3000/ws
> {"type":"subscribe","channels":["performance"]}
# Should receive updates every 5 seconds
```

### Step 2: Test Frontend Integration
1. Login to admin dashboard
2. Navigate to `/admin/analytics`
3. Verify:
   - Initial data loads from API
   - WebSocket connects (check browser console)
   - Metrics update every 5 seconds
   - Charts display real-time data

### Step 3: Run E2E Tests
```bash
cd e2e/phase8
npm test
```

### Step 4: Run Load Tests
```bash
# Quick test
k6 run scenarios/ramp-up.k6.js --duration 2m --vus 50

# Full suite
npm run k6:local
```

## Success Criteria

1. **API Integration**: Analytics page loads real data from endpoints
2. **WebSocket Connection**: Real-time updates work every 5 seconds
3. **Authentication**: Login works with correct field names
4. **E2E Tests**: All 33 tests pass
5. **Load Tests**: k6 scenarios execute successfully
6. **SLA Compliance**: Metrics show system meets targets

## Implementation Command

```bash
/sc implement frontend-websocket \
  --persona-frontend \
  --focus integration \
  --validate \
  "Complete Phase 8b frontend integration for performance metrics dashboard" \
  --requirements '{
    "api_integration": {
      "endpoints": [
        "/api/v1/admin/metrics/performance",
        "/api/v1/admin/metrics/infrastructure",
        "/api/v1/admin/metrics/business",
        "/api/v1/admin/metrics/sla",
        "/api/v1/admin/metrics/techniques"
      ],
      "authentication": "Bearer token in headers"
    },
    "websocket": {
      "url": "ws://localhost:3000/ws",
      "channels": ["performance", "usage", "technique_stats"],
      "update_interval": "5 seconds"
    },
    "ui_updates": {
      "real_time_charts": true,
      "metric_cards": true,
      "technique_table": true
    }
  }' \
  --files '[
    "frontend/src/app/admin/analytics/page.tsx",
    "frontend/src/lib/api/auth.ts",
    "frontend/src/components/analytics/RealtimeChart.tsx"
  ]' \
  --test-command "cd e2e/phase8 && npm test"
```

## Estimated Timeline

- **Task 1**: Fix authentication - 15 minutes
- **Task 2**: Update API calls - 30 minutes  
- **Task 3**: WebSocket integration - 45 minutes
- **Task 4**: Chart components - 30 minutes
- **Task 5**: CORS configuration - 15 minutes
- **Task 6**: Environment setup - 5 minutes
- **Testing**: 30 minutes

**Total**: 2.5-3 hours

## Notes

- The backend is fully functional and tested
- All WebSocket infrastructure is in place
- The frontend hook is ready to use
- This is primarily a connection/integration task
- No new features need to be built

---

*Created: 2025-07-28*
*Priority: CRITICAL - Blocking Phase 8 completion*
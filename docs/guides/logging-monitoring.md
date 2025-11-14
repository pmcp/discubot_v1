# Logging & Monitoring Guide

Complete guide to logging, monitoring, and observability in Discubot.

## Overview

Discubot includes a comprehensive logging and monitoring system built for production observability:

- **Structured Logging** - JSON output in production, pretty printing in development
- **Request/Response Logging** - Automatic tracking of all API requests
- **Performance Metrics** - Track operation durations and success rates
- **Health Checks** - Monitor system and service health
- **Metrics API** - Export metrics for monitoring dashboards

## Table of Contents

1. [Structured Logger](#structured-logger)
2. [Request Logging Middleware](#request-logging-middleware)
3. [Performance Metrics](#performance-metrics)
4. [Health Check Endpoint](#health-check-endpoint)
5. [Metrics Endpoint](#metrics-endpoint)
6. [Best Practices](#best-practices)
7. [Production Setup](#production-setup)

---

## Structured Logger

### Location
`layers/discubot/server/utils/logger.ts`

### Features

- Multiple log levels (debug, info, warn, error)
- Structured JSON output for production
- Pretty-printed output for development
- Automatic context enrichment
- Performance timing helpers
- Error serialization with stack traces

### Basic Usage

```typescript
import { logger } from '~/layers/discubot/server/utils/logger'

// Simple messages
logger.info('User logged in')
logger.warn('Rate limit approaching')
logger.error('Failed to fetch data')
logger.debug('Verbose debugging info')

// With context
logger.info('User logged in', {
  userId: '123',
  ip: '1.2.3.4',
  userAgent: 'Mozilla/5.0...'
})

// With errors
try {
  await fetchData()
} catch (error) {
  logger.error('Failed to fetch data', error, {
    endpoint: '/api/users',
    attempt: 3
  })
}
```

### Timing Operations

```typescript
const timer = logger.startTimer()

// ... perform operation ...

const duration = timer.end('Operation completed', {
  recordsProcessed: 100
})

// Output: "Operation completed (1234ms)" with context
```

### Specialized Methods

```typescript
// Log API requests
logger.request('GET', '/api/users', { userId: '123' })

// Log API responses
logger.response('GET', '/api/users', 200, 150, { userId: '123' })

// Log webhook events
logger.webhook('slack', 'message.created', { channelId: 'C123' })

// Log processing stages
logger.processing('AI Analysis', { discussionId: '456' })
```

### Configuration

Set the minimum log level via environment variable:

```bash
# .env
LOG_LEVEL=info  # Options: debug, info, warn, error
```

### Output Formats

**Development (pretty print):**
```
2025-11-14T12:34:56.789Z [INFO] User logged in (150ms)
Context: {
  "userId": "123",
  "ip": "1.2.3.4"
}
```

**Production (JSON):**
```json
{
  "timestamp": "2025-11-14T12:34:56.789Z",
  "level": "info",
  "message": "User logged in",
  "context": {
    "userId": "123",
    "ip": "1.2.3.4"
  },
  "duration": 150
}
```

---

## Request Logging Middleware

### Location
`layers/discubot/server/middleware/logging.ts`

### Features

- Logs all incoming requests automatically
- Tracks request duration
- Captures client IP, user agent, referrer
- Filters sensitive headers
- Skips health check and static asset paths

### What's Logged

**Incoming Request:**
- HTTP method and path
- Client IP address
- User agent
- Referrer (if present)

**Outgoing Response:**
- HTTP status code
- Request duration (ms)
- Client IP

### Example Output

```
2025-11-14T12:34:56.789Z [INFO] POST /api/webhooks/slack
Context: {
  "ip": "1.2.3.4",
  "userAgent": "Slackbot 1.0"
}

2025-11-14T12:34:56.939Z [INFO] POST /api/webhooks/slack 200 (150ms)
Context: {
  "ip": "1.2.3.4"
}
```

### Skipped Paths

These paths are not logged to reduce noise:

- `/api/health`
- `/api/ping`
- `/_nuxt/*` (Nuxt assets)
- `/favicon.ico`
- `/robots.txt`

### Sensitive Header Filtering

These headers are excluded from logs for security:

- `authorization`
- `cookie`
- `set-cookie`
- `x-api-key`

---

## Performance Metrics

### Location
`layers/discubot/server/utils/metrics.ts`

### Features

- Track operation durations (min, max, avg, p95, p99)
- Track success/failure counts and rates
- Automatic metric aggregation
- In-memory storage with automatic cleanup
- Predefined metric names for consistency

### Basic Usage

```typescript
import { metricsCollector, METRICS } from '~/layers/discubot/server/utils/metrics'

// Time an operation
const timer = metricsCollector.start(METRICS.AI_GENERATE_SUMMARY)
try {
  const result = await generateSummary(text)
  timer.end({ success: true, tokens: result.tokens })
} catch (error) {
  timer.end({ success: false, error: error.message })
}

// Record external durations
metricsCollector.record(
  METRICS.NOTION_CREATE_TASK,
  duration,
  true,
  { taskId: '123' }
)
```

### Predefined Metrics

Use these constants for consistency:

```typescript
// Webhook processing
METRICS.WEBHOOK_SLACK
METRICS.WEBHOOK_MAILGUN

// Discussion processing stages
METRICS.PROCESS_VALIDATION
METRICS.PROCESS_CONFIG_LOAD
METRICS.PROCESS_THREAD_BUILD
METRICS.PROCESS_AI_ANALYSIS
METRICS.PROCESS_TASK_CREATE
METRICS.PROCESS_NOTIFICATION
METRICS.PROCESS_FULL

// AI operations
METRICS.AI_GENERATE_SUMMARY
METRICS.AI_DETECT_TASKS
METRICS.AI_CACHE_HIT
METRICS.AI_CACHE_MISS

// Notion operations
METRICS.NOTION_CREATE_TASK
METRICS.NOTION_CREATE_TASKS
METRICS.NOTION_UPDATE_STATUS

// Adapter operations
METRICS.ADAPTER_FETCH_THREAD
METRICS.ADAPTER_POST_REPLY
METRICS.ADAPTER_UPDATE_STATUS

// Database operations
METRICS.DB_CREATE_DISCUSSION
METRICS.DB_CREATE_JOB
METRICS.DB_CREATE_TASK
```

### Getting Statistics

```typescript
// Get stats for one operation
const stats = metricsCollector.getStats(METRICS.AI_GENERATE_SUMMARY)
console.log(stats)
// {
//   count: 100,
//   successCount: 95,
//   failureCount: 5,
//   successRate: 95,
//   durations: {
//     min: 1000,
//     max: 3000,
//     avg: 1500,
//     p95: 2800,
//     p99: 2950
//   },
//   lastUpdated: "2025-11-14T12:34:56.789Z"
// }

// Get all stats
const allStats = metricsCollector.getAllStats()
```

### Memory Management

- Maximum 1000 data points per operation
- Older data points automatically removed
- Manually clear metrics if needed:

```typescript
metricsCollector.clear('operation.name')
metricsCollector.clearAll()
```

### Slow Operation Warnings

Operations taking longer than 5 seconds automatically generate warnings:

```
[WARN] Slow operation detected: ai.generate_summary
Context: {
  "duration": 5234,
  "success": true,
  "discussionId": "123"
}
```

---

## Health Check Endpoint

### Endpoint
`GET /api/health`

### Features

- Overall system health status
- Individual service health checks
- System metrics (uptime, memory)
- Version information

### Response Format

```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T12:34:56.789Z",
  "version": "1.0.0",
  "uptime": 3600,
  "memory": {
    "used": 128,
    "total": 256,
    "percentage": 50
  },
  "services": {
    "database": {
      "status": "healthy",
      "message": "Database accessible",
      "lastCheck": "2025-11-14T12:34:56.789Z",
      "responseTime": 10
    },
    "ai": {
      "status": "degraded",
      "message": "API key not configured",
      "lastCheck": "2025-11-14T12:34:56.789Z"
    },
    "notion": {
      "status": "healthy",
      "message": "Service available",
      "lastCheck": "2025-11-14T12:34:56.789Z"
    }
  }
}
```

### HTTP Status Codes

- **200 OK** - System is healthy (all services operational)
- **207 Multi-Status** - System is degraded (some services down)
- **503 Service Unavailable** - System is unhealthy (critical services down)

### Service Status Logic

- **healthy** - All services operational
- **degraded** - Some non-critical services down (e.g., AI not configured)
- **unhealthy** - Critical services down (e.g., database unavailable)

### Health Checks Performed

1. **Database** - Simple connectivity check
2. **AI Service** - Verifies API key is configured
3. **Notion Service** - Verifies service is loadable

### Usage Examples

**Load Balancer Health Check:**
```bash
curl http://localhost:3000/api/health
```

**Monitoring Script:**
```bash
#!/bin/bash
response=$(curl -s http://localhost:3000/api/health)
status=$(echo $response | jq -r '.status')

if [ "$status" != "healthy" ]; then
  echo "ALERT: System is $status"
  # Send alert notification
fi
```

**Kubernetes Readiness Probe:**
```yaml
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

---

## Metrics Endpoint

### Endpoint
`GET /api/metrics`

### Features

- Operation statistics (durations, counts, success rates)
- System-wide metrics summary
- Top slowest operations
- Operations with highest error rates

### Response Format

```json
{
  "timestamp": "2025-11-14T12:34:56.789Z",
  "summary": {
    "totalOperations": 10,
    "totalDataPoints": 1000,
    "averageSuccessRate": 95
  },
  "operations": {
    "webhook.slack": {
      "count": 100,
      "successCount": 95,
      "failureCount": 5,
      "successRate": 95,
      "durations": {
        "min": 50,
        "max": 200,
        "avg": 100,
        "p95": 180,
        "p99": 195
      },
      "lastUpdated": "2025-11-14T12:34:56.789Z"
    }
  },
  "topSlowest": [
    {
      "operation": "process.ai_analysis",
      "avgDuration": 1500,
      "p95Duration": 2800,
      "count": 100
    }
  ],
  "topErrors": [
    {
      "operation": "webhook.slack",
      "errorRate": 5,
      "failureCount": 5,
      "count": 100
    }
  ]
}
```

### Security Note

**This endpoint should be protected in production!**

Options:
1. API key authentication
2. IP whitelist
3. Internal network only
4. VPN access

Example with API key:
```typescript
// Add middleware to metrics endpoint
export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, 'x-api-key')

  if (apiKey !== process.env.METRICS_API_KEY) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // ... rest of handler
})
```

### Usage Examples

**Grafana/Prometheus:**
```bash
# Fetch metrics and convert to Prometheus format
curl http://localhost:3000/api/metrics | jq '.operations'
```

**Monitoring Dashboard:**
```javascript
// Fetch metrics every 30 seconds
setInterval(async () => {
  const response = await fetch('http://localhost:3000/api/metrics')
  const metrics = await response.json()

  // Update dashboard
  updateDashboard(metrics)
}, 30000)
```

---

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// DEBUG: Verbose information for troubleshooting
logger.debug('Cache lookup', { key: 'user:123', hit: false })

// INFO: General operational information
logger.info('User logged in', { userId: '123' })

// WARN: Non-critical issues that need attention
logger.warn('Rate limit approaching', { remaining: 10 })

// ERROR: Critical issues that need immediate attention
logger.error('Database connection failed', error, { retries: 3 })
```

### 2. Always Include Context

```typescript
// ❌ BAD: No context
logger.error('Failed to process')

// ✅ GOOD: Rich context
logger.error('Failed to process discussion', error, {
  discussionId: '123',
  sourceType: 'slack',
  stage: 'ai_analysis',
  attempt: 2
})
```

### 3. Use Timers for Operations

```typescript
// ❌ BAD: Manual timing
const start = Date.now()
await operation()
logger.info('Operation done', { duration: Date.now() - start })

// ✅ GOOD: Use timer
const timer = logger.startTimer()
await operation()
timer.end('Operation completed')
```

### 4. Use Metrics for Performance Tracking

```typescript
// Track all key operations
const timer = metricsCollector.start(METRICS.PROCESS_FULL)
try {
  await processDiscussion(data)
  timer.end({ success: true })
} catch (error) {
  timer.end({ success: false, error: error.message })
  throw error
}
```

### 5. Don't Log Sensitive Data

```typescript
// ❌ BAD: Logs API key
logger.info('Config loaded', { apiKey: config.apiKey })

// ✅ GOOD: Masks sensitive data
logger.info('Config loaded', {
  apiKey: config.apiKey.substring(0, 8) + '...'
})
```

### 6. Use Structured Context

```typescript
// ❌ BAD: String interpolation
logger.info(`User ${userId} logged in from ${ip}`)

// ✅ GOOD: Structured context (easier to query/filter)
logger.info('User logged in', {
  userId,
  ip,
  userAgent: request.headers['user-agent']
})
```

---

## Production Setup

### Environment Variables

```bash
# .env.production
LOG_LEVEL=info  # Don't use 'debug' in production
NODE_ENV=production  # Enables JSON output
```

### Log Aggregation

Ship logs to a central service:

**Using Cloudflare Logpush:**
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    cloudflare: {
      logpush: {
        enabled: true,
        destination: 's3://my-logs-bucket'
      }
    }
  }
})
```

**Using Datadog:**
```typescript
// Install: pnpm add dd-trace

// server/plugins/datadog.ts
import tracer from 'dd-trace'

export default defineNitroPlugin(() => {
  tracer.init({
    service: 'discubot',
    env: process.env.NODE_ENV
  })
})
```

### Monitoring Setup

**1. Health Check Monitoring**

Use UptimeRobot, Pingdom, or similar:
- URL: `https://your-app.com/api/health`
- Interval: 5 minutes
- Alert on: Status code != 200

**2. Metrics Dashboard**

Create a monitoring dashboard (Grafana, Datadog, etc.):
- Fetch `/api/metrics` every 30 seconds
- Display top slowest operations
- Display error rates
- Set up alerts for:
  - Error rate > 5%
  - p95 duration > 5000ms
  - Memory usage > 80%

**3. Error Tracking**

Integrate with Sentry:

```bash
pnpm add @sentry/nuxt
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@sentry/nuxt/module'],
  sentry: {
    dsn: process.env.SENTRY_DSN
  }
})
```

### Log Rotation

For local development or self-hosted:

```bash
# logrotate config
/var/log/discubot/*.log {
  daily
  rotate 14
  compress
  delaycompress
  notifempty
  create 644 www-data www-data
}
```

---

## Troubleshooting

### Logs Not Appearing

**Check log level:**
```bash
# Make sure LOG_LEVEL allows your messages
echo $LOG_LEVEL

# Try setting to debug
export LOG_LEVEL=debug
```

**Check console mocking in tests:**
```typescript
// If testing, make sure console isn't mocked
vi.restoreAllMocks()
```

### Metrics Not Recording

**Check operation names:**
```typescript
// Use predefined constants
import { METRICS } from '~/layers/discubot/server/utils/metrics'

// ❌ Wrong
metricsCollector.start('webhook-slack')

// ✅ Correct
metricsCollector.start(METRICS.WEBHOOK_SLACK)
```

**Clear old metrics:**
```typescript
// If memory is full
metricsCollector.clearAll()
```

### Health Check Always Degraded

**Check environment variables:**
```bash
# AI service requires API key
echo $ANTHROPIC_API_KEY

# Make sure it's not a placeholder
if [ "$ANTHROPIC_API_KEY" = "your_anthropic_api_key_here" ]; then
  echo "Update your API key!"
fi
```

---

## Summary

Discubot's logging and monitoring system provides comprehensive observability:

✅ **Structured logging** with proper levels and context
✅ **Automatic request/response logging** for all API calls
✅ **Performance metrics** tracking with percentiles
✅ **Health checks** for system and service monitoring
✅ **Metrics API** for external monitoring tools

This system is production-ready and designed for:
- Debugging issues in development
- Tracking performance in production
- Monitoring system health
- Alerting on errors and slow operations
- Integrating with observability platforms

For production deployment, make sure to:
1. Set `LOG_LEVEL=info` (not debug)
2. Set up log aggregation (Cloudflare, Datadog, etc.)
3. Configure health check monitoring
4. Set up metrics dashboard
5. Integrate error tracking (Sentry)
6. Protect `/api/metrics` endpoint
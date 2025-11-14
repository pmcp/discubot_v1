# Discubot Configuration Guide

Complete reference for all environment variables and configuration options.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Runtime Configuration](#runtime-configuration)
3. [Database Configuration](#database-configuration)
4. [Integration Settings](#integration-settings)
5. [Security Settings](#security-settings)
6. [Performance Tuning](#performance-tuning)
7. [Logging Configuration](#logging-configuration)

---

## Environment Variables

### Required Variables

These variables **must** be set for Discubot to function:

```bash
# Anthropic AI (Claude)
ANTHROPIC_API_KEY=sk-ant-api03-...
# Required for AI-powered discussion analysis
# Get from: https://console.anthropic.com/

# Application URL
NUXT_PUBLIC_SITE_URL=https://your-domain.com
# Used for: OAuth redirects, webhook URLs, deep links
# Local dev: http://localhost:3000
# Production: https://your-domain.com

# Notion Integration
NOTION_TOKEN=secret_...
# Notion integration token for API access
# Get from: https://www.notion.so/my-integrations

# Notion Database
NOTION_DATABASE_ID=abc123def456...
# ID of the Notion database where tasks will be created
# Found in database URL: notion.so/workspace/{THIS_PART}?v=...
```

---

### Figma Integration Variables

Required only if using Figma integration:

```bash
# Figma API Token
FIGMA_API_TOKEN=figd_...
# Personal access token from Figma account settings
# Get from: https://www.figma.com/settings
# Required for: Fetching comment threads, posting replies

# Mailgun Signing Key
MAILGUN_SIGNING_KEY=your-mailgun-signing-key
# Webhook signature verification key from Mailgun
# Get from: Mailgun dashboard → Webhooks → Signing Key
# Required for: Secure webhook verification
```

---

### Slack Integration Variables

Required only if using Slack integration:

```bash
# Slack OAuth Credentials
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=abcdef1234567890abcdef1234567890
# OAuth 2.0 credentials for Slack app
# Get from: https://api.slack.com/apps → Your App → Basic Information

# Slack Signing Secret
SLACK_SIGNING_SECRET=abcdef1234567890abcdef1234567890
# Webhook signature verification secret
# Get from: https://api.slack.com/apps → Your App → Basic Information
# Required for: Secure webhook verification
```

---

### Optional Variables

```bash
# Logging Level
LOG_LEVEL=info
# Options: debug, info, warn, error
# Default: info
# Use debug for development, info/warn for production

# Node Environment
NODE_ENV=development
# Options: development, production, test
# Default: development
# Affects: Logging format, security checks, error handling

# Database URL (for production with D1/Turso)
DATABASE_URL=...
# Only needed for non-SQLite databases
# Local dev uses SQLite at .data/db.sqlite3

# Rate Limiting (requests per minute)
RATE_LIMIT_WEBHOOK=100
RATE_LIMIT_API=60
RATE_LIMIT_AUTH=5
# Default values are shown above
# Adjust based on expected traffic
```

---

## Runtime Configuration

### nuxt.config.ts Settings

Discubot's runtime configuration is defined in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    // Private (server-side only)
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    figma: {
      apiToken: process.env.FIGMA_API_TOKEN
    },
    mailgun: {
      signingKey: process.env.MAILGUN_SIGNING_KEY
    },
    slack: {
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      signingSecret: process.env.SLACK_SIGNING_SECRET
    },
    notion: {
      token: process.env.NOTION_TOKEN,
      databaseId: process.env.NOTION_DATABASE_ID
    },

    // Public (available client-side)
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    }
  }
})
```

### Accessing Configuration

**Server-side (API routes, middleware, plugins)**:
```typescript
const config = useRuntimeConfig()
const apiKey = config.anthropic.apiKey // Private
const siteUrl = config.public.siteUrl  // Public
```

**Client-side (Vue components)**:
```typescript
const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl // Only public config available
```

---

## Database Configuration

### Local Development (SQLite)

Default configuration for local development:

```typescript
// crouton.config.mjs
export default {
  database: {
    url: '.data/db.sqlite3', // Local SQLite file
    driver: 'better-sqlite3'
  }
}
```

**Location**: `.data/db.sqlite3` (auto-created, gitignored)

### Production (NuxtHub with D1)

NuxtHub automatically configures Cloudflare D1:

```typescript
// No explicit config needed - NuxtHub handles it
// Database is provisioned on first deploy
```

### Production (Custom Database)

For self-hosted with PostgreSQL/Turso:

```bash
# .env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
# or
DATABASE_URL=libsql://your-db.turso.io
```

```typescript
// crouton.config.mjs
export default {
  database: {
    url: process.env.DATABASE_URL,
    driver: 'postgres' // or 'turso'
  }
}
```

### Database Migrations

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# View database in Drizzle Studio
pnpm db:studio
```

---

## Integration Settings

### Figma Configuration

**Per-Source Config** (set in Admin UI):

```json
{
  "name": "Design Team Figma",
  "sourceType": "figma",
  "apiToken": "figd_...",           // Figma API token
  "email": "figma@example.com",     // Email receiving notifications
  "notionToken": "secret_...",      // Notion integration token
  "notionDatabaseId": "abc123...",  // Target database ID
  "anthropicApiKey": "sk-ant-...",  // Claude API key
  "autoProcess": true,              // Process automatically
  "notifyOnCompletion": false,      // Post reply when done
  "notifyOnFailure": true           // Post reply on error
}
```

**Field Mapping** (optional):
```json
{
  "notionFieldMapping": {
    "title": "Name",
    "status": "Status",
    "priority": "Priority",
    "assignee": "Owner"
  }
}
```

### Slack Configuration

**Per-Workspace Config** (set in Admin UI):

```json
{
  "name": "Engineering Workspace",
  "sourceType": "slack",
  "apiToken": "xoxb-...",           // Bot User OAuth Token
  "webhookUrl": "https://...",      // Incoming webhook URL
  "notionToken": "secret_...",      // Notion integration token
  "notionDatabaseId": "abc123...",  // Target database ID
  "anthropicApiKey": "sk-ant-...",  // Claude API key
  "autoProcess": true,              // Process automatically
  "notifyOnCompletion": true,       // Post reply when done
  "notifyOnFailure": true           // Post reply on error
}
```

**Source Metadata** (optional):
```json
{
  "sourceMetadata": {
    "channels": ["C1234567890"],    // Only process these channels
    "ignoreThreadless": false,      // Ignore non-threaded messages
    "minParticipants": 2            // Require N participants
  }
}
```

---

## Security Settings

### Webhook Signature Verification

**Slack Webhooks**:
```bash
SLACK_SIGNING_SECRET=abcdef1234567890...
```

Verification algorithm:
- Uses HMAC-SHA256 with signing secret
- Validates `X-Slack-Signature` and `X-Slack-Request-Timestamp` headers
- 5-minute timestamp tolerance to prevent replay attacks

**Mailgun Webhooks**:
```bash
MAILGUN_SIGNING_KEY=your-key
```

Verification algorithm:
- Uses HMAC-SHA256 with signing key
- Validates `signature.timestamp`, `signature.token`, `signature.signature`
- 5-minute timestamp tolerance

### Rate Limiting

**Default Limits** (requests per minute):
```typescript
{
  WEBHOOK: 100,  // Slack/Mailgun webhooks
  API: 60,       // General API endpoints
  AUTH: 5,       // OAuth/login endpoints
  READ: 300,     // Read-only endpoints
  WRITE: 30      // Write/mutation endpoints
}
```

**Custom Limits** (via environment):
```bash
RATE_LIMIT_WEBHOOK=100
RATE_LIMIT_API=60
RATE_LIMIT_AUTH=5
```

### Input Validation

All API inputs are validated with Zod schemas:

```typescript
// Example: Slack event validation
const slackEventSchema = z.object({
  type: z.literal('event_callback'),
  event: z.object({
    type: z.literal('message'),
    text: z.string(),
    user: z.string(),
    ts: z.string()
  })
})
```

**XSS Prevention**: All user inputs are sanitized before storage/rendering.

---

## Performance Tuning

### AI Service Caching

**Map-based Cache** (in-memory):
```typescript
{
  maxSize: 1000,      // Max cached items
  ttl: 3600000        // 1 hour TTL (ms)
}
```

Caches AI analysis results by discussion content hash.

**Future**: KV-based caching for multi-instance deployments.

### Notion API Rate Limiting

**Built-in rate limiting**:
```typescript
{
  delayMs: 200,       // 200ms between requests
  maxRetries: 3       // Retry failed requests
}
```

Prevents hitting Notion's 3 requests/second limit.

### Database Connection Pooling

**SQLite** (local dev):
- Single connection (no pooling needed)

**PostgreSQL** (production):
```typescript
{
  min: 2,             // Min connections
  max: 10,            // Max connections
  idleTimeout: 30000  // 30s idle timeout
}
```

### Job Cleanup

**Automatic cleanup** (every 24 hours):
```typescript
{
  retentionDays: 30,  // Keep jobs for 30 days
  cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
}
```

Deletes completed/failed jobs older than 30 days.

---

## Logging Configuration

### Log Levels

Set via `LOG_LEVEL` environment variable:

```bash
# Development
LOG_LEVEL=debug

# Production
LOG_LEVEL=info

# Minimal (errors only)
LOG_LEVEL=error
```

**Level Hierarchy**: `debug` < `info` < `warn` < `error`

### Log Format

**Development** (pretty-printed):
```
[2025-11-14 10:30:00] INFO Discussion processed successfully
  discussionId: disc_123
  jobId: job_456
  duration: 2340ms
```

**Production** (structured JSON):
```json
{
  "level": "info",
  "timestamp": "2025-11-14T10:30:00.000Z",
  "message": "Discussion processed successfully",
  "context": {
    "discussionId": "disc_123",
    "jobId": "job_456",
    "duration": 2340
  }
}
```

### Sensitive Data Filtering

Automatically redacted from logs:
- Authorization headers
- API tokens (Figma, Slack, Notion, Anthropic)
- Cookie values
- User passwords
- Webhook signatures

### Log Aggregation (Production)

**Recommended Services**:
- **Cloudflare Logs** (if using NuxtHub)
- **LogTail** - Real-time log tailing
- **Datadog** - Full observability platform
- **Grafana Loki** - Self-hosted log aggregation

**Integration**:
```typescript
// server/plugins/logShipping.ts
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('log', (log) => {
    // Ship logs to external service
    fetch('https://log-service.com/ingest', {
      method: 'POST',
      body: JSON.stringify(log)
    })
  })
})
```

---

## Environment-Specific Configuration

### Development (.env)

```bash
NODE_ENV=development
LOG_LEVEL=debug
NUXT_PUBLIC_SITE_URL=http://localhost:3000
DATABASE_URL=.data/db.sqlite3

# API Keys (use test keys if available)
ANTHROPIC_API_KEY=sk-ant-api03-...
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...

# Disable webhook verification for local testing
# (signatures won't match with tunneled requests)
```

### Staging (.env.staging)

```bash
NODE_ENV=production
LOG_LEVEL=info
NUXT_PUBLIC_SITE_URL=https://staging.your-domain.com

# Production API keys (staging workspace)
ANTHROPIC_API_KEY=sk-ant-api03-...
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...

# Enable webhook verification
SLACK_SIGNING_SECRET=...
MAILGUN_SIGNING_KEY=...

# Moderate rate limits
RATE_LIMIT_WEBHOOK=50
RATE_LIMIT_API=30
```

### Production (.env.production)

```bash
NODE_ENV=production
LOG_LEVEL=warn  # Only warnings and errors
NUXT_PUBLIC_SITE_URL=https://your-domain.com

# Production API keys
ANTHROPIC_API_KEY=sk-ant-api03-...
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...

# Enable all security features
SLACK_SIGNING_SECRET=...
MAILGUN_SIGNING_KEY=...

# Production rate limits
RATE_LIMIT_WEBHOOK=100
RATE_LIMIT_API=60
RATE_LIMIT_AUTH=5
```

---

## Validation & Testing

### Environment Validation

Discubot validates configuration on startup:

```bash
pnpm dev

# Output:
Security Check Results:
✓ ANTHROPIC_API_KEY configured
✓ NOTION_TOKEN configured
✓ NOTION_DATABASE_ID configured
⚠ SLACK_SIGNING_SECRET not configured (webhook verification disabled)
⚠ MAILGUN_SIGNING_KEY not configured (webhook verification disabled)
```

### Testing Configuration

```bash
# Test Notion connection
curl -X POST http://localhost:3000/api/configs/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "type": "testByConfig",
    "config": {
      "notionToken": "secret_...",
      "notionDatabaseId": "abc123..."
    }
  }'

# Test health check
curl http://localhost:3000/api/health

# Test AI service (requires valid discussion)
curl -X POST http://localhost:3000/api/discussions/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "discussion": {
      "sourceType": "figma",
      "title": "Test Discussion",
      "content": "This is a test"
    }
  }'
```

---

## Troubleshooting Configuration

### Issue: Missing required environment variables

**Symptoms**: App fails to start or webhook verification fails

**Solution**:
1. Check `.env` file exists
2. Verify all required variables are set
3. Check for typos in variable names
4. Ensure no trailing spaces in values

### Issue: Webhook signature verification fails

**Symptoms**: 401 Unauthorized on webhook endpoints

**Solution**:
1. Verify signing secrets match platform (Slack/Mailgun)
2. Check timestamp is within 5-minute window
3. For local testing, disable verification or use tunneling service (ngrok)

### Issue: Rate limiting errors

**Symptoms**: 429 Too Many Requests responses

**Solution**:
1. Increase rate limits via environment variables
2. Implement exponential backoff in clients
3. Check for runaway webhook loops

### Issue: Database connection fails

**Symptoms**: ECONNREFUSED or database locked errors

**Solution**:
1. Verify `DATABASE_URL` is correct
2. Check database file permissions (SQLite)
3. Ensure database migrations have run
4. For production, verify database is provisioned

---

## Additional Resources

- **[SETUP.md](./SETUP.md)** - Initial setup guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues
- **[Logging & Monitoring Guide](./docs/guides/logging-monitoring.md)** - Observability setup

---

**Configuration Complete!** 🎉

Your Discubot instance is now configured. Make sure to keep API keys secure and never commit `.env` files to version control.

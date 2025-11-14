# Discubot Deployment Guide

Complete guide to deploying Discubot to production using NuxtHub.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [NuxtHub Deployment](#nuxthub-deployment)
3. [Environment Configuration](#environment-configuration)
4. [Database Migrations](#database-migrations)
5. [Webhook Configuration](#webhook-configuration)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring Setup](#monitoring-setup)
8. [Troubleshooting](#troubleshooting)
9. [Alternative Deployment](#alternative-deployment)

---

## Prerequisites

### Required Accounts

- **NuxtHub Account** - [Sign up](https://hub.nuxt.com/)
- **Cloudflare Account** - Required for NuxtHub (auto-created)
- **GitHub Account** - For repository hosting (recommended)

### Before Deployment

1. **Verify local build works**:
   ```bash
   pnpm build
   pnpm preview
   ```

2. **Run tests**:
   ```bash
   pnpm test
   npx nuxt typecheck
   ```

3. **Commit all changes**:
   ```bash
   git add .
   git commit -m "chore: prepare for production deployment"
   git push origin main
   ```

---

## NuxtHub Deployment

### Step 1: Install NuxtHub CLI

```bash
# Install NuxtHub CLI globally
npm install -g nuxthub

# Or use npx (no installation required)
npx nuxthub --version
```

### Step 2: Link Project to NuxtHub

```bash
# Link your local project to NuxtHub
nuxthub link

# Follow the prompts:
# 1. Log in to NuxtHub (opens browser)
# 2. Select or create a project
# 3. Confirm project settings
```

This creates a `.nuxthub/` directory with project configuration (gitignored).

### Step 3: Configure Environment Variables

```bash
# Set environment variables via CLI
nuxthub env add ANTHROPIC_API_KEY sk-ant-api03-...
nuxthub env add NOTION_TOKEN secret_...
nuxthub env add NOTION_DATABASE_ID abc123def456...

# For Figma integration
nuxthub env add FIGMA_API_TOKEN figd_...
nuxthub env add MAILGUN_SIGNING_KEY your-key

# For Slack integration
nuxthub env add SLACK_CLIENT_ID 1234567890.1234567890
nuxthub env add SLACK_CLIENT_SECRET abcdef...
nuxthub env add SLACK_SIGNING_SECRET abcdef...

# Application URL (IMPORTANT!)
nuxthub env add NUXT_PUBLIC_SITE_URL https://your-domain.com

# Optional: Logging level
nuxthub env add LOG_LEVEL warn
```

Or set via **NuxtHub Dashboard**:
1. Go to [hub.nuxt.com](https://hub.nuxt.com/)
2. Select your project
3. Navigate to "Settings" → "Environment Variables"
4. Add each variable
5. Save changes

### Step 4: Deploy to Production

```bash
# Deploy current directory
nuxthub deploy

# Or deploy specific branch
nuxthub deploy --branch main

# With custom domain
nuxthub deploy --domain your-domain.com
```

Expected output:
```
✓ Building application...
✓ Optimizing bundle...
✓ Deploying to Cloudflare Workers...
✓ Running database migrations...
✓ Deployment complete!

🎉 Your app is live at:
   https://your-project.hub.nuxt.com
   https://your-domain.com (if custom domain)
```

### Step 5: Custom Domain (Optional)

**Via NuxtHub Dashboard**:
1. Go to project settings
2. Navigate to "Domains"
3. Click "Add Custom Domain"
4. Enter your domain (e.g., `discubot.example.com`)
5. Follow DNS configuration instructions
6. Wait for SSL certificate provisioning (~5 minutes)

**DNS Configuration**:
Add these records to your DNS provider:

```
Type: CNAME
Name: discubot (or @)
Value: your-project.hub.nuxt.com
TTL: Auto or 3600
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Core Services
ANTHROPIC_API_KEY=sk-ant-api03-...        # Claude AI
NOTION_TOKEN=secret_...                   # Notion integration
NOTION_DATABASE_ID=abc123def456...        # Target database
NUXT_PUBLIC_SITE_URL=https://your-domain.com  # Application URL

# Figma Integration (if used)
FIGMA_API_TOKEN=figd_...
MAILGUN_SIGNING_KEY=your-key

# Slack Integration (if used)
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=abcdef1234567890...
SLACK_SIGNING_SECRET=abcdef1234567890...
```

### Optional Environment Variables

```bash
# Logging
LOG_LEVEL=warn  # Options: debug, info, warn, error
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_WEBHOOK=100
RATE_LIMIT_API=60
RATE_LIMIT_AUTH=5
```

See **[CONFIGURATION.md](./CONFIGURATION.md)** for complete reference.

---

## Database Migrations

### Automatic Migrations (NuxtHub)

NuxtHub automatically runs migrations on deployment:

```bash
# Migrations run as part of deployment
nuxthub deploy
```

**What happens**:
1. Database (Cloudflare D1) is provisioned if not exists
2. Migration files in `layers/discubot/collections/*/server/database/migrations/` are executed
3. All 5 collections (discussions, jobs, tasks, configs, userMappings) are created

### Manual Migrations (If Needed)

```bash
# Connect to production database
nuxthub db shell

# Run SQL directly
sqlite> .tables
sqlite> SELECT COUNT(*) FROM discussions;
sqlite> .exit
```

### Verifying Migrations

```bash
# Check database status via API
curl https://your-domain.com/api/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": "healthy",  # ✅ Confirms DB is working
    "ai": "healthy",
    "notion": "healthy"
  }
}
```

---

## Webhook Configuration

After deployment, update webhook URLs on platforms:

### Figma (via Mailgun)

1. Go to [Mailgun Dashboard](https://app.mailgun.com/)
2. Navigate to "Sending" → "Domains" → Select domain
3. Click "Webhooks"
4. Add webhook:
   - **Event**: Any event that forwards Figma emails
   - **URL**: `https://your-domain.com/api/webhooks/mailgun`
   - **Method**: POST
5. Save and test webhook delivery

### Slack

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Select your app
3. Navigate to "Event Subscriptions"
4. Update **Request URL**: `https://your-domain.com/api/webhooks/slack`
5. Wait for verification (Slack sends challenge request)
6. Ensure "Verified" checkmark appears
7. Save changes

**OAuth Redirect URLs** (if using Slack OAuth):
1. In Slack app settings, go to "OAuth & Permissions"
2. Add redirect URL: `https://your-domain.com/api/oauth/slack/callback`
3. Save changes

### Testing Webhooks

```bash
# Test Mailgun webhook
curl -X POST https://your-domain.com/api/webhooks/mailgun \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "figma@example.com",
    "body-plain": "Test message",
    "signature": { "timestamp": "...", "token": "...", "signature": "..." }
  }'

# Test Slack webhook (URL verification)
curl -X POST https://your-domain.com/api/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test123"
  }'

# Expected response: { "challenge": "test123" }
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T10:30:00.000Z",
  "checks": {
    "database": "healthy",
    "ai": "healthy",
    "notion": "healthy"
  },
  "system": {
    "uptime": 3600,
    "memory": {
      "used": 45.2,
      "total": 128
    }
  }
}
```

### 2. Admin Dashboard

Visit `https://your-domain.com` and verify:
- Dashboard loads without errors
- Authentication works (if enabled)
- Stats cards display (zeros are OK initially)
- Navigation works (Configs, Jobs, Discussions, Tasks)

### 3. Create Test Configuration

1. Navigate to "Configs" page
2. Click "New Source Config"
3. Fill in required fields
4. Click "Test Connection"
5. Verify both source and Notion connections succeed
6. Save configuration

### 4. Process Test Discussion

```bash
curl -X POST https://your-domain.com/api/discussions/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "discussion": {
      "sourceType": "figma",
      "sourceThreadId": "test-123",
      "sourceUrl": "https://figma.com/...",
      "teamId": "your-team-id",
      "authorHandle": "test-user",
      "title": "Test Discussion",
      "content": "This is a test discussion to verify deployment",
      "participants": ["test-user"],
      "timestamp": "2025-11-14T10:30:00Z"
    },
    "skipAI": true,
    "skipNotion": true
  }'
```

Expected response:
```json
{
  "success": true,
  "discussion": {
    "id": "disc_...",
    "status": "completed"
  }
}
```

### 5. Check Logs

**Via NuxtHub Dashboard**:
1. Go to project → "Logs"
2. Filter by time range
3. Look for processing events
4. Verify no errors

**Via CLI**:
```bash
nuxthub logs --tail
```

---

## Monitoring Setup

### Built-in Monitoring

Discubot includes built-in monitoring endpoints:

**Health Check** (for uptime monitoring):
```bash
GET https://your-domain.com/api/health
```

**Performance Metrics** (for dashboard integration):
```bash
GET https://your-domain.com/api/metrics
```

### External Monitoring Services

#### Uptime Monitoring

**Recommended Services**:
- [UptimeRobot](https://uptimerobot.com/) - Free tier available
- [Pingdom](https://www.pingdom.com/) - Comprehensive monitoring
- [Better Uptime](https://betteruptime.com/) - Developer-friendly

**Setup**:
1. Create monitor for `https://your-domain.com/api/health`
2. Set check interval (5 minutes recommended)
3. Configure alerts (email, Slack, SMS)
4. Set expected response: `200 OK` with `"status":"healthy"`

#### Performance Monitoring

**Cloudflare Analytics** (included with NuxtHub):
1. Go to Cloudflare Dashboard
2. Navigate to "Analytics & Logs" → "Web Analytics"
3. View request counts, response times, error rates

**Custom Dashboard** (Grafana):
1. Set up Grafana instance
2. Configure data source: `https://your-domain.com/api/metrics`
3. Create dashboards for:
   - Request rate and latency
   - Error rates by endpoint
   - Processing pipeline durations
   - Database query performance

#### Error Tracking

**Sentry** (recommended):
```bash
# Install Sentry
pnpm add @sentry/nuxt

# Configure in nuxt.config.ts
export default defineNuxtConfig({
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
  }
})
```

---

## Troubleshooting

### Issue: Deployment fails with build errors

**Symptoms**: `nuxthub deploy` fails during build step

**Solution**:
```bash
# Test build locally
pnpm build

# Check for type errors
npx nuxt typecheck

# Fix errors and redeploy
nuxthub deploy
```

### Issue: Database migrations fail

**Symptoms**: "Table already exists" or migration errors

**Solution**:
```bash
# Connect to database
nuxthub db shell

# Drop tables (⚠️ DESTRUCTIVE - only do in non-production)
sqlite> DROP TABLE IF EXISTS discussions;
sqlite> DROP TABLE IF EXISTS jobs;
sqlite> DROP TABLE IF EXISTS tasks;
sqlite> DROP TABLE IF EXISTS configs;
sqlite> DROP TABLE IF EXISTS user_mappings;

# Redeploy (migrations will run)
nuxthub deploy
```

### Issue: Environment variables not available

**Symptoms**: API returns "Missing configuration" errors

**Solution**:
1. Verify variables are set in NuxtHub dashboard
2. Restart deployment:
   ```bash
   nuxthub deploy
   ```
3. Check variable names match exactly (case-sensitive)
4. Ensure no trailing spaces in values

### Issue: Webhooks return 401 Unauthorized

**Symptoms**: Slack/Mailgun webhooks fail signature verification

**Solution**:
1. Verify signing secrets are correct in environment variables
2. Check webhook URLs match deployment domain exactly
3. Ensure HTTPS is used (required for production)
4. Test signature verification:
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/slack \
     -H "X-Slack-Signature: v0=..." \
     -H "X-Slack-Request-Timestamp: 1234567890" \
     -d '{"type":"url_verification","challenge":"test"}'
   ```

### Issue: High latency or timeouts

**Symptoms**: Requests take >10s or timeout

**Solution**:
1. Check Anthropic AI response times (may need faster model)
2. Review Notion API rate limiting (200ms delay may be too aggressive)
3. Optimize database queries (add indexes if needed)
4. Consider enabling KV caching for AI responses
5. Review Cloudflare analytics for bottlenecks

### Issue: Database locked errors

**Symptoms**: SQLite "database is locked" errors

**Solution**:
This shouldn't happen with Cloudflare D1, but if using custom SQLite:
1. Ensure only one writer at a time
2. Consider PostgreSQL for concurrent writes
3. Implement connection pooling

---

## Alternative Deployment

### Self-Hosted (Vercel/Netlify/Railway)

Discubot can be deployed to any platform supporting Nuxt 3:

**Vercel**:
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add ANTHROPIC_API_KEY
vercel env add NOTION_TOKEN
# ... (set all required variables)
```

**Netlify**:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod

# Set environment variables via Netlify dashboard
```

**Note**: You'll need to provide your own database (PostgreSQL/Turso) instead of Cloudflare D1.

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .
RUN pnpm build

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

```bash
# Build and run
docker build -t discubot .
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e NOTION_TOKEN=secret_... \
  discubot
```

---

## Rollback Strategy

### Rolling Back a Deployment

```bash
# View deployment history
nuxthub deployments

# Rollback to previous version
nuxthub rollback

# Or rollback to specific deployment
nuxthub rollback --deployment <deployment-id>
```

### Database Rollback

⚠️ **Database rollbacks are more complex**. Best practices:

1. **Backup before migrations**:
   ```bash
   # Export database before deployment
   nuxthub db export > backup.sql
   ```

2. **Test migrations in staging first**

3. **Use reversible migrations**:
   ```typescript
   // Good: Can be reversed
   await db.schema.alterTable('discussions')
     .addColumn('newField', 'text')
     .execute()

   // Bad: Hard to reverse
   await db.schema.alterTable('discussions')
     .dropColumn('oldField')
     .execute()
   ```

---

## Security Checklist

Before going live, verify:

- ✅ All environment variables are set (no placeholders)
- ✅ Webhook signature verification is enabled
- ✅ HTTPS is enforced (automatic with NuxtHub)
- ✅ Rate limiting is configured appropriately
- ✅ Secrets are not committed to git
- ✅ Database backups are configured
- ✅ Monitoring and alerts are set up
- ✅ Error tracking is enabled (Sentry)
- ✅ Admin dashboard is secured (authentication enabled)

---

## Post-Deployment Checklist

- [ ] Health check endpoint returns 200 OK
- [ ] Admin dashboard loads without errors
- [ ] Webhooks are configured and verified
- [ ] Test discussion processes successfully
- [ ] Notion tasks are created correctly
- [ ] User mappings work (if applicable)
- [ ] Logs show no errors
- [ ] Monitoring alerts are configured
- [ ] Team has access to admin dashboard
- [ ] Documentation is up to date

---

## Additional Resources

- **[CONFIGURATION.md](./CONFIGURATION.md)** - Environment variable reference
- **[SETUP.md](./SETUP.md)** - Development setup
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues
- **[Logging & Monitoring Guide](./docs/guides/logging-monitoring.md)** - Observability
- **[NuxtHub Docs](https://hub.nuxt.com/docs)** - Official NuxtHub documentation

---

**Deployment Complete!** 🚀

Your Discubot instance is now live in production. Monitor the health check endpoint and logs for the first few days to ensure everything is running smoothly.

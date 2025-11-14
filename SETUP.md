# Discubot Setup Guide

Complete guide to setting up Discubot for local development.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Figma Integration Setup](#figma-integration-setup)
6. [Slack Integration Setup](#slack-integration-setup)
7. [Notion Integration Setup](#notion-integration-setup)
8. [Verification](#verification)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js 20.x or higher** - [Download](https://nodejs.org/)
- **pnpm** - Install with `npm install -g pnpm`
- **Git** - [Download](https://git-scm.com/)

### Required Accounts & API Keys

- **Anthropic API Key** - [Get API key](https://console.anthropic.com/)
- **Notion Integration** - [Create integration](https://www.notion.so/my-integrations)
- **Figma API Token** (optional) - [Get token](https://www.figma.com/developers/api#access-tokens)
- **Slack App** (optional) - [Create app](https://api.slack.com/apps)
- **Resend Account** (recommended, for Figma emails) - [Sign up](https://resend.com/) - See [Resend Email Forwarding Guide](docs/guides/resend-email-forwarding.md)
- **Mailgun Account** (legacy, for Figma emails) - [Sign up](https://www.mailgun.com/) - Prefer Resend instead

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/discubot.git
cd discubot
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all required packages including:
- Nuxt 3 framework
- Nuxt UI 4 components
- Crouton ORM
- Anthropic SDK
- Notion SDK
- All testing utilities

### 3. Verify Installation

```bash
# Check Node version
node --version  # Should be 20.x or higher

# Check pnpm version
pnpm --version

# Verify Nuxt is working
npx nuxt --version
```

---

## Database Setup

Discubot uses Drizzle ORM with Crouton for database operations.

### Local Development (SQLite)

The default configuration uses SQLite for local development:

```bash
# Database is automatically created on first run
pnpm dev
```

Database file location: `.data/db.sqlite3` (gitignored)

### Running Migrations

```bash
# Generate migrations from schema changes
pnpm db:generate

# Run migrations
pnpm db:migrate

# View database in Drizzle Studio
pnpm db:studio
```

### Crouton Collections

Discubot uses 4 Crouton collections:

1. **discussions** - Discussion threads from Figma/Slack
2. **jobs** - Processing job records
3. **tasks** - Created Notion tasks
4. **configs** - Source configuration (Figma/Slack/Notion settings)
5. **userMappings** - User mapping for @mentions

Collections are auto-generated in `layers/discubot/collections/` with ~100 files each.

---

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Configure Required Variables

Edit `.env` and set the following **required** variables:

```bash
# REQUIRED: Anthropic API Key for AI analysis
ANTHROPIC_API_KEY=sk-ant-api03-...

# REQUIRED: Your application URL (for webhooks and OAuth)
NUXT_PUBLIC_SITE_URL=http://localhost:3000

# REQUIRED: Notion Integration Token
NOTION_TOKEN=secret_...

# REQUIRED: Notion Database ID (where tasks will be created)
NOTION_DATABASE_ID=abc123def456...
```

### 3. Configure Optional Variables (for integrations)

#### Figma Integration (via Resend - Recommended)
```bash
FIGMA_API_TOKEN=figd_...
RESEND_API_TOKEN=re_...  # Already configured for email sending
RESEND_WEBHOOK_SIGNING_SECRET=whsec_...  # Get from Resend webhook settings
```

**See**: [Resend Email Forwarding Guide](docs/guides/resend-email-forwarding.md) for complete setup.

#### Figma Integration (via Mailgun - Legacy)
```bash
FIGMA_API_TOKEN=figd_...
MAILGUN_SIGNING_KEY=your-mailgun-signing-key
```

#### Slack Integration
```bash
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=abcdef1234567890abcdef1234567890
SLACK_SIGNING_SECRET=abcdef1234567890abcdef1234567890
```

### 4. Optional Configuration

```bash
# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Node environment
NODE_ENV=development
```

See **[CONFIGURATION.md](./CONFIGURATION.md)** for complete environment variable reference.

---

## Figma Integration Setup

**⚠️ Recommended**: Use **Resend** for email forwarding (consolidates sending + receiving). See [Resend Email Forwarding Guide](docs/guides/resend-email-forwarding.md) for complete setup.

### Step 1: Get Figma API Token

1. Go to [Figma Account Settings](https://www.figma.com/settings)
2. Scroll to "Personal Access Tokens"
3. Click "Generate new token"
4. Copy token (starts with `figd_`)
5. Add to `.env`: `FIGMA_API_TOKEN=figd_...`

### Step 2: Set Up Email Forwarding

**Option A: Resend (Recommended)**

Follow the complete guide: [Resend Email Forwarding Guide](docs/guides/resend-email-forwarding.md)

Quick summary:
1. Verify domain in Resend dashboard
2. Configure MX records for inbound email
3. Create webhook endpoint: `https://yourdomain.com/api/webhooks/resend`
4. Add `RESEND_WEBHOOK_SIGNING_SECRET` to `.env`

**Option B: Mailgun (Legacy)**

1. Create [Mailgun account](https://www.mailgun.com/)
2. Get your webhook signing key from Mailgun dashboard
3. Add to `.env`: `MAILGUN_SIGNING_KEY=your-key`
4. Configure Mailgun to forward Figma notification emails to `https://yourdomain.com/api/webhooks/mailgun`

### Step 3: Configure Figma in Admin UI

1. Start dev server: `pnpm dev`
2. Navigate to `http://localhost:3000/dashboard/[team]/discubot/configs`
3. Click "New Source Config"
4. Select "Figma" as source type
5. Fill in:
   - **Name**: e.g., "Design Team Figma"
   - **API Token**: Your Figma token
   - **Email**: Email address receiving Figma notifications
   - **Notion Token**: Your Notion integration token
   - **Notion Database ID**: Target database ID
   - **Anthropic API Key**: Your Claude API key
6. Click "Test Connection" to verify
7. Save configuration

See **[Figma Integration Guide](./docs/guides/figma-integration.md)** for complete setup.

---

## Slack Integration Setup

### Step 1: Create Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "Discubot") and select your workspace
4. Click "Create App"

### Step 2: Configure OAuth & Permissions

1. In your app settings, go to "OAuth & Permissions"
2. Add the following **Bot Token Scopes**:
   - `app_mentions:read` - Detect @mentions
   - `channels:history` - Read public channels
   - `channels:read` - View channel info
   - `chat:write` - Post replies
   - `im:history` - Read DMs
   - `mpim:history` - Read group DMs
   - `reactions:write` - Add emoji reactions
   - `users:read` - View user profiles
   - `users:read.email` - Get user emails (for @mentions)
3. Save changes

### Step 3: Configure Environment Variables

1. In Slack app settings, go to "Basic Information"
2. Copy the following values to `.env`:
   ```bash
   SLACK_CLIENT_ID=1234567890.1234567890
   SLACK_CLIENT_SECRET=abcdef1234567890abcdef1234567890
   SLACK_SIGNING_SECRET=abcdef1234567890abcdef1234567890
   ```

### Step 4: Enable Event Subscriptions

1. In Slack app settings, go to "Event Subscriptions"
2. Enable events
3. Set Request URL to: `https://your-domain.com/api/webhooks/slack`
4. Subscribe to the following **bot events**:
   - `app_mention` - When bot is @mentioned
   - `message.channels` - Messages in channels
   - `message.im` - DMs to bot
   - `message.mpim` - Group DMs
5. Save changes

### Step 5: Install App to Workspace

1. Go to "OAuth & Permissions" in Slack app settings
2. Click "Install to Workspace"
3. Authorize the app
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### Step 6: Configure Slack in Admin UI

1. Navigate to `http://localhost:3000/dashboard/[team]/discubot/configs`
2. Click "New Source Config"
3. Select "Slack" as source type
4. Fill in:
   - **Name**: e.g., "Engineering Workspace"
   - **API Token**: Bot User OAuth Token (`xoxb-...`)
   - **Webhook URL**: Your Slack webhook URL
   - **Notion Token**: Your Notion integration token
   - **Notion Database ID**: Target database ID
   - **Anthropic API Key**: Your Claude API key
5. Click "Test Connection" to verify
6. Save configuration

See **[Slack Integration Guide](./docs/guides/slack-integration.md)** for complete setup.

---

## Notion Integration Setup

### Step 1: Create Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "+ New integration"
3. Fill in:
   - **Name**: e.g., "Discubot"
   - **Associated workspace**: Select your workspace
   - **Type**: Internal Integration
4. Click "Submit"
5. Copy the **Internal Integration Token** (starts with `secret_`)
6. Add to `.env`: `NOTION_TOKEN=secret_...`

### Step 2: Create Notion Database

1. In Notion, create a new database (Full page or inline)
2. Add the following properties (Discubot will use these):
   - **Title** (default Title property)
   - **Status** (Status or Select property)
   - **Priority** (Select property - optional)
   - **Assignee** (Person property - optional)
   - **Summary** (Text property - optional)
   - **Source** (URL property - optional)
   - **Discussion ID** (Text property - optional)

### Step 3: Share Database with Integration

1. Open your Notion database
2. Click "..." menu in top right
3. Click "Connections" or "Add connections"
4. Select your "Discubot" integration
5. Click "Confirm"

### Step 4: Get Database ID

The database ID is in the URL:

```
https://notion.so/workspace/abc123def456789...?v=...
                          ^^^^^^^^^^^^^^^^^^^^
                          This is your database ID
```

Add to `.env`: `NOTION_DATABASE_ID=abc123def456...`

### Step 5: Test Notion Connection

```bash
# Start dev server
pnpm dev

# Test Notion connection via API
curl -X POST http://localhost:3000/api/configs/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "type": "testByConfig",
    "config": {
      "notionToken": "secret_...",
      "notionDatabaseId": "abc123def456..."
    }
  }'
```

Expected response:
```json
{
  "notionConnected": true,
  "notionDetails": {
    "databaseTitle": "Your Database Name",
    "databaseUrl": "https://notion.so/..."
  }
}
```

---

## Verification

### 1. Start Development Server

```bash
pnpm dev
```

You should see:
```
✔ Nuxt started at http://localhost:3000
✔ Security checks passed (or warnings for missing config)
```

### 2. Check Admin Dashboard

Navigate to `http://localhost:3000` and verify:
- Dashboard loads without errors
- Stats cards show zeros (no data yet)
- Navigation works (Configs, Jobs, Discussions, Tasks)

### 3. Run Type Checking

```bash
npx nuxt typecheck
```

Expected: No NEW type errors (167 pre-existing template errors are OK)

### 4. Run Tests

```bash
# Run all tests
pnpm test

# Expected results:
# - 235+ passing tests
# - 42 expected failures (missing ANTHROPIC_API_KEY in tests)
# - 32 skipped E2E tests
```

### 5. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-11-14T...",
  "checks": {
    "database": "healthy",
    "ai": "healthy",
    "notion": "healthy"
  }
}
```

---

## Troubleshooting

### Issue: `pnpm install` fails

**Solution**:
```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and lock file
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install
```

### Issue: Database migration errors

**Solution**:
```bash
# Remove existing database
rm -rf .data/db.sqlite3

# Regenerate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate
```

### Issue: Type errors after installation

**Solution**:
```bash
# Prepare Nuxt types
npx nuxt prepare

# Run type check
npx nuxt typecheck
```

167 pre-existing template errors are expected and can be ignored.

### Issue: Webhook signature verification fails

**Solution**:
1. Verify signing secrets are correct in `.env`
2. Check webhook payload format matches expected structure
3. In development, you can disable signature verification temporarily:
   ```typescript
   // Set in .env for local testing only
   NODE_ENV=development
   ```

### Issue: Notion API returns 401 Unauthorized

**Solution**:
1. Verify integration token is correct (`secret_...`)
2. Ensure database is shared with the integration:
   - Open database → "..." → "Connections" → Select integration
3. Check token has not expired

### Issue: ANTHROPIC_API_KEY not working

**Solution**:
1. Verify API key format: `sk-ant-api03-...`
2. Check API key is active in [Anthropic Console](https://console.anthropic.com/)
3. Verify you have API credits available

### Issue: Port 3000 already in use

**Solution**:
```bash
# Use a different port
PORT=3001 pnpm dev

# Or kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

---

## Next Steps

1. **Configure Integrations** - Set up Figma and/or Slack following guides above
2. **Test Processing** - Create a test discussion and verify it processes correctly
3. **Set Up User Mappings** - Map users between Slack/Figma and Notion for @mentions
4. **Deploy to Production** - See **[DEPLOYMENT.md](./DEPLOYMENT.md)**

---

## Additional Resources

- **[CONFIGURATION.md](./CONFIGURATION.md)** - Complete environment variable reference
- **[Figma Integration Guide](./docs/guides/figma-integration.md)** - Detailed Figma setup
- **[Slack Integration Guide](./docs/guides/slack-integration.md)** - Detailed Slack setup
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[CLAUDE.md](./CLAUDE.md)** - Development conventions and patterns

---

**Setup Complete!** 🎉

You should now have Discubot running locally. Visit the admin dashboard at `http://localhost:3000` to configure your integrations and start tracking discussions.

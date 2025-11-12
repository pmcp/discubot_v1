# Slack Integration - Quick Start

**5-minute guide to get Slack integration working**

## Setup

### 1. Create Slack App

1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Enter app name (e.g., "Discubot") and select workspace
4. You'll be redirected to app configuration

### 2. Configure OAuth Scopes

1. Navigate to **OAuth & Permissions** (left sidebar)
2. Scroll to **Bot Token Scopes**
3. Add these scopes:
   - `channels:history` - Read public channel messages
   - `chat:write` - Send messages and replies
   - `reactions:write` - Add emoji reactions
   - `app_mentions:read` - Receive @mentions
   - `im:history` - Read DM history
   - `mpim:history` - Read group DM history

### 3. Add Redirect URL

1. Stay in **OAuth & Permissions**
2. Scroll to **Redirect URLs**
3. Add: `http://localhost:3000/api/oauth/slack/callback` (for local dev)
4. Click "Save URLs"

### 4. Get Credentials

#### Client ID & Secret

1. Navigate to **Basic Information** (left sidebar)
2. Scroll to **App Credentials**
3. Copy **Client ID** → save to `.env` as `SLACK_CLIENT_ID`
4. Click "Show" next to **Client Secret** → save to `.env` as `SLACK_CLIENT_SECRET`
5. Copy **Signing Secret** → save as `SLACK_SIGNING_SECRET` (for Phase 6)

### 5. Environment Variables

Create `.env` file:

```bash
# Slack OAuth
SLACK_CLIENT_ID=123456789.123456789
SLACK_CLIENT_SECRET=abc123def456ghi789
SLACK_SIGNING_SECRET=abc123...  # For webhook verification (Phase 6)

# Notion Integration
NOTION_TOKEN=secret_abc123...
NOTION_DB_ID=abc123def456...

# AI Service
ANTHROPIC_API_KEY=sk-ant-...
```

### 6. Install App to Workspace

1. Navigate to **Install App** (left sidebar)
2. Click "Install to Workspace"
3. Review permissions, click "Allow"
4. Copy **Bot User OAuth Token** (starts with `xoxb-`)
5. Save to `.env` as `SLACK_BOT_TOKEN`

```bash
# Add to .env
SLACK_BOT_TOKEN=xoxb-123456789-123456789-abc123def456
```

## Test OAuth Flow

### 1. Start Dev Server

```bash
pnpm dev
```

### 2. Test Installation Flow

Open in browser:
```
http://localhost:3000/api/oauth/slack/install
```

**Expected:**
1. Redirects to Slack authorization page
2. Shows requested permissions
3. Click "Allow"
4. Redirects back to success page

## Configure Slack Events

### 1. Setup Webhook URL

For local development, use [ngrok](https://ngrok.com/):

```bash
# Install ngrok if needed
brew install ngrok

# Start tunnel
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 2. Enable Events API

1. In Slack App config, navigate to **Event Subscriptions**
2. Toggle **Enable Events** to **ON**
3. Enter **Request URL**: `https://abc123.ngrok.io/api/webhooks/slack`
4. Slack will send a challenge request to verify the URL
5. You should see "Verified ✓"

### 3. Subscribe to Events

1. Scroll to **Subscribe to bot events**
2. Click "Add Bot User Event"
3. Add these events:
   - `app_mention` - @mentions in channels
   - `message.channels` - Messages in public channels
   - `message.im` - Direct messages to bot
   - `message.mpim` - Group DM messages
4. Click "Save Changes"
5. Click "Reinstall your app" banner at top (if shown)

## Test the Integration

### Method 1: Send Message in Slack (Real Flow)

1. In Slack, invite your bot to a channel:
   ```
   /invite @discubot
   ```

2. Send a message with an action item:
   ```
   Can we update the dashboard to show more metrics? @designer
   ```

3. Bot should:
   - React with 👀 (processing)
   - Analyze with AI
   - Create Notion task
   - React with ✅ (done)

### Method 2: Direct API Test

```bash
# Test URL verification (one-time)
curl -X POST http://localhost:3000/api/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test-challenge-123",
    "token": "verification-token"
  }'

# Expected: { "challenge": "test-challenge-123" }

# Test message event
curl -X POST http://localhost:3000/api/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event_callback",
    "team_id": "T05N3B9TGUF",
    "event": {
      "type": "message",
      "user": "U05N3B9TGUF",
      "text": "Can we update the dashboard?",
      "ts": "1699564800.123456",
      "channel": "C05N3B9TGUF",
      "channel_type": "channel"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "discussionId": "C05N3B9TGUF:1699564800.123456",
  "tasksCreated": 1,
  "processingTimeMs": 3250
}
```

### Method 3: Test Threaded Reply

In Slack:

1. Send initial message:
   ```
   What do you think about the new design?
   ```

2. Reply in thread:
   ```
   I think we should update the colors to match brand guidelines
   ```

3. Bot processes the thread and creates task

## Run Tests

```bash
# All Phase 4 tests (113+ unit + 17 integration)
pnpm test tests/adapters/slack.test.ts         # 38 tests
pnpm test tests/api/webhooks/slack.test.ts     # 35 tests
pnpm test tests/api/oauth/slack.test.ts        # 40+ tests
pnpm test tests/integration/slack-flow.test.ts # 17 tests

# Or run all tests
pnpm test
```

## Architecture Overview

```
Slack Channel
     ↓
User sends message
     ↓
Slack Events API
     ↓
POST /api/webhooks/slack
     ↓
Slack Adapter (parse event)
     ↓
Processor Service (orchestrate)
     ↓
  ┌──┴──┐
  ↓     ↓
AI    Notion
  ↓     ↓
Generate Create
Summary  Task
```

## Common Issues

### Webhook Not Verified

**Symptom**: "The URL returned a non-200 status code"

**Solutions:**
- Verify server is running: `pnpm dev`
- Check ngrok tunnel is active: `ngrok http 3000`
- Update Request URL with new ngrok URL (ngrok URLs change each restart)
- Check server logs for errors

### Bot Not Receiving Messages

**Symptom**: No webhook events received

**Solutions:**
- Invite bot to channel: `/invite @your-bot-name`
- Verify Event Subscriptions includes `message.channels`
- Check bot has required scopes in OAuth settings
- Reinstall app after changing scopes

### OAuth Redirect Fails

**Symptom**: "redirect_uri_mismatch" error

**Solutions:**
- Add exact redirect URI in Slack OAuth settings
- Match protocol: `http://localhost:3000` for local dev
- Include full path: `/api/oauth/slack/callback`

### Invalid State Token

**Symptom**: "Invalid or expired state token"

**Solutions:**
- Complete OAuth flow within 10 minutes
- Don't refresh callback page (tokens are single-use)
- For production: Move to persistent storage (Phase 5)

### AI Analysis Fails

**Symptom**: Processing fails with AI error

**Solutions:**
- Check `ANTHROPIC_API_KEY` is set correctly in `.env`
- Verify API key is valid (not revoked)
- Check API usage limits

### Type Check Errors

**Run:**
```bash
npx nuxt typecheck
```

**Note:** 86 pre-existing template errors are expected (not related to Slack integration)

## Environment Variables Checklist

```bash
# Required for Slack
✅ SLACK_CLIENT_ID=...
✅ SLACK_CLIENT_SECRET=...
✅ SLACK_BOT_TOKEN=xoxb-...

# Required for Notion
✅ NOTION_TOKEN=...
✅ NOTION_DB_ID=...

# Required for AI
✅ ANTHROPIC_API_KEY=...

# Optional (Phase 6)
⏹️ SLACK_SIGNING_SECRET=...
⏹️ SLACK_TEAM_ID=...
```

## Slack App Checklist

In [Slack API Dashboard](https://api.slack.com/apps):

- ✅ OAuth scopes added (6 scopes)
- ✅ Redirect URL configured
- ✅ App installed to workspace
- ✅ Bot token copied to `.env`
- ✅ Events API enabled
- ✅ Request URL verified
- ✅ Bot events subscribed (4 events)

## Production Deployment

For production deployment:

1. **Update Redirect URL:**
   ```
   https://your-app.com/api/oauth/slack/callback
   ```

2. **Update Webhook URL:**
   ```
   https://your-app.com/api/webhooks/slack
   ```

3. **Use HTTPS:**
   - Slack requires HTTPS for OAuth and webhooks
   - NuxtHub provides HTTPS automatically

4. **Set Environment Variables:**
   - Configure all variables in NuxtHub dashboard
   - Never commit secrets to git

5. **Enable Webhook Verification (Phase 6):**
   - Implement signature verification
   - Use `SLACK_SIGNING_SECRET`

## Status Emoji Guide

Watch for these reactions from the bot:

- 👀 - Processing started
- ⏳ - In processing queue
- 🤖 - AI analyzing discussion
- ✅ - Task created successfully
- ❌ - Error occurred
- 🔄 - Retrying after failure

## Next Steps

- See [Full Slack Integration Guide](./slack-integration.md) for detailed documentation
- See [Figma Integration Guide](./figma-integration.md) for comparison with Figma adapter
- See [PROGRESS_TRACKER.md](../PROGRESS_TRACKER.md) for Phase 5 (Admin UI)

---

**Need help?** Check the [Slack Integration Guide](./slack-integration.md) for detailed troubleshooting.

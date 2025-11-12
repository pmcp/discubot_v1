# Real-World Testing Guide

**Goal**: Test the complete Discubot flow from Slack message → AI analysis → Notion task creation

**Estimated Time**: 20-30 minutes

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Slack workspace (with admin access)
- [ ] Notion account with a database
- [ ] Anthropic API key
- [ ] ngrok installed (for webhook testing)
- [ ] Dev server running

---

## Part 1: Environment Setup (10 min)

### Step 1.1: Check Environment Variables

Create or update your `.env` file with these required variables:

```bash
# Core Application
BASE_URL=http://localhost:3000
NUXT_SESSION_PASSWORD=your-32-character-session-secret

# AI Service (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Notion Integration (REQUIRED)
NOTION_TOKEN=secret_...
NOTION_DB_ID=your-database-id

# Slack OAuth (REQUIRED for Slack testing)
SLACK_CLIENT_ID=123456789.123456789
SLACK_CLIENT_SECRET=abc123def456ghi789
```

### Step 1.2: Get Missing Credentials

#### Anthropic API Key
1. Go to https://console.anthropic.com/
2. Navigate to API Keys
3. Create new key
4. Copy to `.env` as `ANTHROPIC_API_KEY`

#### Notion Integration
1. Go to https://www.notion.so/my-integrations
2. Create new integration
3. Copy "Internal Integration Token" to `.env` as `NOTION_TOKEN`
4. Create a database in Notion with these columns:
   - Title (Title)
   - Status (Select)
   - Source (Text)
   - Source URL (URL)
5. Share database with your integration
6. Copy database ID from URL to `.env` as `NOTION_DB_ID`
   - Example URL: `https://notion.so/abc123def456...`
   - Database ID: `abc123def456`

#### Slack App (if testing Slack integration)
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "Discubot Test" and select workspace
4. Get credentials from **Basic Information** → **App Credentials**:
   - Copy **Client ID** to `.env` as `SLACK_CLIENT_ID`
   - Copy **Client Secret** to `.env` as `SLACK_CLIENT_SECRET`

---

## Part 2: Slack App Configuration (5 min)

### Step 2.1: Add OAuth Scopes

1. Navigate to **OAuth & Permissions**
2. Under **Bot Token Scopes**, add:
   - `channels:history` - Read public channels
   - `chat:write` - Send messages
   - `reactions:write` - Add reactions
   - `app_mentions:read` - Receive @mentions
   - `im:history` - Read DMs
   - `mpim:history` - Read group DMs

### Step 2.2: Install App to Workspace

1. Navigate to **Install App**
2. Click "Install to Workspace"
3. Review permissions → Click "Allow"
4. Copy **Bot User OAuth Token** (starts with `xoxb-`)
5. Add to `.env`:
   ```bash
   SLACK_BOT_TOKEN=xoxb-123456789-123456789-abc123def456
   ```

---

## Part 3: Setup Webhook Tunnel (5 min)

### Step 3.1: Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 3.2: Start Development Server

```bash
# Terminal 1: Start Nuxt
pnpm dev
```

Server should be running at `http://localhost:3000`

### Step 3.3: Start ngrok Tunnel

```bash
# Terminal 2: Start ngrok
ngrok http 3000
```

**Copy the HTTPS URL** (e.g., `https://abc123def456.ngrok.io`)

### Step 3.4: Configure Slack Webhook

1. Go back to Slack App settings
2. Navigate to **Event Subscriptions**
3. Toggle **Enable Events** to **ON**
4. Enter **Request URL**: `https://[your-ngrok-url]/api/webhooks/slack`
   - Example: `https://abc123def456.ngrok.io/api/webhooks/slack`
5. Wait for verification (should show "Verified ✓")

### Step 3.5: Subscribe to Bot Events

1. Under **Subscribe to bot events**, add:
   - `message.channels` - Messages in channels
   - `app_mention` - @mentions
2. Click **Save Changes**
3. If prompted, click **Reinstall App**

---

## Part 4: Create Test Configuration (2 min)

### Option A: Using Admin UI (Recommended)

1. Open browser: `http://localhost:3000`
2. Log in to your team
3. Navigate to `/dashboard/[team]/discubot/configs`
4. Click "Create New Config"
5. Fill in form:
   - **Name**: "Slack Test Config"
   - **Source Type**: Slack
   - **Team**: Your team ID
   - **Enabled**: Yes
   - **Slack Webhook URL**: `https://[ngrok-url]/api/webhooks/slack`
   - **API Token**: `xoxb-...` (your bot token)
   - **Notion Token**: `secret_...` (from `.env`)
   - **Notion Database ID**: Your database ID
   - **Anthropic API Key**: `sk-ant-...` (from `.env`)
6. Click **Test Connection** button
7. Verify both Source and Notion show ✅ Connected
8. Click **Save**

### Option B: Using API (Alternative)

```bash
curl -X POST http://localhost:3000/api/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Test Config",
    "sourceType": "slack",
    "teamId": "your-team-id",
    "enabled": true,
    "webhookUrl": "https://[ngrok-url]/api/webhooks/slack",
    "apiToken": "xoxb-...",
    "notionToken": "secret_...",
    "notionDatabaseId": "your-db-id",
    "anthropicApiKey": "sk-ant-..."
  }'
```

---

## Part 5: Test Real-World Scenario (5-10 min)

### Scenario: Design Discussion with Action Items

We'll simulate a real team discussion about a design update.

### Step 5.1: Invite Bot to Channel

1. In Slack, create a test channel (e.g., `#discubot-test`)
2. Invite your bot:
   ```
   /invite @discubot-test
   ```

### Step 5.2: Send Test Message

Send this message in the channel:

```
Hey team! 👋

We need to update the dashboard with the new design mockups.
Can @sarah take a look at the Figma file and implement the new
color scheme? We should have this done by Friday.

Also, we need to update the user profile page to match the new
brand guidelines.
```

### Step 5.3: Watch the Processing

**Expected behavior:**

1. **Immediate** - Bot reacts with 👀 (processing started)
2. **2-3 seconds** - AI analyzes the message
3. **3-5 seconds** - Notion tasks created
4. **5-6 seconds** - Bot reacts with ✅ (success)

### Step 5.4: Verify in Notion

1. Open your Notion database
2. You should see **2 new tasks**:
   - "Update dashboard with new design mockups"
   - "Update user profile page to match brand guidelines"
3. Each task should have:
   - Source: "Slack"
   - Source URL: Deep link to Slack message
   - Status: "To Do"

### Step 5.5: Check Admin Dashboard

1. Open `http://localhost:3000/dashboard/[team]/discubot/`
2. **Dashboard Stats** should show:
   - Recent Tasks: +2
   - Completed 24h: +1 discussion
3. **Recent Activity** should show:
   - New discussion processed
   - Link to original Slack message
4. Navigate to **Jobs** tab:
   - Should see completed job
   - Click job card to see details:
     - AI analysis summary
     - Task detection (2 tasks)
     - Processing time
     - Related discussion and config

### Step 5.6: Test Thread Processing

Create a threaded discussion:

1. Send initial message:
   ```
   What do you think about the new navigation design?
   ```

2. Reply in thread:
   ```
   I think we should move the search bar to the top right
   ```

3. Reply again:
   ```
   Also, let's add a dark mode toggle in the settings
   ```

4. Bot should:
   - Process the entire thread (3 messages)
   - Create task: "Move search bar to top right and add dark mode toggle"
   - React with ✅ on thread parent

---

## Part 6: Test Error Handling (Optional)

### Test 6.1: Invalid API Key

1. In Admin UI, create new config with invalid Anthropic key
2. Click **Test Connection**
3. Should show: ❌ Source connected, ❌ AI service failed
4. Try to send message → Should fail gracefully
5. Check Jobs dashboard → Should show failed job with error message

### Test 6.2: Rate Limiting

Send 5 messages rapidly in Slack:
- Bot should handle gracefully
- Jobs should queue properly
- All should process successfully (might take longer)

---

## Troubleshooting

### Issue: Webhook Not Verified

**Symptom**: "The URL returned a non-200 status code"

**Solutions**:
1. Verify dev server is running: `pnpm dev`
2. Check ngrok tunnel: `ngrok http 3000`
3. Check server logs for errors
4. Try a new ngrok URL (they expire)

### Issue: Bot Doesn't React

**Symptom**: No 👀 reaction appears

**Solutions**:
1. Check bot is invited to channel: `/invite @bot-name`
2. Verify Event Subscriptions includes `message.channels`
3. Check ngrok logs: `http://127.0.0.1:4040` (ngrok inspector)
4. Check Nuxt server logs for errors

### Issue: No Tasks Created in Notion

**Symptom**: Bot reacts with ✅ but no Notion tasks

**Solutions**:
1. Verify Notion integration is shared with database
2. Check database has required columns (Title, Status, Source, Source URL)
3. Check Notion API token in config
4. Review error in Jobs dashboard

### Issue: AI Analysis Fails

**Symptom**: Processing fails with AI error

**Solutions**:
1. Check `ANTHROPIC_API_KEY` in `.env`
2. Verify API key is valid (not revoked)
3. Check API usage limits at console.anthropic.com
4. Check server logs for specific error

### Issue: Cannot Access Admin UI

**Symptom**: 404 or redirect issues

**Solutions**:
1. Ensure you're logged in
2. Check team ID in URL: `/dashboard/[team]/discubot`
3. Verify auth session is valid
4. Clear browser cookies and re-login

---

## Validation Checklist

After testing, verify:

- [x] ✅ Slack bot receives messages
- [x] ✅ Bot reacts with 👀 when processing
- [x] ✅ AI analyzes message content
- [x] ✅ Tasks created in Notion with correct data
- [x] ✅ Bot reacts with ✅ on success
- [x] ✅ Admin dashboard shows statistics
- [x] ✅ Recent activity feed updates
- [x] ✅ Jobs dashboard shows processing details
- [x] ✅ Thread replies are processed correctly
- [x] ✅ Error handling works (failed jobs shown)
- [x] ✅ Test connection endpoint validates configs

---

## Performance Benchmarks

Expected timing for typical discussion:

| Stage | Duration |
|-------|----------|
| Webhook receipt | <100ms |
| Config loading | <200ms |
| Thread fetching | 200-500ms |
| AI analysis | 2-3s |
| Notion task creation | 200-300ms per task |
| Status update | 200ms |
| **Total** | **3-5s** |

---

## Next Steps

After successful testing:

1. **Test Figma Integration** - See `docs/guides/figma-quick-start.md`
2. **Complete Task 5.6** - Polish & responsive design
3. **Phase 6** - Security hardening and production deployment
4. **Set up monitoring** - Track processing times and errors

---

## Quick Command Reference

```bash
# Start dev server
pnpm dev

# Start ngrok tunnel
ngrok http 3000

# Run type checking
npx nuxt typecheck

# Run all tests
pnpm test

# Run specific test suite
pnpm test tests/integration/slack-flow.test.ts

# View ngrok requests
# Open in browser: http://127.0.0.1:4040
```

---

**Need Help?**
- Check [Slack Integration Guide](./slack-integration.md) for detailed docs
- Check [PROGRESS_TRACKER.md](../PROGRESS_TRACKER.md) for project status
- Review server logs for error details
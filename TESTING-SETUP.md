# Real-World Testing Setup

**Status**: Ready to test! Just need to configure Notion integration.

---

## Current Configuration Status

### ✅ Already Configured
- **Anthropic API Key** - AI service ready
- **Slack OAuth** - Client ID and Secret configured
- **Base URL** - Application URL set
- **Session Security** - Session password configured

### ❌ Missing (Required for Testing)
- **Notion Token** - Need to create Notion integration
- **Notion Database ID** - Need to create task database
- **Slack Bot Token** - Need to install Slack app to workspace

---

## Quick Setup (15 minutes)

### Step 1: Setup Notion (5 min)

#### 1.1 Create Notion Integration
1. Go to https://www.notion.so/my-integrations
2. Click **"+ New integration"**
3. Name: "Discubot"
4. Workspace: Select your workspace
5. Click **"Submit"**
6. Copy the **"Internal Integration Token"** (starts with `secret_`)
7. Add to `.env`:
   ```bash
   NOTION_TOKEN=secret_your_token_here
   ```

#### 1.2 Create Task Database
1. In Notion, create a new page
2. Add a **"Table - Database"**
3. Name it "Discubot Tasks"
4. Add these columns (properties):
   - **Title** (Title) - Already exists
   - **Status** (Select) - Options: "To Do", "In Progress", "Done"
   - **Source** (Text)
   - **Source URL** (URL)
   - **Description** (Text) - Optional
   - **Assignee** (Person) - Optional

5. Share with integration:
   - Click **"⋯"** (top right) → **"Add connections"**
   - Search for "Discubot" → Select it

6. Copy Database ID from URL:
   - URL format: `https://notion.so/workspace/XXXXXX?v=YYYY`
   - Database ID is the `XXXXXX` part (32 characters)
   - Add to `.env`:
     ```bash
     NOTION_DB_ID=your_database_id_here
     ```

### Step 2: Install Slack App (5 min)

You already have `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` configured.

#### 2.1 Configure OAuth Scopes
1. Go to https://api.slack.com/apps
2. Select your app
3. Navigate to **"OAuth & Permissions"**
4. Under **"Bot Token Scopes"**, add:
   - `channels:history`
   - `chat:write`
   - `reactions:write`
   - `app_mentions:read`
   - `im:history`
   - `mpim:history`

#### 2.2 Add Redirect URL
1. Stay in **"OAuth & Permissions"**
2. Under **"Redirect URLs"**, add:
   ```
   http://localhost:3000/api/oauth/slack/callback
   ```
3. Click **"Save URLs"**

#### 2.3 Install to Workspace
1. Navigate to **"Install App"** (left sidebar)
2. Click **"Install to Workspace"**
3. Review permissions → Click **"Allow"**
4. Copy **"Bot User OAuth Token"** (starts with `xoxb-`)
5. Add to `.env`:
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-token-here
   ```

### Step 3: Install ngrok (2 min)

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 4: Configure Slack Events (3 min)

#### 4.1 Start Dev Server
```bash
# Terminal 1
pnpm dev
```

#### 4.2 Start ngrok
```bash
# Terminal 2
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

#### 4.3 Configure Webhook
1. In Slack App settings → **"Event Subscriptions"**
2. Toggle **"Enable Events"** to **ON**
3. **"Request URL"**: `https://your-ngrok-url/api/webhooks/slack`
4. Wait for "Verified ✓"
5. Under **"Subscribe to bot events"**, add:
   - `message.channels`
   - `app_mention`
6. Click **"Save Changes"**
7. Click **"Reinstall App"** if prompted

---

## Verify Setup

Run the environment check:

```bash
./scripts/check-env.sh
```

All checks should pass ✅

---

## Run Your First Test (5 min)

### Option 1: Admin UI (Recommended)

1. Start server: `pnpm dev`
2. Open: http://localhost:3000
3. Navigate to: `/dashboard/[team]/discubot/configs`
4. Click **"Create New Config"**
5. Fill in:
   - **Name**: "Test Config"
   - **Source Type**: Slack
   - **Slack Webhook URL**: Your ngrok URL + `/api/webhooks/slack`
   - **API Token**: Your `SLACK_BOT_TOKEN`
   - **Notion Token**: Your `NOTION_TOKEN`
   - **Notion Database ID**: Your `NOTION_DB_ID`
   - **Anthropic API Key**: Your `ANTHROPIC_API_KEY`
6. Click **"Test Connection"** - Both should show ✅
7. Click **"Save"**

### Option 2: Quick Test Script

```bash
# Test endpoints are responding
./scripts/quick-test.sh
```

### Option 3: Real Slack Message

1. In Slack, create test channel: `#discubot-test`
2. Invite bot: `/invite @your-bot-name`
3. Send message:
   ```
   Can we update the dashboard with the new metrics?
   We need to show user growth and engagement stats.
   ```
4. Watch for:
   - 👀 Bot reacts (processing)
   - ✅ Bot reacts (completed)
5. Check Notion database for new tasks!

---

## Validation Checklist

Before testing, verify:

- [ ] ✅ `.env` has all required variables
- [ ] ✅ Notion integration created and shared with database
- [ ] ✅ Slack app has OAuth scopes configured
- [ ] ✅ Slack app installed to workspace
- [ ] ✅ Bot token copied to `.env`
- [ ] ✅ Dev server running (`pnpm dev`)
- [ ] ✅ ngrok tunnel active (`ngrok http 3000`)
- [ ] ✅ Slack Events configured with ngrok URL
- [ ] ✅ Bot invited to test channel

---

## Test Scenarios

### Scenario 1: Simple Task Detection
**Message**:
```
Can someone update the user profile page by Friday?
```

**Expected**: 1 task created in Notion

### Scenario 2: Multiple Tasks
**Message**:
```
We need to:
1. Update the dashboard design
2. Fix the navigation bug
3. Add dark mode support
```

**Expected**: 3 tasks created in Notion

### Scenario 3: Threaded Discussion
1. Send message: "What do you think about the new feature?"
2. Reply in thread: "I think we should add more analytics"
3. Reply in thread: "And improve the user interface"

**Expected**: 1 task with context from all thread messages

---

## Troubleshooting

### "Webhook verification failed"
- Check dev server is running
- Verify ngrok tunnel is active
- Try new ngrok URL (they change on restart)

### "Bot doesn't react to messages"
- Invite bot to channel: `/invite @bot-name`
- Check Event Subscriptions includes `message.channels`
- Verify ngrok URL is correct in Slack settings

### "No tasks created in Notion"
- Check Notion integration is shared with database
- Verify database has required columns
- Check Notion token in `.env`
- Review error in Jobs dashboard

### "Test Connection fails"
- Verify all tokens are correct
- Check API keys are valid (not revoked)
- Review error message for specific issue

---

## Performance Expectations

Typical discussion processing:

| Stage | Duration |
|-------|----------|
| Webhook receipt | <100ms |
| Config loading | <200ms |
| Thread fetching | 200-500ms |
| AI analysis | 2-3s |
| Task creation | 200-300ms |
| Status update | 200ms |
| **Total** | **3-5s** |

---

## What's Next?

After successful testing:

1. ✅ **Test different message types** - Simple tasks, complex discussions, threads
2. ✅ **Test error handling** - Invalid tokens, rate limiting
3. ✅ **Test admin dashboard** - View jobs, discussions, tasks
4. ✅ **Complete Task 5.6** - Polish & responsive design (final Phase 5 task)
5. 🚀 **Phase 6** - Security, testing, production deployment

---

## Quick Commands

```bash
# Check environment
./scripts/check-env.sh

# Quick endpoint test
./scripts/quick-test.sh

# Start dev server
pnpm dev

# Start ngrok
ngrok http 3000

# Run type checking
npx nuxt typecheck

# Run all tests
pnpm test

# View ngrok requests (browser)
open http://127.0.0.1:4040
```

---

## Documentation

- 📚 **Full Guide**: `docs/guides/real-world-testing.md`
- 🚀 **Slack Quick Start**: `docs/guides/slack-quick-start.md`
- 🎨 **Figma Quick Start**: `docs/guides/figma-quick-start.md`
- 📊 **Progress**: `docs/PROGRESS_TRACKER.md`

---

**Ready to test?** Follow the Quick Setup above, then run your first test! 🚀
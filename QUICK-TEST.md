# Quick Test with Cloudflare Tunnel

**Your Tunnel URL**: `https://women-down-notify-several.trycloudflare.com`

---

## Step 1: Configure Slack Events (2 min)

### 1.1 Enable Event Subscriptions

1. Go to https://api.slack.com/apps
2. Select your Slack app
3. Navigate to **"Event Subscriptions"** (left sidebar)
4. Toggle **"Enable Events"** to **ON**
5. Enter **Request URL**:
   ```
   https://women-down-notify-several.trycloudflare.com/api/webhooks/slack
   ```
6. Wait for **"Verified ✓"** to appear

### 1.2 Subscribe to Bot Events

1. Scroll to **"Subscribe to bot events"**
2. Click **"Add Bot User Event"**
3. Add these events:
   - `message.channels` - Messages in public channels
   - `app_mention` - @mentions in channels
4. Click **"Save Changes"**
5. If you see a banner saying "Reinstall your app", click it

---

## Step 2: Verify Environment (1 min)

Check your `.env` file has these variables:

```bash
# AI Service (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-...

# Notion (REQUIRED for task creation)
NOTION_TOKEN=secret_...
NOTION_DB_ID=your-database-id

# Slack OAuth (REQUIRED)
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...

# Slack Bot Token (REQUIRED - from Install App page)
SLACK_BOT_TOKEN=xoxb-...
```

**Missing Notion?** Quick setup:
1. Go to https://www.notion.so/my-integrations
2. Create new integration → Copy token
3. Create database in Notion with columns: Title, Status, Source, Source URL
4. Share database with integration
5. Copy database ID from URL

**Missing Bot Token?**
1. Go to Slack App → **"Install App"**
2. Click **"Install to Workspace"** (or reinstall)
3. Copy **"Bot User OAuth Token"** (starts with `xoxb-`)

---

## Step 3: Test Webhook Verification (30 sec)

```bash
# Test that Slack can verify your webhook
curl -X POST https://women-down-notify-several.trycloudflare.com/api/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test-challenge-123",
    "token": "verification-token"
  }'
```

**Expected response**:
```json
{"challenge":"test-challenge-123"}
```

✅ If you see this, webhook is working!

---

## Step 4: Test Complete Flow in Slack (2 min)

### 4.1 Setup Test Channel

1. In Slack, create or use a test channel (e.g., `#discubot-test`)
2. Invite your bot:
   ```
   /invite @your-bot-name
   ```

### 4.2 Send Test Message

Send this message in the channel:

```
Hey team! 👋

We need to update the dashboard to show user growth metrics.
Can someone also fix the navigation bug on mobile?

Let's get this done by Friday!
```

### 4.3 Watch for Bot Reactions

**Expected behavior** (within 5 seconds):
1. 👀 - Bot reacts immediately (processing started)
2. ✅ - Bot reacts when done (tasks created)

### 4.4 Check Your Terminal

You should see logs in your dev server:
```
[webhook] Received Slack event: message
[adapter] Parsing Slack message...
[processor] Processing discussion...
[ai] Analyzing with Claude...
[notion] Creating tasks...
✅ Processing complete: 2 tasks created
```

---

## Step 5: Verify in Notion (30 sec)

1. Open your Notion database
2. You should see **2 new tasks**:
   - "Update dashboard to show user growth metrics"
   - "Fix navigation bug on mobile"
3. Each task should have:
   - **Source**: "Slack"
   - **Source URL**: Link to Slack message
   - **Status**: "To Do"

---

## Step 6: Check Admin Dashboard (30 sec)

1. Open: http://localhost:3000/dashboard/[team]/discubot/
2. **Dashboard** should show:
   - Recent Tasks: +2
   - Recent Activity: New discussion
3. Navigate to **Jobs** tab:
   - Should see completed job
   - Click to view details:
     - AI analysis summary
     - 2 tasks detected
     - Processing time (~3-5s)

---

## Troubleshooting

### Webhook Not Verified in Slack

**Error**: "The URL returned a non-200 status code"

**Solutions**:
1. Make sure dev server is running: `pnpm dev`
2. Make sure Cloudflare tunnel is active
3. Check server logs for errors
4. Try the curl test again (Step 3)

### Bot Doesn't React to Messages

**Symptom**: No 👀 reaction appears

**Solutions**:
1. Verify bot is invited: `/invite @bot-name`
2. Check Event Subscriptions includes `message.channels`
3. Verify webhook URL is correct in Slack settings
4. Check dev server logs for incoming requests

### "ANTHROPIC_API_KEY not found" Error

**Solutions**:
1. Check `.env` file has `ANTHROPIC_API_KEY=sk-ant-...`
2. Restart dev server after adding: `pnpm dev`
3. Verify API key is valid at https://console.anthropic.com/

### "NOTION_TOKEN not found" Error

**Solutions**:
1. Create Notion integration at https://www.notion.so/my-integrations
2. Add to `.env`: `NOTION_TOKEN=secret_...`
3. Create database and share with integration
4. Add database ID: `NOTION_DB_ID=...`
5. Restart dev server

### Bot Reacts but No Tasks in Notion

**Solutions**:
1. Check Notion database is shared with integration
2. Verify database has columns: Title, Status, Source, Source URL
3. Check Jobs dashboard for error details
4. Review server logs for Notion API errors

### Check Server Logs

Your dev server logs will show exactly what's happening:
```bash
# Watch logs in terminal where you ran: pnpm dev
```

---

## Test Different Scenarios

### Test 1: Simple Task
```
Can someone update the homepage by Friday?
```
**Expected**: 1 task

### Test 2: Multiple Tasks
```
We need to:
1. Update the dashboard
2. Fix the bug
3. Add dark mode
```
**Expected**: 3 tasks

### Test 3: Threaded Discussion
1. Send: "What do you think about the new design?"
2. Reply in thread: "I think we should add more colors"
3. Reply in thread: "And improve the spacing"
**Expected**: 1 task with context from thread

### Test 4: Information Only (No Action)
```
FYI - The deployment went well yesterday. No issues!
```
**Expected**: 0 tasks (info only)

---

## Quick Commands

```bash
# Check environment
./scripts/check-env.sh

# Test webhook endpoint
curl -X POST https://women-down-notify-several.trycloudflare.com/api/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test-123","token":"test"}'

# Watch server logs
# (in terminal where pnpm dev is running)

# Run tests
pnpm test

# Type check
npx nuxt typecheck
```

---

## Expected Timeline

| Step | Duration |
|------|----------|
| Configure Slack Events | 2 min |
| Verify environment | 1 min |
| Test webhook | 30 sec |
| Send test message | 2 min |
| Verify in Notion | 30 sec |
| Check dashboard | 30 sec |
| **Total** | **~7 min** |

---

## Success Checklist

- [ ] ✅ Slack webhook verified in Event Subscriptions
- [ ] ✅ Bot events subscribed (message.channels, app_mention)
- [ ] ✅ All environment variables set
- [ ] ✅ Bot invited to test channel
- [ ] ✅ Test message sent
- [ ] ✅ Bot reacted with 👀 and ✅
- [ ] ✅ Tasks appeared in Notion
- [ ] ✅ Job visible in admin dashboard

---

## What's Next?

After successful test:

1. ✅ **Test different message types** - Try various scenarios
2. ✅ **Test error handling** - Try invalid configs
3. ✅ **Test admin UI** - Explore all features
4. ✅ **Complete Task 5.6** - Polish & responsive design
5. 🚀 **Phase 6** - Security, testing, production

---

**Ready to test?** Start with Step 1 above! 🚀

**Your Tunnel**: `https://women-down-notify-several.trycloudflare.com`
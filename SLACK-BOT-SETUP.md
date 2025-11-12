# Slack Bot Not Found - Troubleshooting

If you can't `/invite` your bot, it's likely not properly configured yet. Let's fix it!

---

## Quick Fix Steps

### Step 1: Check if Bot User Exists (1 min)

1. Go to https://api.slack.com/apps
2. Select your app
3. Navigate to **"App Home"** (left sidebar)
4. Look for **"Your App's Bot User"** section

**If you see "Add a bot user":**
- Click **"Add"** or **"Review"**
- Set **Display Name**: `Discubot` (or whatever you want)
- Set **Default Username**: `discubot` (this is what you'll use to invite)
- Toggle **"Always Show My Bot as Online"** to **ON**
- Click **"Save Changes"**

**If bot user already exists:**
- Note the **Default Username** - this is what you use to invite
- Example: If username is `discubot`, use `/invite @discubot`

### Step 2: Add OAuth Scopes (1 min)

The bot needs permissions before it can be invited.

1. Navigate to **"OAuth & Permissions"** (left sidebar)
2. Scroll to **"Bot Token Scopes"**
3. Add these scopes:
   - `channels:history` - Read messages
   - `channels:read` - View channel info
   - `chat:write` - Send messages
   - `reactions:write` - Add reactions
   - `app_mentions:read` - Receive @mentions
   - `im:history` - Read DMs
   - `mpim:history` - Read group DMs

4. Click **"Save Changes"**

### Step 3: Install (or Reinstall) App to Workspace (1 min)

1. Navigate to **"Install App"** (left sidebar)
2. Click **"Install to Workspace"** (or **"Reinstall to Workspace"** if already installed)
3. Review the permissions
4. Click **"Allow"**
5. You'll see **"Bot User OAuth Token"** - starts with `xoxb-`
6. **COPY THIS TOKEN** - you'll need it for `.env`

### Step 4: Add Bot Token to .env

Add this to your `.env` file:

```bash
SLACK_BOT_TOKEN=xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwx
```

**Important**: Restart your dev server after adding:
```bash
# Stop current server (Ctrl+C)
# Then restart:
pnpm dev
```

### Step 5: Find Your Bot

Now try to find the bot in Slack:

**Option A: Direct Message**
1. In Slack, click **"+"** next to "Direct Messages"
2. Search for your bot name (e.g., "Discubot")
3. If found, send a test message: "Hello!"

**Option B: Invite to Channel**
1. Go to any channel (or create test channel: `#discubot-test`)
2. Type: `/invite @discubot` (use your bot's username)
3. Bot should appear in channel

**Option C: Check Apps**
1. In Slack, click **"Apps"** in the left sidebar
2. Your bot should appear in the list
3. Click it → Click **"Add this app to a channel"**

---

## Still Can't Find Bot?

### Check 1: Verify Bot Username

1. Go to Slack App → **"App Home"**
2. Find **"Your App's Bot User"** section
3. Note the **Default Username** (e.g., `discubot`)
4. In Slack, try: `/invite @[exact-username]`

### Check 2: Verify App is Installed

1. In Slack, type `/apps`
2. Your app should appear in the list
3. If not, reinstall from Slack App settings → **"Install App"**

### Check 3: Check Workspace Permissions

1. Make sure you have permission to add apps to workspace
2. If you're not a workspace admin, ask admin to install the app

### Check 4: Try Adding from Apps Directory

1. In Slack, go to **"Apps"** section (left sidebar)
2. Search for your app name
3. Click **"Add"** or **"Open"**
4. Click **"Add this app to a channel"**

---

## Alternative: Test Without Bot Features

You can test the webhook flow without bot reactions:

1. **Skip bot token** for now (leave `SLACK_BOT_TOKEN` unset)
2. **Configure webhook** (Event Subscriptions)
3. **Send messages** in channel
4. **Check server logs** to see if events are received
5. **Check admin dashboard** to see processed discussions

The bot won't react with emojis, but everything else will work!

---

## Test Webhook Without Bot Invite

You can still test if webhooks are working:

### Option 1: Subscribe to `app_mention` Only

1. In **Event Subscriptions**, add only `app_mention`
2. In Slack, type `@your-app-name` in any channel
3. Slack will ask if you want to invite the app
4. Click **"Invite Them"**
5. Now bot is in the channel!

### Option 2: Use Admin to Add App

1. Go to channel settings (click channel name)
2. Click **"Integrations"** tab
3. Click **"Add apps"**
4. Search for your app
5. Click **"Add"**

---

## Checklist: Bot Configuration

Complete this checklist in order:

1. **Bot User**
   - [ ] Navigate to **App Home**
   - [ ] Bot user created with Display Name and Username
   - [ ] "Always Show My Bot as Online" is ON

2. **OAuth Scopes**
   - [ ] Navigate to **OAuth & Permissions**
   - [ ] `channels:history` added
   - [ ] `channels:read` added
   - [ ] `chat:write` added
   - [ ] `reactions:write` added
   - [ ] `app_mentions:read` added
   - [ ] `im:history` added
   - [ ] `mpim:history` added

3. **Installation**
   - [ ] Navigate to **Install App**
   - [ ] Clicked "Install to Workspace" (or "Reinstall")
   - [ ] Bot User OAuth Token copied (starts with `xoxb-`)
   - [ ] Token added to `.env` as `SLACK_BOT_TOKEN`
   - [ ] Dev server restarted

4. **Find Bot in Slack**
   - [ ] Bot appears in Apps list
   - [ ] Can send DM to bot
   - [ ] Can `/invite @botname` to channel

---

## Expected Bot Username

Your bot username is based on what you set in **App Home**:

- **Display Name**: "Discubot" (what users see)
- **Default Username**: "discubot" (what you type: `/invite @discubot`)

**Common mistakes:**
- ❌ `/invite @Discubot` (capital D - might not work)
- ❌ `/invite @discubot-test` (wrong name)
- ✅ `/invite @discubot` (correct, lowercase, exact match)

---

## Next Steps After Bot is Found

Once you can find and invite the bot:

1. **Invite to test channel**: `/invite @botname`
2. **Configure Event Subscriptions**:
   - Request URL: `https://women-down-notify-several.trycloudflare.com/api/webhooks/slack`
   - Events: `message.channels`, `app_mention`
3. **Send test message**: "Can we update the dashboard?"
4. **Watch for reactions**: 👀 then ✅
5. **Check Notion** for new tasks

---

## Quick Test to Verify Bot Token

Once you have `SLACK_BOT_TOKEN` in `.env`, test it:

```bash
# Test the bot token is valid
curl -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer xoxb-your-token-here"
```

**Expected response:**
```json
{
  "ok": true,
  "url": "https://yourworkspace.slack.com/",
  "team": "Your Workspace",
  "user": "discubot",
  "bot_id": "B1234567890"
}
```

If `"ok": false`, the token is invalid - reinstall the app.

---

## What You Need Right Now

**Minimum to test webhooks:**
```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...  # For AI analysis
SLACK_BOT_TOKEN=xoxb-...       # To find bot and post reactions
SLACK_CLIENT_ID=...            # Already have this
SLACK_CLIENT_SECRET=...        # Already have this

# Optional (for task creation)
NOTION_TOKEN=secret_...
NOTION_DB_ID=...
```

**Once bot is found and invited:**
1. Configure Event Subscriptions with your tunnel URL
2. Send test message
3. Bot will process and react
4. Check logs and admin dashboard

---

## Still Stuck?

**Quick workaround** - Test without bot:

1. Skip bot token for now
2. Use direct API testing instead:
   ```bash
   curl -X POST http://localhost:3000/api/discussions/process \
     -H "Content-Type: application/json" \
     -d '{
       "type": "direct",
       "parsed": {
         "title": "Test",
         "content": "Update dashboard",
         "source": "test",
         "threadId": "test:1",
         "deepLink": "https://example.com"
       }
     }'
   ```

This tests the complete flow without needing Slack bot configuration!

---

**Focus on**: App Home → Create Bot User → OAuth Scopes → Install App → Copy Token → Restart Server → Find Bot in Slack

Let me know what you see in **App Home**!
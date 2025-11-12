# Install Your Slack Bot - Step by Step

**Problem**: Bot not in apps list = App not installed to workspace

**Solution**: Follow these exact steps (3 minutes)

---

## Step 1: Create Bot User (if needed)

1. Go to https://api.slack.com/apps
2. **Select your app** from the list
3. Click **"App Home"** in the left sidebar

### Check: Do you see a bot user?

**If YES** - Skip to Step 2

**If NO** - Create one now:
1. Click **"Review"** or **"Add a Bot User"** button
2. Fill in:
   - **Display Name**: `Discubot` (what users see)
   - **Default Username**: `discubot` (what you type to invite)
3. Toggle **"Always Show My Bot as Online"** to **ON**
4. Click **"Add Bot User"** or **"Save Changes"**

---

## Step 2: Add OAuth Scopes (Required!)

The app won't install without proper scopes.

1. Click **"OAuth & Permissions"** (left sidebar)
2. Scroll down to **"Scopes"** section
3. Under **"Bot Token Scopes"**, click **"Add an OAuth Scope"**
4. Add these one by one:

```
channels:history    (Read messages in channels)
channels:read       (View channel info)
chat:write          (Send messages)
reactions:write     (Add emoji reactions)
app_mentions:read   (Receive @mentions)
im:history          (Read direct messages)
mpim:history        (Read group messages)
```

**Important**: Don't add "User Token Scopes" - only "Bot Token Scopes"!

---

## Step 3: Install to Workspace

Now install the app:

1. Click **"Install App"** (left sidebar)
2. You should see a button: **"Install to Workspace"** or **"Install to [Your Workspace Name]"**
3. Click it
4. You'll be redirected to a permission screen showing:
   - What the bot can do
   - Which channels it can access
   - What data it can read
5. Review the permissions
6. Click **"Allow"** button

---

## Step 4: Get Your Bot Token

After clicking "Allow", you'll be redirected back to the "Install App" page:

1. You'll see: **"OAuth Tokens for Your Workspace"**
2. Find: **"Bot User OAuth Token"**
3. It starts with `xoxb-` and is very long
4. Click **"Copy"** button (or select and copy)

**Example**: `xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwx`

---

## Step 5: Add Token to .env

1. Open `.env` file in your editor
2. Find or add this line:
   ```bash
   SLACK_BOT_TOKEN=
   ```
3. Paste your token:
   ```bash
   SLACK_BOT_TOKEN=xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwx
   ```
4. Save the file

---

## Step 6: Restart Dev Server

**Important**: You must restart for .env changes to take effect!

```bash
# In your terminal where dev server is running:
# Press Ctrl+C to stop

# Then restart:
pnpm dev
```

---

## Step 7: Find Bot in Slack

Now the bot should appear in Slack!

### Method A: Check Apps List
1. Open Slack
2. Look in left sidebar for **"Apps"** section
3. Your bot should appear there
4. Click it to open

### Method B: Direct Message
1. Click **"+"** next to "Direct Messages"
2. Search for "discubot" (or your bot name)
3. Should appear in results
4. Click to open DM

### Method C: @mention in Channel
1. Go to any channel (or create `#discubot-test`)
2. Type: `@discubot`
3. Slack should show autocomplete suggestion
4. Select it, or Slack may ask "Invite them?" → Click "Invite"

---

## Verify Bot is Working

### Quick Test 1: Send DM
1. Open DM with bot
2. Send: "Hello!"
3. Bot won't respond yet (needs event subscriptions)
4. But if you can send, bot exists!

### Quick Test 2: Check Token
```bash
curl -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer YOUR_BOT_TOKEN_HERE"
```

**Expected response**:
```json
{
  "ok": true,
  "url": "https://yourworkspace.slack.com/",
  "team": "Your Workspace",
  "user": "discubot",
  "team_id": "T123456",
  "user_id": "U123456",
  "bot_id": "B123456"
}
```

If `"ok": false`, reinstall the app.

---

## Common Issues

### "Install to Workspace" button is grayed out

**Cause**: Missing OAuth scopes

**Fix**: Go back to Step 2, add all the scopes

---

### "You don't have permission to install"

**Cause**: Not a workspace admin

**Fix**:
- Option 1: Ask workspace admin to install
- Option 2: Create your own test workspace (free):
  1. Go to slack.com
  2. Click "Create a new workspace"
  3. Follow prompts
  4. Install bot to your test workspace

---

### "App is already installed"

**Cause**: App was installed before but not showing

**Fix**:
1. Click **"Reinstall to Workspace"** button
2. This refreshes the installation
3. After reinstall, copy the NEW bot token
4. Update `.env` with new token

---

### Bot token starts with `xoxp-` not `xoxb-`

**Cause**: Copied wrong token (user token, not bot token)

**Fix**:
1. Go to "Install App" page
2. Look for **"Bot User OAuth Token"** specifically
3. Should start with `xoxb-`
4. Copy that one

---

### Still can't find bot after installation

**Try this**:
1. In Slack, type `/invite @your-app-name`
2. Or try the actual app name (not bot name)
3. Or go to channel → Click channel name → "Integrations" → "Add apps"

---

## Complete Checklist

Before moving on, verify:

- [ ] ✅ Bot user created in App Home (username: `discubot`)
- [ ] ✅ 7 OAuth scopes added to Bot Token Scopes
- [ ] ✅ App installed to workspace (clicked "Allow")
- [ ] ✅ Bot token copied (starts with `xoxb-`)
- [ ] ✅ Token added to `.env` as `SLACK_BOT_TOKEN=xoxb-...`
- [ ] ✅ Dev server restarted (`pnpm dev`)
- [ ] ✅ Bot appears in Slack Apps list
- [ ] ✅ Can open DM with bot

---

## What's Next?

Once bot is installed and appears in Slack:

1. **Configure Event Subscriptions**:
   - Go to "Event Subscriptions" in Slack App settings
   - Toggle ON
   - Request URL: `https://women-down-notify-several.trycloudflare.com/api/webhooks/slack`
   - Add events: `message.channels`, `app_mention`
   - Save

2. **Test in Slack**:
   - Invite bot to channel: `/invite @discubot`
   - Send message: "Can we update the dashboard?"
   - Watch for 👀 and ✅ reactions

3. **Check results**:
   - View server logs
   - Check admin dashboard
   - Check Notion (if configured)

---

## Your Current URL

**Cloudflare Tunnel**: `https://women-down-notify-several.trycloudflare.com`

**Webhook URL for Slack**:
```
https://women-down-notify-several.trycloudflare.com/api/webhooks/slack
```

---

## Need Help?

If stuck, tell me:
1. Can you see the "Install App" page? (screenshot if possible)
2. What does it say? ("Install to Workspace" or "Reinstall to Workspace")
3. After clicking, do you see permission screen?
4. After allowing, do you see a token starting with `xoxb-`?

**Start with Step 1 above** and let me know where you get stuck!
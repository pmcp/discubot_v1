# Slack App Configuration Debug Checklist

## Step 1: Verify App Exists and is Accessible
- [ ] Go to https://api.slack.com/apps
- [ ] Can you see your app in the list?
- [ ] Click on it - does it load?
- [ ] What workspace is it installed in?

## Step 2: Check Event Subscriptions
Go to: **Event Subscriptions** (left sidebar)

### Enable Events
- [ ] Is "Enable Events" toggle **ON** (blue)?
  - If OFF, turn it ON and save

### Request URL
- [ ] What URL is entered? ________________________________
- [ ] What's the status next to it?
  - [ ] ✅ Verified (GREEN) - Good!
  - [ ] ⚠️ Failed/Pending (YELLOW/RED) - Problem!
  - [ ] Empty - Need to add URL

**If not verified:**
1. Enter: `https://discubot.cloudflare-e53.workers.dev/api/webhooks/slack`
2. Wait for Slack to verify (sends challenge)
3. Should show "Verified" with green checkmark

### Subscribe to Bot Events
Scroll down to "Subscribe to bot events"

- [ ] Is `app_mention` in the list?
  - If NO: Click "Add Bot User Event" → Search "app_mention" → Add it
  - If YES: ✓ Good!

- [ ] After adding events, did you click **"Save Changes"** at the bottom?
  - **IMPORTANT**: Yellow banner might appear saying "You need to reinstall your app"
  - If yes, click the banner to reinstall

## Step 3: Check OAuth Scopes
Go to: **OAuth & Permissions** (left sidebar)

### Bot Token Scopes
Look at "Scopes" → "Bot Token Scopes" section

Required scopes (must have these):
- [ ] `app_mentions:read` - Listen for @mentions
- [ ] `channels:history` - Read messages
- [ ] `chat:write` - Send messages

**If any are missing:**
1. Click "Add an OAuth Scope"
2. Add the missing scopes
3. **MUST REINSTALL** the app after adding scopes (banner will appear)

### Bot User OAuth Token
- [ ] Is there a token shown? (starts with `xoxb-`)
- [ ] Copy it (you'll need this later)

## Step 4: Verify App Installation
Go to: **Install App** (left sidebar)

- [ ] Does it say "Installed" with a date?
- [ ] Or does it say "Install to Workspace"?

**If not installed or needs reinstall:**
1. Click "Install to Workspace" or "Reinstall to Workspace"
2. Authorize the app
3. Slack will redirect you back

## Step 5: Test in Slack Workspace

### Find Your Bot
1. Open Slack workspace
2. Look in the Apps section (left sidebar)
3. Can you find your bot?
   - [ ] Yes, I see it
   - [ ] No, it's not there

### Invite Bot to Channel
1. Go to any channel (or create a test channel)
2. Type: `/invite @YourBotName`
3. Bot should appear in the channel
   - [ ] Bot was added successfully
   - [ ] Got an error

### @Mention the Bot
1. In the channel, type: `@YourBotName hello`
2. Does the bot name autocomplete when you type `@`?
   - [ ] Yes, autocompletes
   - [ ] No autocomplete

3. Send the message
4. Check your logs: `npx nuxthub logs --tail`
5. Do you see any activity?
   - [ ] Yes, I see logs!
   - [ ] No, nothing

## Step 6: Check Slack Signing Secret

Go to: **Basic Information** (left sidebar) → **App Credentials**

- [ ] Find "Signing Secret"
- [ ] Click "Show" to reveal it
- [ ] Copy it: _______________________________

**Compare with your .env file:**
```bash
# In .env line 73
SLACK_SIGNING_SECRET=272ef421809180779b95f265df9b65c3
```

**Do they match?**
- [ ] Yes, they match exactly
- [ ] No, they're different
- [ ] Not sure

**If they don't match:**
1. Copy the correct one from Slack
2. Update `.env` file
3. Update in NuxtHub: `npx nuxthub manage` → Settings → Environment Variables
4. Redeploy

## Common Issues & Solutions

### Issue: "Your URL didn't respond with the challenge"
**Solution**: The endpoint crashed before handling URL verification
- Fixed by our simplified endpoint ✓

### Issue: Events not appearing in logs
**Causes**:
1. App not installed ❌
2. `app_mentions:read` scope missing ❌
3. `app_mention` event not subscribed ❌
4. Bot not invited to channel ❌
5. Not using @mention (just typing message) ❌

### Issue: "Endpoint not found" or 404
**Solution**: URL typo in Slack Event Subscriptions
- Double-check URL is exactly: `https://discubot.cloudflare-e53.workers.dev/api/webhooks/slack`

---

## Results

After going through this checklist, what did you find?

Share which steps failed and I'll help you fix them!
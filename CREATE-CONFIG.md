# Create Your First Config

The webhook is now working and code is fixed! You just need to create a config in the database.

---

## Quick Setup (2 minutes)

### Step 1: Access Admin UI

Open: `http://localhost:3000/dashboard/[your-team-id]/discubot/configs`

**Don't know your team ID?** Check your Slack workspace team ID:
- Team ID from your logs: `T06SZE1U91Q`
- So the URL is: `http://localhost:3000/dashboard/T06SZE1U91Q/discubot/configs`

### Step 2: Create New Config

Click **"Create New Config"** or **"Add Config"** button

### Step 3: Fill in the Form

**Required fields:**

```
Name: "Slack Test Config"
Source Type: slack
Active: ON (toggle to enabled)

Slack Configuration:
- API Token: xoxb-YOUR-SLACK-BOT-TOKEN-HERE
  (your SLACK_BOT_TOKEN from .env)

Notion Configuration:
- Notion Token: [Your Notion integration token]
- Notion Database ID: [Your Notion database ID]

AI Configuration:
- AI Enabled: ON (toggle to enabled)
- Anthropic API Key: [Your ANTHROPIC_API_KEY from .env]
```

**Optional fields:**
- Webhook URL: Your Cloudflare tunnel URL
- Webhook Secret: (leave empty for now)
- AI Prompts: (leave default)

### Step 4: Test Connection (Optional)

Click **"Test Connection"** button to verify:
- ✅ Slack API token works
- ✅ Notion token and database ID work

### Step 5: Save

Click **"Save"** button

---

## Quick Alternative: Create Via API

If Admin UI doesn't work, create config directly via API:

```bash
curl -X POST http://localhost:3000/api/teams/T06SZE1U91Q/discubot-configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Test Config",
    "sourceType": "slack",
    "active": true,
    "apiToken": "xoxb-YOUR-SLACK-BOT-TOKEN-HERE",
    "notionToken": "YOUR_NOTION_TOKEN",
    "notionDatabaseId": "YOUR_NOTION_DB_ID",
    "anthropicApiKey": "YOUR_ANTHROPIC_KEY",
    "aiEnabled": true,
    "autoSync": false,
    "postConfirmation": false,
    "owner": "system",
    "createdBy": "system",
    "updatedBy": "system"
  }'
```

---

## What You Need

### ✅ Already Have:
- Slack Bot Token: (in your `.env` - starts with `xoxb-`)
- Anthropic API Key: (in your `.env`)
- Team ID: `T06SZE1U91Q`

### ❌ Still Need (Optional):
- Notion Token: `secret_...` (from https://notion.so/my-integrations)
- Notion Database ID: From database URL

**Can test without Notion!** Just set `aiEnabled: false` or skip Notion fields.

---

## After Creating Config

### Test Again in Slack

1. Go to your Slack channel
2. Send message: `@Legoman can we update the dashboard?`
3. Watch your dev server logs

**Expected logs:**
```
[Slack Webhook] Received event webhook
[Processor] Stage 1: Validation ✓
[Processor] Stage 2: Config Loading ✓  ← Should work now!
[Processor] Stage 3: Thread Building
...
```

---

## Still Getting "No config found"?

Check these:

**1. Is config active?**
- Config must have `active: true`

**2. Does sourceType match?**
- Config `sourceType` must be "slack" (lowercase)

**3. Does teamId match?**
- Config `teamId` must be "T06SZE1U91Q"

**4. Check database:**
```bash
# If using SQLite (default)
sqlite3 .data/db.sqlite3
SELECT * FROM discubot_configs;
```

---

## Simplified Test (No Notion)

Create config without Notion to test AI only:

```json
{
  "name": "Slack Test (No Notion)",
  "sourceType": "slack",
  "active": true,
  "apiToken": "xoxb-...",
  "notionToken": "dummy",
  "notionDatabaseId": "dummy",
  "aiEnabled": false,
  "owner": "system",
  "createdBy": "system",
  "updatedBy": "system"
}
```

This will:
- ✅ Receive webhook
- ✅ Parse message
- ✅ Process discussion
- ❌ Skip AI analysis
- ❌ Skip Notion tasks

You'll see it in Admin Dashboard but no tasks created.

---

## Next Test After Config Created

Once config exists in database:

1. **Send message in Slack**: `@Legoman test message`
2. **Check dev logs**: Should get past "Config Loading" stage
3. **Check Admin Dashboard**: Should see discussion in recent activity
4. **If Notion configured**: Check for new task in Notion!

---

## Need Help?

Your current error: `No active config found for team T06SZE1U91Q and source slack`

**Fix**: Create config with:
- `teamId`: "T06SZE1U91Q"
- `sourceType`: "slack"
- `active`: true

Then test again!
# Notion Input Integration - Setup Guide

**Phase**: 18 - Notion as Input Source
**Status**: Complete
**Time Invested**: 6.5h

## Overview

This guide walks you through configuring Notion as a discussion input source in Discubot. When you tag `@discubot` (or a custom trigger) in a Notion comment, Discubot will analyze the discussion and create tasks in your configured Notion database.

## Architecture

```
Notion Page/Database
     ↓
User adds comment with @discubot
     ↓
Notion Webhooks API
     ↓
POST /api/webhooks/notion-input
     ↓
Webhook Signature Verification
     ↓
Trigger Keyword Detection (@discubot)
     ↓
Notion Adapter (parse comment)
     ↓
Processor Service (orchestrate)
     ↓
  ┌──┴──┐
  ↓     ↓
AI    Notion
  ↓     ↓
Generate Create
Summary  Task
  ↓     ↓
  └──┬──┘
     ↓
Post Reply to Comment Thread
```

## Prerequisites

Before starting, ensure you have:

1. **Notion workspace** with admin access
   - Need ability to create integrations
   - Access to pages/databases where you want to monitor comments

2. **Discubot deployment**
   - Application already deployed or running locally
   - Public URL accessible from the internet (required for webhooks)

3. **Environment prepared**
   - Administrative access to Discubot configuration
   - Ability to add environment variables if needed

## Step 1: Create Notion Integration

### 1.1 Access Integration Settings

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Sign in with your Notion account
3. Click **"Create new integration"** button

### 1.2 Configure Integration

1. **Name**: Enter a descriptive name (e.g., "Discubot" or "Task Automation")

2. **Select workspace**: Choose the workspace where you'll use this integration

3. **Select capabilities**: Check these required boxes:
   - ✅ **Read content** - Read comments and page content
   - ✅ **Read comments** - Access comment threads
   - ✅ **Insert comments** - Post replies to comment threads
   - ⚪ Read user information (optional but recommended for context)

4. Leave other options as default

5. Click **"Create integration"**

### 1.3 Copy Your Credentials

After creation, you'll see the integration details page:

1. **Copy the Internal Integration Token**
   - This is a secret starting with `ntn_`
   - Store it securely - you'll need it in Step 5
   - Never share this token or commit it to version control
   - Format: `ntn_1234567890ABCDEFGHIJKLMNOP`

2. **Copy the Signing Secret** (if displayed)
   - Used for webhook signature verification
   - Format: `sig_1234567890ABCDEFGHIJKLMNOP`

Keep these credentials accessible - you'll need them shortly.

## Step 2: Connect Integration to Pages

Your integration needs explicit permission to access each page or database you want to monitor.

### 2.1 For Pages (Individual Comments)

1. Open a Notion page where you want to monitor comments

2. Click the **"..."** (More) menu in the top-right corner

3. Scroll down and click **"Connections"**

4. Click **"Connect to"** or the **"+"** icon

5. Find and select your integration from the list
   - Search by the name you created (e.g., "Discubot")
   - Click to connect

6. **Confirm the connection** - The integration should now appear in the Connections list

### 2.2 For Databases

1. Open your target Notion database

2. Click the **"..."** menu at the top

3. Select **"Connections"**

4. Click **"+"** or **"Connect to"**

5. Find your integration and click to connect

6. You should see it listed as connected

### 2.3 Repeat for Multiple Pages/Databases

If you want Discubot to monitor comments across multiple pages or databases:
- Repeat the above steps for each one
- The same integration can be connected to unlimited pages

## Step 3: Configure Discubot

### 3.1 Open FlowBuilder

1. Log into your Discubot admin panel
2. Navigate to **FlowBuilder**
3. Select or create a **Flow** (the workflow that processes discussions)
4. In the flow configuration, find the **"Input Sources"** section

### 3.2 Add Notion as Input Source

1. Click the **"Add Notion"** button
   - Located in the Input Sources area alongside Slack and Figma options

2. A **Notion Configuration Modal** will open with these fields:

   **Notion Integration Token** (required)
   - Paste the token you copied in Step 1.3
   - Appears as a masked input field
   - Must be valid for signature verification to pass

   **Trigger Keyword** (optional, default: `@discubot`)
   - The word/phrase users must include in a comment to trigger task creation
   - Examples: `@discubot`, `@task`, `#todo`, `@ai`
   - Case-sensitive
   - Must be preceded or followed by whitespace

   **Webhook URL** (read-only reference)
   - Displays: `{your-discubot-url}/api/webhooks/notion-input`
   - Used in the next step
   - Copy this URL

### 3.3 Test Connection

1. In the modal, click **"Test Connection"** button

2. Discubot will verify the token by calling Notion API

3. **Success** (green checkmark):
   - Your token is valid
   - Integration has correct permissions
   - Safe to proceed

4. **Failure** (red X):
   - Check token format and spelling
   - Verify token hasn't been revoked in Notion
   - Confirm integration has required capabilities
   - Try copying token again from Notion

### 3.4 Save Configuration

1. Once connection test passes, click **"Save Notion Input"** button
2. Discubot stores the configuration
3. The Notion input now appears in your flow's input list

## Step 4: Configure Notion Webhook

Now you need to tell Notion where to send webhook events when comments are created.

### 4.1 Access Webhook Settings in Notion

1. Go back to [Notion Integrations](https://www.notion.so/my-integrations)

2. Click on your integration name to open its settings

3. In the left sidebar, click **"Webhooks"**

### 4.2 Create a Webhook

1. Click **"+ New webhook"** button

2. **Fill in the webhook details:**

   **URL**
   - Paste the Webhook URL from Step 3.2
   - Format: `https://your-discubot-url.com/api/webhooks/notion-input`
   - Must be HTTPS in production
   - Example: `https://discubot.example.com/api/webhooks/notion-input`

   **Description** (optional)
   - E.g., "Discubot task automation"
   - Helps identify the webhook later

   **Events to subscribe to**
   - Select: **`comment.created`**
   - This fires when someone adds a comment
   - Leave all other events unchecked

3. Click **"Create webhook"**

### 4.3 Verify Webhook

Notion will immediately test the webhook:

1. **Success** (green checkmark next to webhook):
   - Notion successfully reached your endpoint
   - Initial verification challenge passed
   - Webhook is active and ready

2. **Failure** (error message):
   - Verify URL is correct and accessible
   - Check that Discubot is running/deployed
   - Ensure HTTPS is working (if production)
   - Review server logs for errors
   - Try creating webhook again

### 4.4 Copy Signing Secret (Production Only)

For production deployments with signature verification:

1. Find the webhook you just created in the list

2. Click the webhook to view details

3. Look for **"Signing secret"** field
   - Copy this value
   - Set environment variable: `NOTION_WEBHOOK_SECRET`
   - This enables cryptographic verification of webhook authenticity

## Step 5: Test the Integration

Now let's verify everything works end-to-end.

### 5.1 Prepare a Test

1. Open one of the Notion pages you connected in Step 2

2. Find or create a page where you want to test

3. Make sure your Discubot integration is still connected to this page
   - Click "..." → "Connections" to verify

### 5.2 Add a Test Comment with Trigger

1. Click the **"Add comment"** button on the page (or reply to existing comment)

2. Type a test comment including your trigger keyword:
   ```
   Hey @discubot, can we improve the dashboard performance?
   ```

   Or if you customized the trigger keyword:
   ```
   @task: update login flow security measures
   ```

3. **Important:** Make sure your trigger keyword is included exactly as configured

### 5.3 Watch for Processing

After posting the comment:

1. **Check the webhook status:**
   - Notion has sent an event to Discubot
   - Go to [Notion Integrations](https://www.notion.so/my-integrations) → Your Integration → Webhooks
   - Look for the webhook details - shows recent delivery status

2. **Check Discubot response:**
   - Look for a **reply in the comment thread**
   - Discubot posts its response to the same comment
   - Should contain task summary or confirmation
   - May take 2-5 seconds to appear

3. **Check task creation:**
   - Navigate to your target Notion database
   - Look for a new task entry
   - Should contain the title/summary from your comment

### 5.4 Troubleshooting the Test

**Comment posted but no reply appeared:**
- Check Discubot error logs
- Verify trigger keyword matches exactly
- Confirm integration connected to page (Step 2)
- Test connection again (Step 3.3)

**No new comment in thread:**
- Webhook may not have fired
- Check webhook delivery status in Notion integration settings
- Try posting another test comment
- Verify URL is publicly accessible

**Task created but with wrong content:**
- May be a parsing issue
- Review AI analysis in task properties
- Adjust comment content for clarity
- Try with simpler, more specific task description

## Step 6: Environment Variables Reference

### Required for Webhook Signature Verification

```bash
# Production (recommended)
NOTION_WEBHOOK_SECRET=sig_1234567890ABCDEFGHIJKLMNOP
```

### For Local Development

Local development doesn't require the signing secret - verification is skipped if not configured. However, you may want to set it for testing:

```bash
# .env.local
NOTION_WEBHOOK_SECRET=test-secret
```

### Stored in Discubot UI

These are stored securely in Discubot's database (not in environment variables):

- Notion Integration Token (per flow)
- Trigger Keyword (per flow)
- Webhook Secret (auto-populated from Notion)

## Customization Options

### Custom Trigger Keywords

Each flow can have its own trigger keyword:

1. Edit the flow in FlowBuilder
2. Click on the Notion input configuration
3. Change "Trigger Keyword" field to any word/phrase
4. Examples:
   - `@discubot` (default)
   - `@automate`
   - `#action`
   - `TODO`
   - `URGENT:`

### Multiple Discubot Flows

You can monitor different Notion workspaces with different flows:

1. Create separate flows (e.g., "Marketing Tasks", "Engineering Tasks")
2. Add Notion input to each with different tokens
3. Connect each integration to specific pages
4. Users post `@discubot` comments in their workspace
5. Tasks route to the appropriate flow and destination database

## Troubleshooting

### "Invalid Notion Token" Error

**Symptom**: Connection test fails with "Invalid token" message

**Solutions:**
1. Copy token again from [Notion Integrations](https://www.notion.so/my-integrations) - exactly as shown
2. Verify you're using Internal Integration Token (starts with `ntn_`), not OAuth token
3. Check that token hasn't been regenerated or revoked
4. Ensure no extra spaces when copying/pasting
5. Verify integration still exists and hasn't been deleted

### "Insufficient Permissions" Error

**Symptom**: Token is valid but integration can't access content

**Solutions:**
1. Go to [Notion Integrations](https://www.notion.so/my-integrations) → Your Integration
2. Click **"Capabilities"** tab
3. Verify these are checked:
   - Read content ✅
   - Read comments ✅
   - Insert comments ✅
4. Re-enable capabilities if needed and save
5. Regenerate the token (may require refreshing)

### Integration Not Connected to Page

**Symptom**: Comments on a page don't trigger Discubot

**Solutions:**
1. Open the Notion page
2. Click "..." → "Connections"
3. Verify your Discubot integration appears in the list
4. If missing, click "+" and reconnect
5. Ensure connection is to the specific page, not just workspace

### Webhook Not Receiving Events

**Symptom**: Comments posted but webhook never fires

**Solutions:**
1. Check webhook is enabled in [Notion Integrations](https://www.notion.so/my-integrations) → Webhooks
2. Verify URL is correct (copy-paste from Discubot, don't edit)
3. Check URL is publicly accessible (test in browser)
4. Confirm webhook is subscribed to `comment.created` event (not other events)
5. In webhook settings, check "Recent Deliveries" for failed attempts
6. Review Discubot server logs for error details

### Wrong Trigger Keyword Matching

**Symptom**: Comments with trigger keyword don't trigger tasks

**Solutions:**
1. Double-check trigger keyword in flow configuration (Step 3.2)
2. Ensure keyword in comment matches exactly (case-sensitive)
3. Keyword must have whitespace before/after (e.g., `@discubot` not `@discubot2`)
4. Check for typos or extra spaces in configuration
5. Try a comment with default keyword `@discubot` first

### Tasks Created But With Wrong Content

**Symptom**: Task appears but content is incomplete or incorrect

**Solutions:**
1. Rewrite comment with clearer task description
2. Include more context so AI can extract task correctly
3. Review AI analysis in Discubot logs
4. Try shorter, more direct language in comments

### Rate Limiting or Timeout

**Symptom**: Processing takes very long or fails after several comments

**Solutions:**
1. Discubot implements rate limiting (60 requests/min per workspace)
2. Space out test comments by a few seconds
3. For production, monitor API rate limits
4. Contact support if consistent issues occur

## Production Deployment Checklist

Before going live with Notion automation:

- ✅ Notion integration created with required capabilities
- ✅ Integration connected to target pages/databases
- ✅ Discubot token securely stored (not in git)
- ✅ Trigger keyword configured and communicated to team
- ✅ Webhook URL points to production Discubot instance
- ✅ HTTPS enabled on production endpoint
- ✅ Webhook signature verification enabled (`NOTION_WEBHOOK_SECRET` set)
- ✅ Test comment successfully creates task
- ✅ Reply posted to Notion comment
- ✅ Multiple team members tested integration
- ✅ Error handling and logging configured
- ✅ Team trained on trigger keyword and expected behavior

## Performance Characteristics

### Processing Timeline

1. **Comment posted in Notion** → `0ms`
2. **Webhook event sent** → `100-500ms`
3. **Signature verified** → `10ms`
4. **Comment content fetched** → `200-400ms`
5. **AI analysis** → `2-4 seconds`
6. **Task created in Notion** → `300-500ms`
7. **Reply posted to thread** → `200-300ms`
8. **Total time** → `3-6 seconds` (typically ~4s)

### Limitations

- Maximum 60 webhook events per minute per workspace
- Comment must contain trigger keyword within first 4000 characters
- Task creation limited by Notion API rate limits (typically 3 requests/second)
- AI analysis limited by Anthropic API rate limits

## Advanced Configuration

### Multiple Teams

For organizations with multiple Notion workspaces:

1. Create separate integrations in each workspace
2. Create separate Discubot flows (one per team/workspace)
3. Add corresponding Notion input to each flow
4. Users in each workspace get their own task database

### Different Destination Databases

To route tasks from different Notion pages to different databases:

1. Create separate flows for each destination
2. Each flow has its own Notion input with specific token
3. Configure different target database for each flow
4. Document which pages/flows map to which databases

### Custom Trigger Keywords Per Team

1. Create flow per team
2. Configure trigger keyword specific to team culture
   - Engineering: `@automate`
   - Marketing: `@campaign`
   - Operations: `#urgent`
3. Team learns their custom keyword

## Related Documentation

- [Notion Webhooks Reference](https://developers.notion.com/reference/webhooks)
- [Notion Comments API](https://developers.notion.com/reference/comment-object)
- [Notion Integration Reference](https://developers.notion.com/reference/intro)
- [Discubot Progress Tracker](../PROGRESS_TRACKER.md) - Phase 18 Notion Input Source
- [Slack Integration Guide](./slack-integration.md) - For comparison
- [Figma Integration Guide](./figma-integration.md) - For comparison

## Support & Help

### Common Questions

**Q: Can I use the same integration in multiple workspaces?**
A: No, each integration is tied to a single Notion workspace. Create a new integration for each workspace.

**Q: What if I change the trigger keyword?**
A: Changes apply immediately. New comments use the new keyword. Old comments with old keyword won't trigger.

**Q: Can I have multiple trigger keywords?**
A: Currently no - each flow has one trigger keyword. Create separate flows for multiple keywords.

**Q: Do I need a Notion database to use this?**
A: Technically no - comments can be on any page. But typically tasks are created in a database you specify.

**Q: What permissions does the integration need?**
A: Minimum required:
- Read content (to read comments)
- Read comments (to fetch comment threads)
- Insert comments (to post replies)

**Q: Is my Notion token stored securely?**
A: Yes, tokens are encrypted at rest in Discubot's database. Never displayed in logs or UI after initial save.

### Getting Help

If you encounter issues:

1. Check [Troubleshooting section](#troubleshooting) above
2. Review Discubot server logs for error details
3. Verify all credentials and URLs
4. Test each step individually
5. Contact Discubot support with error messages and logs

---

**Last Updated**: 2025-12-04
**Phase**: 18.9 - Documentation Complete
**Version**: 1.0

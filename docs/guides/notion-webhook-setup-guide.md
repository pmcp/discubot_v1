# Notion Task Completion Webhook Setup Guide

This guide explains how to configure Notion to send webhooks to Discubot when tasks are marked as "Done", enabling automatic completion notifications to the original Slack or Figma threads.

## Overview

**Flow:**
1. User marks Notion task as "Done"
2. Notion sends webhook to Discubot
3. Discubot queries task → discussion → source config
4. Discubot posts completion message to original Slack/Figma thread

## Prerequisites

- Discubot running on NuxtHub (or public URL accessible by Notion)
- Notion integration with webhook capabilities
- Active source configs (Slack or Figma) with valid API tokens

## Step 1: Configure Notion Integration

### 1.1 Create Notion Integration (if not already done)

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name: "Discubot"
4. Workspace: Select your workspace
5. Capabilities needed:
   - Read content
   - Update content (to update task properties)
6. Click "Submit"
7. Copy the **Internal Integration Secret** (starts with `secret_`)

### 1.2 Enable Webhooks for Integration

1. In your Notion integration settings, find the "Webhooks" section
2. Click "Add webhook subscription"
3. Configure:
   - **Webhook URL**: `https://your-discubot-domain.com/api/webhooks/notion`
   - **Events to subscribe**:
     - Page property updates
   - **Filter** (if available):
     - Property: "Status"
     - Condition: Changed to "Done"

> **Note:** If your Notion plan doesn't support webhook filtering, all page updates will be sent. The endpoint handles this gracefully by checking the status.

### 1.3 Connect Integration to Notion Database

1. Open your Notion Tasks database
2. Click "..." (three dots) → "Connect to"
3. Select "Discubot" integration
4. Confirm connection

## Step 2: Verify Webhook Endpoint

### 2.1 Check Endpoint is Accessible

```bash
# Test the webhook endpoint is reachable
curl -X POST https://your-discubot-domain.com/api/webhooks/notion \
  -H "Content-Type: application/json" \
  -d '{
    "type": "page",
    "data": {
      "object": "page",
      "id": "test-page-id"
    }
  }'
```

Expected response (since task won't exist):
```json
{
  "success": false,
  "error": "Task not found",
  "notionPageId": "test-page-id"
}
```

### 2.2 Test with Real Task

1. Create a test task in Notion (from Slack or Figma discussion)
2. Mark the task as "Done" in Notion
3. Check the original Slack/Figma thread for completion message
4. Check server logs for webhook processing

## Step 3: Monitor Webhook Events

### 3.1 Server Logs

Watch logs for webhook events:

```bash
# Local development
pnpm dev

# Production (NuxtHub)
npx nuxthub logs
```

Look for log entries like:
```
[Notion Webhook] ===== REQUEST RECEIVED =====
[Notion Webhook] Processing page: 123e4567-e89b-12d3-a456-426614174000
[Notion Webhook] Found task: task_abc123
[Notion Webhook] Found discussion: disc_xyz789
[Notion Webhook] ✅ Completion message posted successfully
```

### 3.2 Common Issues

**Issue: "Task not found"**
- Cause: Notion page ID doesn't match any task in Discubot
- Solution: Ensure task was created by Discubot (from Slack/Figma discussion)

**Issue: "Discussion not found"**
- Cause: Task's discussionId doesn't exist
- Solution: Database corruption - check task.discussionId is valid

**Issue: "Config not found"**
- Cause: Source config was deleted or deactivated
- Solution: Reactivate config or create new one

**Issue: "Failed to post completion message"**
- Cause: Adapter failed to post (API token invalid, thread deleted, etc.)
- Solution: Check source config API tokens and thread still exists

## Step 4: Webhook Security (Optional)

For production environments, add webhook signature verification:

### 4.1 Notion Webhook Signatures

Notion sends webhook signatures in the `Notion-Signature` header. To verify:

1. Get signing secret from Notion integration settings
2. Add verification to webhook endpoint:

```typescript
// In notion.post.ts
const signature = getHeader(event, 'Notion-Signature')
const timestamp = getHeader(event, 'Notion-Request-Timestamp')

if (!verifyNotionSignature(signature, timestamp, body, signingSecret)) {
  throw createError({
    statusCode: 401,
    statusMessage: 'Invalid webhook signature',
  })
}
```

3. Store signing secret in environment variables:

```bash
# .env
NOTION_WEBHOOK_SECRET=whsec_...
```

### 4.2 Rate Limiting

Add rate limiting to prevent abuse:

```typescript
// Example using Nuxt rate-limit
const limiter = useRateLimiter({
  max: 100, // 100 requests
  window: 60000, // per minute
})

if (!await limiter.check(event)) {
  throw createError({
    statusCode: 429,
    statusMessage: 'Too many requests',
  })
}
```

## Architecture Reference

### Database Connection Chain

```
Notion Page (notionPageId)
    ↓
discubot_tasks (id, discussionId, notionPageId)
    ↓
discubot_discussions (id, sourceType, sourceThreadId, sourceConfigId)
    ↓
discubot_configs (id, apiToken, sourceType)
    ↓
Adapter (Slack/Figma) → postReply()
    ↓
Original Thread (Slack/Figma)
```

### Supported Task Lifespans

**Long-running tasks are fully supported:**
- ✅ 1 day old - Works
- ✅ 1 week old - Works
- ✅ 1 month old - Works
- ✅ 3 months old - Works
- ✅ 1 year old - Works (as long as source thread still exists)

**Why?**
- No data cleanup/archiving in Discubot
- All connection data preserved indefinitely
- Task → Discussion → Source Thread chain remains intact

## Testing Checklist

- [ ] Notion integration created and connected to database
- [ ] Webhook URL configured in Notion integration
- [ ] Webhook endpoint accessible (curl test passes)
- [ ] Created test task from Slack discussion
- [ ] Marked task as "Done" in Notion
- [ ] Completion message appeared in Slack thread
- [ ] Created test task from Figma comment
- [ ] Marked task as "Done" in Notion
- [ ] Completion message appeared in Figma comment
- [ ] Server logs show successful webhook processing
- [ ] No errors in production logs

## Troubleshooting

### Enable Debug Logging

Temporarily increase log verbosity:

```typescript
// In notion.post.ts, add at top
logger.level = 'debug'
```

### Manual Webhook Trigger

Simulate Notion webhook manually:

```bash
curl -X POST https://your-domain.com/api/webhooks/notion \
  -H "Content-Type: application/json" \
  -d '{
    "type": "page",
    "event": {
      "object": "page",
      "id": "ACTUAL_NOTION_PAGE_ID"
    },
    "data": {
      "object": "page",
      "id": "ACTUAL_NOTION_PAGE_ID",
      "properties": {
        "Status": {
          "status": {
            "name": "Done"
          }
        }
      }
    }
  }'
```

Replace `ACTUAL_NOTION_PAGE_ID` with a real Notion page UUID from your database:

```sql
SELECT notionPageId FROM discubot_tasks LIMIT 1;
```

### Check Database State

Verify task exists and has valid connections:

```sql
-- Check task
SELECT id, notionPageId, discussionId, sourceUrl
FROM discubot_tasks
WHERE notionPageId = 'YOUR_NOTION_PAGE_ID';

-- Check discussion
SELECT id, sourceType, sourceThreadId, sourceConfigId
FROM discubot_discussions
WHERE id = 'DISCUSSION_ID_FROM_ABOVE';

-- Check config
SELECT id, sourceType, active, apiToken
FROM discubot_configs
WHERE id = 'CONFIG_ID_FROM_ABOVE';
```

## Next Steps

1. Monitor webhook events for first few days
2. Add webhook signature verification (production)
3. Set up alerting for webhook failures
4. Consider adding retry logic for failed notifications
5. Add analytics tracking for completion rates

## Related Documentation

- [Notion Webhooks API Reference](https://developers.notion.com/reference/webhooks)
- [Slack Web API](https://api.slack.com/web)
- [Figma Comments API](https://developers.figma.com/docs/rest-api/comments-endpoints/)

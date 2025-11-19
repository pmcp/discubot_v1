# Notion Webhook Testing Guide

Quick guide for testing the Notion task completion webhook implementation.

## Test Scenarios

### 1. End-to-End Test (Slack)

**Setup:**
1. Ensure you have an active Slack source config
2. Create a test Slack channel
3. Invite the Discubot app to the channel

**Test Steps:**
```bash
# 1. Mention the bot in Slack with a task request
@Discubot Can you update the button color to blue?

# 2. Wait for task to be created in Notion
# - Check Slack for confirmation message
# - Note the Notion URL

# 3. Open the Notion task
# 4. Change Status to "Done"

# 5. Verify completion message in Slack thread
# Expected: "✅ Task completed in Notion!"
#           "**Task title**"
#           "[Notion URL]"
```

**Expected Results:**
- ✅ Task created in Notion
- ✅ Webhook received by Discubot
- ✅ Completion message posted to original Slack thread
- ✅ No errors in server logs

### 2. End-to-End Test (Figma)

**Setup:**
1. Ensure you have an active Figma source config
2. Have a Figma file with comments enabled

**Test Steps:**
```bash
# 1. Add a comment in Figma
# Send to: your-team@discubot.yourdomain.com

# 2. Wait for email webhook to be received
# - Check Notion for task creation

# 3. Open the Notion task
# 4. Change Status to "Done"

# 5. Verify completion message in Figma comment thread
```

**Expected Results:**
- ✅ Email parsed correctly
- ✅ Task created in Notion
- ✅ Webhook received
- ✅ Completion message posted to Figma comment

### 3. Webhook Payload Test

**Test with curl:**

```bash
# Get a real task's Notion page ID
# From database or Notion URL: https://notion.so/WORKSPACE/PAGE_ID

# Send test webhook
curl -X POST http://localhost:3000/api/webhooks/notion \
  -H "Content-Type: application/json" \
  -d '{
    "type": "page",
    "event": {
      "object": "page",
      "id": "123e4567-e89b-12d3-a456-426614174000"
    },
    "data": {
      "object": "page",
      "id": "123e4567-e89b-12d3-a456-426614174000",
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

**Expected Response (valid task):**
```json
{
  "success": true,
  "message": "Completion notification posted to source thread",
  "task": {
    "id": "task_abc123",
    "title": "Update button color",
    "notionPageUrl": "https://notion.so/..."
  },
  "sourceThreadId": "C123:1234567.123456",
  "timestamp": "2025-11-19T12:00:00.000Z"
}
```

**Expected Response (task not found):**
```json
{
  "success": false,
  "error": "Task not found",
  "notionPageId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 4. Long-Running Task Test

**Purpose:** Verify that tasks completed weeks/months later still work

**Test Steps:**
```bash
# 1. Create a task from Slack/Figma
# 2. Wait 1+ days (or manually update createdAt in DB)
# 3. Mark as "Done" in Notion
# 4. Verify completion message still posts correctly
```

**Simulate old task:**
```sql
-- Update task to appear old
UPDATE discubot_tasks
SET createdAt = datetime('now', '-30 days')
WHERE id = 'task_abc123';
```

### 5. Error Handling Tests

**Test: Invalid Notion Page ID**
```bash
curl -X POST http://localhost:3000/api/webhooks/notion \
  -H "Content-Type: application/json" \
  -d '{"type":"page","event":{"object":"page","id":"invalid-id"},"data":{"object":"page","id":"invalid-id"}}'
```

Expected: `{"success":false,"error":"Task not found"}`

**Test: Missing Discussion**
```sql
-- Manually break the link (don't do in production!)
UPDATE discubot_tasks
SET discussionId = 'nonexistent'
WHERE id = 'task_abc123';
```

Expected: `{"success":false,"error":"Discussion not found"}`

**Test: Missing Config**
```sql
-- Deactivate config
UPDATE discubot_configs
SET active = false
WHERE id = 'config_abc123';
```

Expected: `{"success":false,"error":"Config not found"}`

**Test: Invalid Source Type**
```sql
-- This shouldn't happen, but test adapter error handling
UPDATE discubot_discussions
SET sourceType = 'unsupported'
WHERE id = 'disc_abc123';
```

Expected: Error thrown by `getAdapter()`

### 6. Status Variations Test

**Test different status values:**

```bash
# Test: Status = "In Progress" (should be ignored)
curl -X POST http://localhost:3000/api/webhooks/notion \
  -H "Content-Type: application/json" \
  -d '{"type":"page","data":{"object":"page","id":"PAGE_ID","properties":{"Status":{"status":{"name":"In Progress"}}}}}'

# Expected: {"success":true,"message":"Status \"In Progress\" is not Done - ignored"}

# Test: Status = "Done" (should process)
curl -X POST http://localhost:3000/api/webhooks/notion \
  -H "Content-Type: application/json" \
  -d '{"type":"page","data":{"object":"page","id":"PAGE_ID","properties":{"Status":{"status":{"name":"Done"}}}}}'

# Expected: Success or error depending on task existence

# Test: Status missing (should still process - assumes Done)
curl -X POST http://localhost:3000/api/webhooks/notion \
  -H "Content-Type: application/json" \
  -d '{"type":"page","data":{"object":"page","id":"PAGE_ID"}}'

# Expected: Processes (no status check, assumes it's Done)
```

## Validation Checklist

### Functional Tests
- [ ] Slack task completion notification works
- [ ] Figma task completion notification works
- [ ] Long-running tasks (1+ month) work
- [ ] Multiple tasks from same discussion work
- [ ] Webhook processes within < 2 seconds

### Error Handling
- [ ] Invalid Notion page ID returns proper error
- [ ] Missing discussion returns proper error
- [ ] Missing config returns proper error
- [ ] Invalid status is ignored (not "Done")
- [ ] Malformed payload returns error

### Performance
- [ ] Webhook responds within 500ms (task not found)
- [ ] Webhook responds within 2s (success)
- [ ] No memory leaks after 100+ webhooks
- [ ] Concurrent webhooks handled correctly

### Logging
- [ ] All webhook events logged
- [ ] Success events logged at INFO level
- [ ] Errors logged at ERROR level
- [ ] Debug logs include full context

### Security (if implemented)
- [ ] Invalid signature rejected
- [ ] Rate limiting works (> 100 req/min blocked)
- [ ] Old timestamps rejected (> 5 min)

## Monitoring

### Server Logs

Watch logs during testing:

```bash
# Development
pnpm dev

# Look for these log patterns:
# [Notion Webhook] ===== REQUEST RECEIVED =====
# [Notion Webhook] Processing page: ...
# [Notion Webhook] ✅ Completion message posted successfully
```

### Database Queries

Check task/discussion state:

```sql
-- Find recent tasks
SELECT id, title, notionPageId, discussionId, createdAt
FROM discubot_tasks
ORDER BY createdAt DESC
LIMIT 10;

-- Check task → discussion → config chain
SELECT
  t.id AS task_id,
  t.notionPageId,
  d.id AS discussion_id,
  d.sourceType,
  d.sourceThreadId,
  c.id AS config_id,
  c.active AS config_active
FROM discubot_tasks t
JOIN discubot_discussions d ON t.discussionId = d.id
JOIN discubot_configs c ON d.sourceConfigId = c.id
WHERE t.id = 'task_abc123';
```

### Network Inspection

Monitor webhook traffic:

```bash
# Use ngrok for local development
ngrok http 3000

# Set Notion webhook URL to ngrok URL
# https://abc123.ngrok.io/api/webhooks/notion

# Watch requests in ngrok dashboard
open http://127.0.0.1:4040
```

## Troubleshooting Common Issues

### Issue: Webhook Not Received

**Check:**
1. Notion webhook URL is correct
2. Endpoint is publicly accessible
3. Notion integration is connected to database
4. Status property changed to "Done"

**Debug:**
```bash
# Test endpoint accessibility
curl https://your-domain.com/api/webhooks/notion

# Check Notion integration webhook logs
# (in Notion integration settings)
```

### Issue: "Task not found"

**Cause:** Notion page was not created by Discubot

**Fix:**
- Only tasks created by Discubot have entries in discubot_tasks
- Manually created Notion pages won't have matching records

### Issue: Completion message not posted

**Cause:** Adapter postReply() failed

**Check:**
1. API token is valid
2. Bot has permissions to post
3. Thread still exists
4. Rate limiting not exceeded

**Debug:**
```typescript
// Add detailed logging in adapter
logger.debug('postReply called:', {
  threadId,
  message: message.substring(0, 50),
  config: { sourceType: config.sourceType }
})
```

### Issue: Multiple webhooks for same task

**Cause:** Notion sends multiple events for property changes

**Fix:**
- Add idempotency check (store processed notionPageId + timestamp)
- Ignore duplicate webhooks within 1 minute window

## Performance Benchmarks

**Expected performance:**
- Webhook receive to DB query: < 50ms
- DB query to adapter call: < 100ms
- Adapter post reply: < 500ms
- Total processing time: < 1 second

**Measure:**
```typescript
// In notion.post.ts
const startTime = Date.now()
// ... processing ...
const duration = Date.now() - startTime
logger.info('Webhook processed', { duration })
```

## Next Steps After Testing

1. Enable webhook signature verification
2. Add rate limiting (100 req/min)
3. Set up monitoring alerts
4. Add retry logic for failed posts
5. Implement idempotency
6. Add analytics tracking
7. Create dashboard for webhook stats

## Related Documentation

- [Notion Webhook Setup Guide](./notion-webhook-setup-guide.md)
- Slack adapter: `/layers/discubot/server/adapters/slack.ts`
- Figma adapter: `/layers/discubot/server/adapters/figma.ts`
- Webhook endpoint: `/layers/discubot/server/api/webhooks/notion.post.ts`

# Resend Email Forwarding for Figma Integration

This guide covers how to use Resend's email forwarding feature to receive Figma comment emails and process them with Discubot.

## Overview

**Why Resend?** Consolidate on a single email provider for both sending (transactional emails) and receiving (Figma webhooks). Resend offers a modern API with excellent documentation and Nuxt integration.

**How it works:**
1. Figma sends comment email → `your-team@yourdomain.com`
2. Resend receives email → fires `email.received` webhook
3. Discubot fetches email content via Resend API
4. Transforms to Mailgun-compatible format
5. Processes with existing Figma adapter (no changes!)

## Architecture

```
┌─────────┐        ┌─────────┐        ┌──────────────┐
│  Figma  │───────▶│ Resend  │───────▶│ Resend       │
│ Comment │  Email │ Inbox   │ Webhook│ Webhook      │
└─────────┘        └─────────┘        │ Handler      │
                                       └──────┬───────┘
                                              │
                                              │ fetchResendEmail()
                                              ▼
                                       ┌──────────────┐
                                       │ Resend API   │
                                       │ /emails/:id  │
                                       └──────┬───────┘
                                              │ HTML + Text
                                              ▼
                                       ┌──────────────┐
                                       │ Transform to │
                                       │ Mailgun      │
                                       │ Format       │
                                       └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ Figma        │
                                       │ Adapter      │
                                       └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ Process      │
                                       │ Discussion   │
                                       └──────────────┘
```

## Setup Guide

### Prerequisites

- Resend account with verified domain
- Domain DNS access (for MX records)
- Discubot deployed and accessible via HTTPS
- `RESEND_API_TOKEN` already configured

### Step 1: Configure Domain for Email Receiving

1. **Log in to Resend Dashboard**
   - Navigate to https://resend.com/domains

2. **Verify Your Domain**
   - Add your domain (e.g., `yourdomain.com`)
   - Add DNS records (SPF, DKIM, DMARC)
   - Wait for verification (usually < 5 minutes)

3. **Configure Inbound Email**
   - Go to "Inbound" tab
   - Enable email receiving for your domain
   - Add MX record to DNS:
     ```
     Type: MX
     Name: @ (or your subdomain)
     Value: feedback-smtp.us-east-1.amazonses.com
     Priority: 10
     ```

### Step 2: Configure Webhook in Resend

1. **Create Webhook**
   - Go to https://resend.com/webhooks
   - Click "Add Webhook"

2. **Webhook Settings**
   - **Endpoint URL**: `https://yourdomain.com/api/webhooks/resend`
   - **Events**: Select only `email.received`
   - **Signing Secret**: Copy the `whsec_...` secret (you'll need this)

3. **Save Webhook**
   - Click "Create Webhook"
   - Test the webhook with "Send Test Event"

### Step 3: Configure Environment Variables

Add to your `.env` file:

```bash
# Email receiving (already have this for sending)
RESEND_API_TOKEN=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook signature verification
RESEND_WEBHOOK_SIGNING_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Set Up Email Forwarding Rule

In Resend dashboard:

1. **Go to Inbound → Forwarding Rules**
2. **Create New Rule**:
   - **Match**: `*@yourdomain.com` (or specific pattern like `figma-*@yourdomain.com`)
   - **Forward to**: Webhook (your webhook endpoint)

**Example patterns:**
- `team-slug@yourdomain.com` → Forward to webhook
- `figma-*@yourdomain.com` → Forward to webhook
- Specific email per team

### Step 5: Configure Figma to Send Emails

Update your Figma integration:

1. **Email Address Format**: `team-slug@yourdomain.com`
   - The part before `@` becomes the team ID
   - Example: `acme@yourdomain.com` → team ID = `acme`

2. **Configure Figma Notifications**:
   - Go to Figma file settings
   - Set up email notifications for comments
   - Use your Resend-configured email address

### Step 6: Test the Integration

Test with a manual email or Figma comment:

```bash
# Send test email via Resend
curl -X POST https://api.resend.com/emails \\
  -H "Authorization: Bearer YOUR_RESEND_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "comments-abc123@email.figma.com",
    "to": ["team-slug@yourdomain.com"],
    "subject": "Test: Jane commented on Design File",
    "html": "<p>This is a test comment</p>",
    "text": "This is a test comment"
  }'
```

Then check:
- ✅ Resend webhook fires
- ✅ Discubot fetches email content
- ✅ Discussion created in database
- ✅ Notion task created
- ✅ No errors in logs

## API Reference

### Webhook Endpoint

**POST /api/webhooks/resend**

Receives `email.received` events from Resend.

**Request Headers:**
```
Content-Type: application/json
svix-id: msg_xxxxx
svix-timestamp: 1234567890
svix-signature: v1,signature1 v1,signature2
```

**Request Body:**
```json
{
  "type": "email.received",
  "created_at": "2025-01-15T12:00:00.000Z",
  "data": {
    "id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
    "from": "comments-abc123@email.figma.com",
    "to": ["team-slug@yourdomain.com"],
    "subject": "Jane commented on Design File"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "discussionId": "disc-123",
    "notionTasks": [
      {
        "taskId": "task-123",
        "url": "https://notion.so/task-123"
      }
    ],
    "isMultiTask": false,
    "processingTime": 1234
  }
}
```

**Response (Error):**
```json
{
  "statusCode": 422,
  "statusMessage": "Failed to process discussion",
  "data": {
    "error": "No Figma file key found in email",
    "retryable": false
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid webhook payload
- `401` - Invalid signature
- `422` - Non-retryable processing error
- `429` - Rate limit exceeded
- `503` - Retryable processing error (Resend will retry)

### Email Fetching Utility

**fetchResendEmail(emailId, apiToken)**

Fetches email content from Resend API after webhook is received.

```typescript
import { fetchResendEmail } from '~/layers/discubot/server/utils/resendEmail'

const email = await fetchResendEmail('email-123', 're_xxxx')
console.log(email.html, email.text)
```

**Returns:**
```typescript
{
  id: string
  object: 'email'
  from: string
  to: string[]
  subject: string
  html: string | null
  text: string | null
  created_at: string
}
```

### Transformation Utility

**transformToMailgunFormat(resendEmail)**

Transforms Resend email to Mailgun-compatible format for existing adapter.

```typescript
import { transformToMailgunFormat } from '~/layers/discubot/server/utils/resendEmail'

const mailgunFormat = transformToMailgunFormat(resendEmail)
// Now compatible with existing Figma adapter!
```

**Returns:**
```typescript
{
  subject: string
  from: string
  recipient: string
  'body-html': string
  'body-plain': string
  'stripped-text': string
  timestamp: number
}
```

## Security

### Webhook Signature Verification

Resend uses **Svix** for webhook signing. Signatures are verified automatically using the `RESEND_WEBHOOK_SIGNING_SECRET`.

**How it works:**
1. Resend signs webhook payload with your secret
2. Includes signature in `svix-signature` header
3. Discubot verifies signature before processing
4. Rejects webhooks with invalid signatures (401)

**Disable in development:**
If `RESEND_WEBHOOK_SIGNING_SECRET` is not set, signature verification is skipped (logs warning).

### Rate Limiting

The webhook endpoint applies rate limiting:
- **100 requests per minute** per IP/identifier
- Standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Returns `429` when limit exceeded

## Troubleshooting

### Email Not Received

**Check:**
1. MX records configured correctly
2. Domain verified in Resend
3. Inbound email enabled
4. Forwarding rule matches email address

**Test:**
```bash
# Check MX records
dig MX yourdomain.com

# Should show Resend's MX server
```

### Webhook Not Firing

**Check:**
1. Webhook endpoint URL is correct (HTTPS required!)
2. Webhook enabled in Resend dashboard
3. `email.received` event selected
4. Test with "Send Test Event" button

**Logs:**
```bash
# Check Discubot logs
tail -f /var/log/discubot.log | grep "Resend Webhook"
```

### Signature Verification Failing

**Check:**
1. `RESEND_WEBHOOK_SIGNING_SECRET` matches Resend dashboard
2. Secret starts with `whsec_`
3. Not using old/rotated secret

**Debug:**
```bash
# Enable debug logging
LOG_LEVEL=debug pnpm dev

# Check signature headers
curl -X POST https://yourdomain.com/api/webhooks/resend \\
  -H "svix-id: msg_test" \\
  -H "svix-timestamp: $(date +%s)" \\
  -H "svix-signature: v1,test" \\
  -d '{"type":"email.received","data":{"id":"test"}}'
```

### Email Content Not Fetched

**Check:**
1. `RESEND_API_TOKEN` configured
2. API token has read permissions
3. Email ID from webhook is valid

**Debug:**
```typescript
// Test direct fetch
const { fetchResendEmail } = await import('~/layers/discubot/server/utils/resendEmail')
const email = await fetchResendEmail('email-id', 're_xxxx')
console.log(email)
```

### Processing Failing

**Check:**
1. Email contains Figma file key
2. Team ID resolves correctly from recipient
3. Config exists for team
4. All required API keys configured (Anthropic, Notion)

**Logs:**
```bash
# Full processing logs
tail -f /var/log/discubot.log | grep -E "Resend Webhook|Figma|Processor"
```

## Migration from Mailgun

If you're migrating from Mailgun:

1. **Keep Both Running** - Run Resend and Mailgun in parallel
2. **Update One Team** - Test with single team first
3. **Monitor Logs** - Compare Resend vs Mailgun processing
4. **Gradual Rollout** - Update teams one-by-one
5. **Remove Mailgun** - Once all teams migrated, remove Mailgun config

**Compatibility:**
- ✅ Same Figma adapter (no changes needed)
- ✅ Same email parser (transformation layer handles differences)
- ✅ Same processing pipeline
- ✅ Same database schema

**Differences:**
- ❌ Mailgun sends body in webhook, Resend requires API fetch
- ❌ Different signature verification (HMAC vs Svix)
- ✅ Resend has better API documentation
- ✅ Resend consolidates sending + receiving

## Performance Considerations

**Webhook Processing:**
- Average time: 500-1500ms
- Includes:
  - Webhook validation: ~10ms
  - Email fetching: ~200-500ms
  - Transformation: ~5ms
  - Figma parsing: ~50ms
  - Processing pipeline: ~200-700ms

**Optimization Tips:**
1. **Enable Caching** - AI responses cached for 1 hour
2. **Batch Processing** - Process multiple emails in parallel if needed
3. **Async Tasks** - Use job queue for heavy operations

## Cost Analysis

**Resend Pricing (as of 2025):**
- Free: 3,000 emails/month, 100 received/month
- Pro: $20/month, 50,000 emails/month, unlimited received
- Enterprise: Custom pricing

**Mailgun Pricing:**
- Pay-as-you-go: $0.80/1,000 emails
- Foundation: $35/month, 50,000 emails

**Savings:**
- Consolidate to Resend → Save Mailgun subscription
- Resend Pro ($20) vs Mailgun Foundation ($35) = **$15/month saved**

## Next Steps

- ✅ **Set up Resend email forwarding** (this guide)
- ✅ **Configure Figma notifications** to use your domain
- ✅ **Test with real Figma comments**
- ✅ **Monitor health endpoint** (`/api/health`)
- ✅ **Set up error tracking** (Sentry, LogRocket)
- ✅ **Configure monitoring dashboards** (Grafana, Datadog)

---

**Need Help?**
- Resend Docs: https://resend.com/docs/dashboard/receiving/forward-emails
- Svix Signature Verification: https://docs.svix.com/receiving/verifying-payloads/how
- Discubot Issues: https://github.com/your-org/discubot/issues

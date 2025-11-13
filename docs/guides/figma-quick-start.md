# Figma Integration - Quick Start

**5-minute guide to get Figma integration working**

## Setup

### 1. Environment Variables

Create `.env` file:

```bash
# Required
FIGMA_ACCESS_TOKEN=your-figma-personal-access-token
NOTION_TOKEN=your-notion-integration-token
NOTION_DB_ID=your-notion-database-id
ANTHROPIC_API_KEY=your-claude-api-key

# Optional
FIGMA_TEAM_ID=your-team-id
```

### 2. Get Figma Access Token

1. Go to [Figma Account Settings](https://www.figma.com/settings)
2. Scroll to "Personal Access Tokens"
3. Click "Create new token"
4. Copy token (starts with `figd_`)

### 3. Get Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Copy "Internal Integration Token"
4. Share target database with integration
5. Copy database ID from URL

### 4. Get Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Navigate to API Keys
3. Create new key
4. Copy key (starts with `sk-ant-`)

## Test the Integration

### Method 1: Direct Processing (Easiest)

```bash
curl -X POST http://localhost:3000/api/discussions/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "data": {
      "discussionId": "test-123",
      "source": "figma",
      "title": "Update button styles",
      "content": "Can we make the primary buttons more prominent? @designer",
      "participants": ["user@example.com"]
    },
    "config": {
      "type": "figma",
      "accessToken": "'$FIGMA_ACCESS_TOKEN'",
      "notionDbId": "'$NOTION_DB_ID'",
      "notionToken": "'$NOTION_TOKEN'"
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "discussionId": "test-123",
  "stage": "completed",
  "aiAnalysis": {
    "summary": "Request to improve button visibility",
    "actionItems": ["Update primary button styles"],
    "isActionable": true
  },
  "tasksCreated": [
    {
      "title": "Update primary button styles",
      "url": "https://notion.so/..."
    }
  ]
}
```

### Method 2: Mailgun Webhook (Real Flow)

```bash
curl -X POST http://localhost:3000/api/webhooks/mailgun \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "team@discubot.com",
    "body-html": "<html><body><a href=\"https://www.figma.com/file/ABC123/Design\">View in Figma</a><p>User commented: Can we update the button styles?</p></body></html>",
    "subject": "New comment on Design file",
    "from": "notifications@figma.com"
  }'
```

## Testing Options

### Skip AI Analysis (Faster)

```bash
curl -X POST http://localhost:3000/api/discussions/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "data": {...},
    "config": {...},
    "skipAI": true
  }'
```

### Skip Notion Creation (Test Processing Only)

```bash
curl -X POST http://localhost:3000/api/discussions/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "data": {...},
    "config": {...},
    "skipNotion": true
  }'
```

## Run Tests

```bash
# All Phase 3 tests (121 unit + 11 integration)
pnpm test tests/utils/emailParser.test.ts
pnpm test tests/adapters/figma.test.ts
pnpm test tests/api/webhooks/mailgun.test.ts
pnpm test tests/api/discussions/process.test.ts
pnpm test tests/integration/figma-flow.test.ts

# Or run all tests
pnpm test
```

## Configure Mailgun Webhook (Production)

1. Log into [Mailgun Dashboard](https://app.mailgun.com/)
2. Go to Sending → Webhooks
3. Add new webhook:
   - **URL**: `https://your-app.com/api/webhooks/mailgun`
   - **Event**: `message-received`
4. Save webhook

## Architecture Overview

```
Figma → Email → Mailgun → /api/webhooks/mailgun
                              ↓
                         Email Parser
                              ↓
                         Figma Adapter
                              ↓
                       Processor Service
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
               AI Service          Notion Service
                    ↓                   ↓
              Generate Summary    Create Task
```

## Common Issues

### 403 Forbidden from Figma
- **Cause**: Invalid access token
- **Fix**: Regenerate token in Figma settings

### Notion Integration Not Found
- **Cause**: Database not shared with integration
- **Fix**: Share database in Notion

### Type Check Errors
- **Fix**: Run `npx nuxt typecheck` to see errors
- **Note**: 86 pre-existing template errors are expected

## Next Steps

- See [Full Figma Integration Guide](./figma-integration.md) for details
- See [Testing Guide](./testing-phase-2.md) for test patterns
- See [PROGRESS_TRACKER.md](../PROGRESS_TRACKER.md) for Phase 4

---

**Need help?** Check the [Figma Integration Guide](./figma-integration.md) for detailed troubleshooting.

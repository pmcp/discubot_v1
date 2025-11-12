# Testing Without ngrok

If you're having issues with ngrok, here are alternative approaches to test Discubot.

---

## Option 1: Local Testing with Direct API Calls (No Webhooks)

You can test the complete flow without needing Slack webhooks at all!

### Step 1: Setup Environment

Make sure you have in `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
NOTION_TOKEN=secret_...
NOTION_DB_ID=your-database-id
```

### Step 2: Start Dev Server

```bash
pnpm dev
```

### Step 3: Test with Direct Processor Endpoint

```bash
# Test the complete flow (AI + Notion)
curl -X POST http://localhost:3000/api/discussions/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "parsed": {
      "title": "Dashboard Update Discussion",
      "content": "Can we update the dashboard to show more metrics? We need user growth stats and engagement analytics. @sarah can you handle the design?",
      "source": "test",
      "threadId": "test:123456",
      "deepLink": "https://example.com/test",
      "sourceMetadata": {
        "author": "Test User",
        "timestamp": "2024-11-12T10:30:00Z"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "discussionId": "generated-id",
  "summary": "Discussion about updating dashboard metrics...",
  "tasksDetected": 2,
  "taskUrls": [
    "https://notion.so/...",
    "https://notion.so/..."
  ],
  "processingTimeMs": 3500
}
```

### Step 4: Verify in Notion

Check your Notion database - you should see new tasks created!

---

## Option 2: Test with Figma (Email-Based, No Webhooks Needed)

Figma integration works via Mailgun email forwarding, which doesn't require ngrok.

### Setup Mailgun
1. Create free Mailgun account
2. Configure email forwarding to webhook
3. Follow: `docs/guides/figma-quick-start.md`

---

## Option 3: ngrok Alternatives

### Cloudflare Tunnel (Free, No Account Required)
```bash
# Install
brew install cloudflare/cloudflare/cloudflared

# Start tunnel
cloudflared tunnel --url http://localhost:3000
```

Copy the `*.trycloudflare.com` URL and use it in Slack settings.

### localtunnel (Free, npm-based)
```bash
# Install
npm install -g localtunnel

# Start tunnel
lt --port 3000
```

### serveo (SSH-based, No Install)
```bash
ssh -R 80:localhost:3000 serveo.net
```

---

## Option 4: Test Admin UI Without External Integration

You can test the Admin UI completely without Slack/Figma setup!

### Step 1: Start Dev Server
```bash
pnpm dev
```

### Step 2: Access Admin Dashboard
Open: http://localhost:3000/dashboard/[team]/discubot/

### Step 3: Create Mock Config
1. Navigate to Configs
2. Create new config with test data
3. Use **Test Connection** button to verify tokens

### Step 4: View Jobs and Tasks
- Jobs dashboard shows processing history
- Discussions shows all processed messages
- Tasks shows detected action items

---

## Option 5: Unit and Integration Tests

Run the comprehensive test suite without any external services:

```bash
# All tests
pnpm test

# Specific integration tests
pnpm test tests/integration/slack-flow.test.ts
pnpm test tests/integration/figma-flow.test.ts

# Adapter tests
pnpm test tests/adapters/slack.test.ts
pnpm test tests/adapters/figma.test.ts

# API endpoint tests
pnpm test tests/api/webhooks/slack.test.ts
pnpm test tests/api/discussions/process.test.ts
```

**Current Status**: 130+ tests covering all functionality!

---

## Recommended Approach (No ngrok Needed)

### For Development & Testing

**Best Option**: Direct API Testing (Option 1)
- ✅ No external tools needed
- ✅ Tests complete flow
- ✅ Real AI and Notion integration
- ✅ Fast iteration

**Steps**:
1. Setup Notion (5 min)
2. Configure `.env`
3. Test with curl (shown above)
4. Verify tasks in Notion

### For Production

**Deploy to NuxtHub** (Cloudflare)
- ✅ Automatic HTTPS
- ✅ No tunnel needed
- ✅ Real webhook URLs
- ✅ Production-ready

```bash
# Deploy
nuxthub deploy
```

Then configure Slack webhooks with your production URL.

---

## Quick Test Script (No Webhooks)

Save this as `test-local.sh`:

```bash
#!/bin/bash

# Test Discubot locally without webhooks

BASE_URL="http://localhost:3000"

echo "Testing Discubot (no webhooks)..."
echo ""

# Test 1: Simple task detection
echo "Test 1: Simple task detection"
curl -X POST "$BASE_URL/api/discussions/process" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "parsed": {
      "title": "Simple Task Test",
      "content": "Can someone update the homepage by Friday?",
      "source": "test",
      "threadId": "test:001",
      "deepLink": "https://example.com/test1"
    }
  }'
echo ""
echo ""

# Test 2: Multiple tasks
echo "Test 2: Multiple task detection"
curl -X POST "$BASE_URL/api/discussions/process" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "parsed": {
      "title": "Multiple Tasks Test",
      "content": "We need to: 1) Update dashboard 2) Fix navigation bug 3) Add dark mode",
      "source": "test",
      "threadId": "test:002",
      "deepLink": "https://example.com/test2"
    }
  }'
echo ""
echo ""

# Test 3: No tasks (info only)
echo "Test 3: Information only (no tasks)"
curl -X POST "$BASE_URL/api/discussions/process" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "parsed": {
      "title": "Info Only Test",
      "content": "Just FYI, the deployment went well yesterday. No issues to report.",
      "source": "test",
      "threadId": "test:003",
      "deepLink": "https://example.com/test3"
    }
  }'
echo ""
echo ""

echo "✅ Tests complete!"
echo ""
echo "Check your Notion database for new tasks:"
echo "  https://notion.so/..."
echo ""
echo "Check admin dashboard:"
echo "  $BASE_URL/dashboard/[team]/discubot/"
```

Make executable and run:
```bash
chmod +x test-local.sh
./test-local.sh
```

---

## ngrok Troubleshooting

If you want to fix ngrok issues:

### Common Issues

#### Issue: "command not found: ngrok"
```bash
# Install ngrok
brew install ngrok

# Or download from https://ngrok.com/download
```

#### Issue: "authtoken" required
```bash
# Sign up at https://ngrok.com (free)
# Get auth token from dashboard
ngrok config add-authtoken YOUR_TOKEN
```

#### Issue: "Session expired"
```bash
# Free ngrok tunnels expire after 2 hours
# Just restart:
ngrok http 3000
```

#### Issue: URL keeps changing
- Free ngrok gives random URLs
- Get static URL with paid plan ($8/month)
- Or use cloudflare tunnel (free, stable URLs)

### Minimal ngrok Setup
```bash
# 1. Install
brew install ngrok

# 2. Sign up & auth (one-time)
ngrok config add-authtoken YOUR_TOKEN

# 3. Start tunnel
ngrok http 3000

# 4. Copy HTTPS URL
# 5. Update Slack webhook URL
```

---

## Summary: Test Without Webhooks

**Easiest Path**:
1. ✅ Setup Notion (5 min)
2. ✅ Configure `.env` with API keys
3. ✅ Start dev server: `pnpm dev`
4. ✅ Run direct API test:
   ```bash
   curl -X POST http://localhost:3000/api/discussions/process \
     -H "Content-Type: application/json" \
     -d '{"type":"direct","parsed":{"title":"Test","content":"Update the dashboard","source":"test","threadId":"test:1","deepLink":"https://example.com"}}'
   ```
5. ✅ Check Notion for new tasks!

**No ngrok, Slack, or external services needed!**

---

## Next Steps

1. **Test locally** with direct API calls (Option 1)
2. **Verify** tasks are created in Notion
3. **Use Admin UI** to monitor jobs and tasks
4. **Deploy** to production when ready
5. **Then** configure webhooks with production URL

You can develop and test the complete system without ever using ngrok! 🚀
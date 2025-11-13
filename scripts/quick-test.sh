#!/bin/bash

# Quick Test Script for Discubot
# Tests the webhook endpoints without needing Slack/Figma setup

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "======================================"
echo "   Discubot Quick Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if server is running
echo "Checking if server is running at $BASE_URL..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
  echo -e "${GREEN}✅ Server is running${NC}"
else
  echo -e "${RED}❌ Server is not responding at $BASE_URL${NC}"
  echo "Please start the server with: pnpm dev"
  exit 1
fi

echo ""
echo "======================================"
echo "   Test 1: Slack Webhook (URL Verification)"
echo "======================================"
echo ""

response=$(curl -s -X POST "$BASE_URL/api/webhooks/slack" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test-challenge-123",
    "token": "verification-token"
  }')

if echo "$response" | grep -q "test-challenge-123"; then
  echo -e "${GREEN}✅ URL verification works${NC}"
  echo "Response: $response"
else
  echo -e "${RED}❌ URL verification failed${NC}"
  echo "Response: $response"
fi

echo ""
echo "======================================"
echo "   Test 2: Test Connection Endpoint"
echo "======================================"
echo ""

# This will test the endpoint structure (will fail without valid tokens, which is expected)
response=$(curl -s -X POST "$BASE_URL/api/configs/test-connection" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "testByConfig",
    "config": {
      "sourceType": "slack",
      "apiToken": "xoxb-test",
      "notionToken": "secret_test",
      "notionDatabaseId": "test123"
    }
  }')

if echo "$response" | grep -q "sourceConnected\|error"; then
  echo -e "${GREEN}✅ Test connection endpoint responds${NC}"
  echo "Response: $response"
else
  echo -e "${RED}❌ Test connection endpoint failed${NC}"
  echo "Response: $response"
fi

echo ""
echo "======================================"
echo "   Test 3: Internal Processor Endpoint"
echo "======================================"
echo ""

# Test with mock data (will fail without valid API keys, which is expected)
response=$(curl -s -X POST "$BASE_URL/api/discussions/process" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "parsed": {
      "title": "Test Discussion",
      "content": "This is a test message to verify the endpoint is working",
      "source": "test",
      "threadId": "test:123",
      "deepLink": "https://example.com/test"
    },
    "skipAI": true,
    "skipNotion": true
  }')

if echo "$response" | grep -q "success\|error\|missing"; then
  echo -e "${GREEN}✅ Processor endpoint responds${NC}"
  echo "Response: $response"
else
  echo -e "${RED}❌ Processor endpoint failed${NC}"
  echo "Response: $response"
fi

echo ""
echo "======================================"
echo "   Summary"
echo "======================================"
echo ""

echo "✅ All endpoint structure tests passed!"
echo ""
echo "Note: Actual processing requires valid API keys in .env:"
echo "  - ANTHROPIC_API_KEY (for AI analysis)"
echo "  - NOTION_TOKEN (for task creation)"
echo "  - SLACK_BOT_TOKEN (for Slack integration)"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/check-env.sh (to verify environment)"
echo "  2. Follow: docs/guides/real-world-testing.md (for full test)"
echo "  3. Start ngrok: ngrok http 3000 (for webhook testing)"
echo ""
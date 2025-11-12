#!/bin/bash

# Real-World Testing - Environment Check Script
# This script helps verify that all required environment variables are configured

set -e

echo "======================================"
echo "   Discubot Environment Check"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${RED}❌ .env file not found${NC}"
  echo "Please create .env file from .env.example:"
  echo "  cp .env.example .env"
  exit 1
fi

echo "Checking required environment variables..."
echo ""

# Required variables
REQUIRED_VARS=(
  "ANTHROPIC_API_KEY:AI Service (Claude)"
  "NOTION_TOKEN:Notion Integration"
  "NOTION_DB_ID:Notion Database"
  "BASE_URL:Application URL"
  "NUXT_SESSION_PASSWORD:Session Security"
)

# Optional but recommended for Slack testing
SLACK_VARS=(
  "SLACK_CLIENT_ID:Slack OAuth"
  "SLACK_CLIENT_SECRET:Slack OAuth"
  "SLACK_BOT_TOKEN:Slack Bot"
)

missing_count=0
missing_vars=()

# Check required variables
echo "=== Required Variables ==="
for var_desc in "${REQUIRED_VARS[@]}"; do
  IFS=':' read -r var desc <<< "$var_desc"
  if grep -q "^${var}=.\+$" .env 2>/dev/null; then
    echo -e "${GREEN}✅${NC} $var - $desc"
  else
    echo -e "${RED}❌${NC} $var - $desc"
    missing_count=$((missing_count + 1))
    missing_vars+=("$var:$desc")
  fi
done

echo ""
echo "=== Slack Integration (Optional) ==="
slack_missing=0
for var_desc in "${SLACK_VARS[@]}"; do
  IFS=':' read -r var desc <<< "$var_desc"
  if grep -q "^${var}=.\+$" .env 2>/dev/null; then
    echo -e "${GREEN}✅${NC} $var - $desc"
  else
    echo -e "${YELLOW}⚠️${NC}  $var - $desc"
    slack_missing=$((slack_missing + 1))
  fi
done

echo ""
echo "======================================"
echo "   Summary"
echo "======================================"

if [ $missing_count -eq 0 ]; then
  echo -e "${GREEN}✅ All required variables are configured!${NC}"

  if [ $slack_missing -eq 0 ]; then
    echo -e "${GREEN}✅ Slack integration ready!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start dev server: pnpm dev"
    echo "  2. Start ngrok: ngrok http 3000"
    echo "  3. Follow: docs/guides/real-world-testing.md"
  else
    echo -e "${YELLOW}⚠️  Slack variables missing (${slack_missing})${NC}"
    echo ""
    echo "To test Slack integration, add these variables:"
    echo "  SLACK_CLIENT_ID      (from Slack App > Basic Info > App Credentials)"
    echo "  SLACK_CLIENT_SECRET  (from Slack App > Basic Info > App Credentials)"
    echo "  SLACK_BOT_TOKEN      (from Slack App > OAuth & Permissions after install)"
  fi
else
  echo -e "${RED}❌ Missing ${missing_count} required variable(s)${NC}"
  echo ""
  echo "Please add these to your .env file:"
  echo ""

  for var_desc in "${missing_vars[@]}"; do
    IFS=':' read -r var desc <<< "$var_desc"
    echo "  ${var}=..."
    echo "    → ${desc}"

    # Provide specific instructions
    case $var in
      ANTHROPIC_API_KEY)
        echo "    → Get from: https://console.anthropic.com/ → API Keys"
        ;;
      NOTION_TOKEN)
        echo "    → Get from: https://www.notion.so/my-integrations → Create integration"
        ;;
      NOTION_DB_ID)
        echo "    → Create database in Notion, share with integration, copy ID from URL"
        ;;
      BASE_URL)
        echo "    → For local dev: http://localhost:3000"
        ;;
      NUXT_SESSION_PASSWORD)
        echo "    → Generate with: openssl rand -base64 32"
        ;;
    esac
    echo ""
  done

  exit 1
fi

echo ""
echo "======================================"
echo "   Quick Links"
echo "======================================"
echo ""
echo "📚 Testing Guide: docs/guides/real-world-testing.md"
echo "🚀 Slack Quick Start: docs/guides/slack-quick-start.md"
echo "🎨 Figma Quick Start: docs/guides/figma-quick-start.md"
echo ""
#!/bin/bash
# Quick script to update Slack token in database
# Usage: ./update-slack-token.sh YOUR_NEW_TOKEN

if [ -z "$1" ]; then
  echo "Usage: ./update-slack-token.sh YOUR_NEW_TOKEN"
  echo "Example: ./update-slack-token.sh xoxb-123-456-abc"
  exit 1
fi

NEW_TOKEN="$1"
DB_PATH="/Users/pmcp/Projects/Time-Line/Github/discubot_v1/.data/hub/d1/miniflare-D1DatabaseObject/7b8799eb95f0bb5448e259812996a461ce40142dacbdea254ea597e307767f45.sqlite"

echo "🔄 Updating Slack bot token..."

sqlite3 "$DB_PATH" "UPDATE discubot_configs SET apiToken = '$NEW_TOKEN' WHERE sourceType = 'slack';"

echo "✅ Token updated in database!"
echo ""
echo "Current config:"
sqlite3 "$DB_PATH" "SELECT id, name, apiToken FROM discubot_configs WHERE sourceType = 'slack';"
echo ""
echo "Don't forget to also update your .env file:"
echo "SLACK_BOT_TOKEN=$NEW_TOKEN"
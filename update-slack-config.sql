-- Update all active Slack configs to include slackTeamId in sourceMetadata
-- Run this with: sqlite3 .data/hub.db < update-slack-config.sql

-- First, let's see what we have
SELECT
  id,
  name,
  sourceType,
  active,
  sourceMetadata
FROM discubot_configs
WHERE sourceType = 'slack';

-- Update the sourceMetadata to include slackTeamId
-- Replace the entire sourceMetadata with JSON that includes slackTeamId
UPDATE discubot_configs
SET sourceMetadata = json_object('slackTeamId', 'T06SZE1U91Q')
WHERE sourceType = 'slack';

-- Verify the update
SELECT
  id,
  name,
  sourceType,
  active,
  sourceMetadata,
  json_extract(sourceMetadata, '$.slackTeamId') as extracted_team_id
FROM discubot_configs
WHERE sourceType = 'slack';

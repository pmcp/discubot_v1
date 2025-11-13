/**
 * Update existing Slack config to include slackTeamId in sourceMetadata
 * Run with: node update-config.mjs
 */

import Database from 'better-sqlite3'

const SLACK_TEAM_ID = 'T06SZE1U91Q' // From your webhook logs

const db = new Database('.data/hub.db')

console.log('\n🔧 Updating Slack config with slackTeamId...\n')

// Get existing Slack configs
const configs = db.prepare(`
  SELECT id, name, sourceType, sourceMetadata
  FROM discubot_configs
  WHERE sourceType = 'slack' AND active = 1
`).all()

if (configs.length === 0) {
  console.log('❌ No active Slack configs found!')
  console.log('Create one in the Admin UI first.')
  process.exit(1)
}

console.log(`Found ${configs.length} active Slack config(s):\n`)

configs.forEach((config, i) => {
  console.log(`Config ${i + 1}:`)
  console.log(`  ID: ${config.id}`)
  console.log(`  Name: ${config.name}`)

  let metadata = {}
  try {
    metadata = config.sourceMetadata ? JSON.parse(config.sourceMetadata) : {}
  } catch (e) {
    console.log('  ⚠️  Invalid sourceMetadata JSON, resetting...')
  }

  // Add slackTeamId
  metadata.slackTeamId = SLACK_TEAM_ID

  // Update the config
  db.prepare(`
    UPDATE discubot_configs
    SET sourceMetadata = ?
    WHERE id = ?
  `).run(JSON.stringify(metadata), config.id)

  console.log(`  ✅ Updated sourceMetadata:`)
  console.log(`     slackTeamId: ${SLACK_TEAM_ID}`)
  console.log()
})

console.log('✅ All configs updated successfully!\n')
console.log('Try sending a Slack message now - it should work! 🚀\n')

db.close()

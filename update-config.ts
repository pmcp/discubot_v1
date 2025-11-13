/**
 * Update existing Slack config to include slackTeamId in sourceMetadata
 * Run with: npx tsx update-config.ts
 */

const SLACK_TEAM_ID = 'T06SZE1U91Q' // From your webhook logs

async function updateConfig() {
  console.log('\n🔧 Updating Slack config with slackTeamId...\n')

  // Use hubDatabase to access the database
  const { hubDatabase } = await import('@nuxthub/core')
  const db = hubDatabase()

  // Get existing Slack configs
  const configs = await db.prepare(`
    SELECT id, name, sourceType, sourceMetadata, active
    FROM discubot_configs
    WHERE sourceType = 'slack'
  `).all()

  if (!configs.results || configs.results.length === 0) {
    console.log('❌ No Slack configs found!')
    console.log('Create one in the Admin UI first.')
    process.exit(1)
  }

  console.log(`Found ${configs.results.length} Slack config(s):\n`)

  for (const config of configs.results) {
    console.log(`Config:`)
    console.log(`  ID: ${config.id}`)
    console.log(`  Name: ${config.name}`)
    console.log(`  Active: ${config.active === 1 ? '✅' : '❌'}`)

    let metadata: any = {}
    try {
      metadata = config.sourceMetadata ? JSON.parse(config.sourceMetadata as string) : {}
    } catch (e) {
      console.log('  ⚠️  Invalid sourceMetadata JSON, resetting...')
    }

    // Add slackTeamId
    metadata.slackTeamId = SLACK_TEAM_ID

    // Update the config
    await db.prepare(`
      UPDATE discubot_configs
      SET sourceMetadata = ?
      WHERE id = ?
    `).bind(JSON.stringify(metadata), config.id).run()

    console.log(`  ✅ Updated sourceMetadata:`)
    console.log(`     slackTeamId: ${SLACK_TEAM_ID}`)
    console.log()
  }

  console.log('✅ All configs updated successfully!\n')
  console.log('Try sending a Slack message now - it should work! 🚀\n')
}

updateConfig().catch(console.error)

/**
 * Debug script to check what configs exist in the database
 * Run with: node debug-config.mjs
 */

import Database from 'better-sqlite3'

const db = new Database('.data/hub.db')

console.log('\n🔍 Checking discubot_configs table...\n')

// Check if table exists
const tableCheck = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name='discubot_configs'
`).get()

if (!tableCheck) {
  console.log('❌ Table "discubot_configs" does not exist!')
  console.log('\nRun migrations first: pnpm db:generate && pnpm db:migrate')
  process.exit(1)
}

console.log('✅ Table exists\n')

// Get all configs
const configs = db.prepare(`
  SELECT
    id,
    teamId,
    sourceType,
    name,
    active,
    aiEnabled,
    notionToken,
    notionDatabaseId,
    apiToken,
    createdAt
  FROM discubot_configs
`).all()

console.log(`📊 Found ${configs.length} config(s):\n`)

if (configs.length === 0) {
  console.log('⚠️  No configs in database!')
  console.log('\nYou need to create a config through the Admin UI:')
  console.log('http://localhost:3000/dashboard/[team]/discubot/configs')
} else {
  configs.forEach((config, i) => {
    console.log(`Config ${i + 1}:`)
    console.log(`  ID: ${config.id}`)
    console.log(`  Team ID: ${config.teamId}`)
    console.log(`  Source Type: ${config.sourceType}`)
    console.log(`  Name: ${config.name}`)
    console.log(`  Active: ${config.active === 1 ? '✅ true' : '❌ false'}`)
    console.log(`  AI Enabled: ${config.aiEnabled === 1 ? '✅ true' : '❌ false'}`)
    console.log(`  Has Notion Token: ${config.notionToken ? '✅ yes' : '❌ no'}`)
    console.log(`  Has API Token: ${config.apiToken ? '✅ yes' : '❌ no'}`)
    console.log(`  Created: ${new Date(config.createdAt).toLocaleString()}`)
    console.log()
  })

  console.log('🎯 Looking for match:')
  console.log(`  Team ID: T06SZE1U91Q`)
  console.log(`  Source Type: slack`)
  console.log(`  Active: true (1)\n`)

  const match = configs.find(c =>
    c.teamId === 'T06SZE1U91Q' &&
    c.sourceType === 'slack' &&
    c.active === 1
  )

  if (match) {
    console.log('✅ MATCH FOUND!')
    console.log(`   Config ID: ${match.id}`)
    console.log(`   Name: ${match.name}`)
  } else {
    console.log('❌ NO MATCH FOUND\n')

    // Check why
    const teamMatch = configs.find(c => c.teamId === 'T06SZE1U91Q')
    if (!teamMatch) {
      console.log('   Problem: No config with teamId "T06SZE1U91Q"')
      console.log(`   Available teamIds: ${[...new Set(configs.map(c => c.teamId))].join(', ')}`)
    }

    const sourceMatch = configs.find(c => c.sourceType === 'slack')
    if (!sourceMatch) {
      console.log('   Problem: No config with sourceType "slack"')
      console.log(`   Available sourceTypes: ${[...new Set(configs.map(c => c.sourceType))].join(', ')}`)
    }

    const activeMatch = configs.find(c => c.active === 1)
    if (!activeMatch) {
      console.log('   Problem: No active configs (all have active=0)')
      console.log('   Fix: Set active=1 for your config')
    }
  }
}

console.log('\n')
db.close()

/**
 * Check which Claude models are available with your API key
 *
 * Run with: npx tsx tests/manual/check-available-models.ts
 */

import Anthropic from '@anthropic-ai/sdk'

async function checkModels() {
  console.log('🔍 Checking Available Claude Models\n')
  console.log('════════════════════════════════════════\n')

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set')
    process.exit(1)
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  // List of known Claude models to test
  const modelsToTest = [
    // Latest versions
    'claude-3-5-sonnet-latest',
    'claude-3-opus-latest',
    'claude-3-sonnet-latest',
    'claude-3-haiku-latest',

    // Specific versions (newer first)
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',

    // Older versions
    'claude-2.1',
    'claude-2.0',
  ]

  console.log('Testing models...\n')

  for (const modelId of modelsToTest) {
    try {
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
      })

      console.log(`✅ ${modelId} - AVAILABLE`)
    }
    catch (error: any) {
      if (error.status === 404) {
        console.log(`❌ ${modelId} - NOT FOUND`)
      }
      else if (error.status === 400) {
        console.log(`⚠️  ${modelId} - BAD REQUEST (check permissions)`)
      }
      else {
        console.log(`❌ ${modelId} - ERROR: ${error.message}`)
      }
    }
  }

  console.log('\n════════════════════════════════════════')
  console.log('\n💡 Recommendation:')
  console.log('   Use the first ✅ model from the list above')
  console.log('   "latest" versions are most reliable')
}

checkModels()

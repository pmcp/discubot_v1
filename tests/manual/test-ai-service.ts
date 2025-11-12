/**
 * Manual test for AI service
 *
 * This tests the AI service with mock thread data.
 * Run with: npx tsx tests/manual/test-ai-service.ts
 */

import type { DiscussionThread } from '../../layers/discubot/types'
import { analyzeDiscussion } from '../../layers/discubot/server/services/ai'

// Mock thread data
const mockThread: DiscussionThread = {
  id: 'test-thread-123',
  rootMessage: {
    id: 'msg-1',
    authorHandle: 'alice@company.com',
    content: 'The login button is too small and hard to click on mobile devices. Can we make it bigger and add better contrast?',
    timestamp: new Date('2025-01-10T10:00:00Z'),
  },
  replies: [
    {
      id: 'msg-2',
      authorHandle: 'bob@company.com',
      content: 'Good point! I also noticed the loading state is missing. We should add a spinner.',
      timestamp: new Date('2025-01-10T10:15:00Z'),
    },
    {
      id: 'msg-3',
      authorHandle: 'carol@company.com',
      content: 'Agreed on both. Should we also update the color scheme to match our new brand guidelines?',
      timestamp: new Date('2025-01-10T10:20:00Z'),
    },
  ],
  participants: ['alice@company.com', 'bob@company.com', 'carol@company.com'],
  metadata: {
    source: 'Figma',
    fileKey: 'abc123',
  },
}

async function testAIService() {
  console.log('🧪 Testing AI Service\n')
  console.log('════════════════════════════════════════\n')

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set')
    console.log('   Set it with: export ANTHROPIC_API_KEY=sk-ant-...')
    console.log('   Get a key at: https://console.anthropic.com/')
    process.exit(1)
  }

  console.log('📋 Test Thread:')
  console.log('   Thread ID:', mockThread.id)
  console.log('   Root message:', mockThread.rootMessage.content.substring(0, 60) + '...')
  console.log('   Replies:', mockThread.replies.length)
  console.log('   Participants:', mockThread.participants.length)
  console.log()

  try {
    console.log('🤖 Calling AI service...')
    const startTime = Date.now()

    const result = await analyzeDiscussion(mockThread, {
      sourceType: 'Figma',
    })

    const duration = Date.now() - startTime

    console.log('\n✅ AI Analysis Complete!\n')
    console.log('════════════════════════════════════════\n')
    console.log('📊 Summary:')
    console.log('   ', result.summary.summary)
    console.log()
    console.log('🎯 Key Points:')
    result.summary.keyPoints.forEach((point, i) => {
      console.log(`   ${i + 1}. ${point}`)
    })
    console.log()
    console.log('😊 Sentiment:', result.summary.sentiment)
    console.log('📈 Confidence:', Math.round((result.summary.confidence || 0) * 100) + '%')
    console.log()
    console.log('📝 Tasks Detected:', result.taskDetection.tasks.length)
    console.log('🔀 Multi-task?', result.taskDetection.isMultiTask ? 'Yes' : 'No')
    console.log()

    if (result.taskDetection.tasks.length > 0) {
      console.log('✅ Detected Tasks:\n')
      result.taskDetection.tasks.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task.title}`)
        console.log(`      Description: ${task.description}`)
        console.log(`      Priority: ${task.priority || 'medium'}`)
        if (task.assignee) {
          console.log(`      Assignee: @${task.assignee}`)
        }
        if (task.tags && task.tags.length > 0) {
          console.log(`      Tags: ${task.tags.join(', ')}`)
        }
        console.log()
      })
    }

    console.log('⏱️  Processing Time:', duration + 'ms')
    console.log('💾 Cached:', result.cached ? 'Yes' : 'No')
    console.log()

    // Test cache
    console.log('🔄 Testing cache...')
    const cachedStartTime = Date.now()
    const cachedResult = await analyzeDiscussion(mockThread, {
      sourceType: 'Figma',
    })
    const cachedDuration = Date.now() - cachedStartTime

    console.log('   Cached result time:', cachedDuration + 'ms')
    console.log('   From cache?', cachedResult.cached ? 'Yes ✅' : 'No ❌')
    console.log()

    console.log('════════════════════════════════════════')
    console.log('✅ All AI service tests passed!')
    console.log('════════════════════════════════════════')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test
testAIService()

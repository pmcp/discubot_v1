/**
 * Manual test for processor service
 *
 * This tests the complete processing pipeline with mock data.
 * Run with: npx tsx tests/manual/test-processor.ts
 */

import type {
  ParsedDiscussion,
  DiscussionThread,
  SourceConfig,
} from '../../layers/discubot/types'
import { processDiscussion } from '../../layers/discubot/server/services/processor'

// Mock parsed discussion
const mockParsed: ParsedDiscussion = {
  sourceType: 'figma',
  sourceThreadId: 'file_abc123:comment_456',
  sourceUrl: 'https://www.figma.com/file/abc123/Design?node-id=1:2#456',
  teamId: 'team_test_123',
  authorHandle: 'alice@company.com',
  title: 'Login button needs improvement',
  content: 'The login button is too small and hard to see on mobile devices. Can we make it bigger and add better contrast?',
  participants: ['alice@company.com', 'bob@company.com', 'carol@company.com'],
  timestamp: new Date(),
  metadata: {
    fileKey: 'abc123',
    fileName: 'Mobile App Design',
    commentId: '456',
  },
}

// Mock thread
const mockThread: DiscussionThread = {
  id: mockParsed.sourceThreadId,
  rootMessage: {
    id: 'msg-1',
    authorHandle: mockParsed.authorHandle,
    content: mockParsed.content,
    timestamp: mockParsed.timestamp,
  },
  replies: [
    {
      id: 'msg-2',
      authorHandle: 'bob@company.com',
      content: 'Agreed! Let\'s also add a loading spinner when the user clicks it.',
      timestamp: new Date(),
    },
    {
      id: 'msg-3',
      authorHandle: 'carol@company.com',
      content: 'Should we update the color scheme to match our new brand guidelines too?',
      timestamp: new Date(),
    },
  ],
  participants: mockParsed.participants,
  metadata: mockParsed.metadata,
}

// Mock config
const mockConfig: SourceConfig = {
  id: 'config_test_123',
  teamId: mockParsed.teamId,
  sourceType: 'figma',
  name: 'Test Figma Config',
  apiToken: 'figd_test_token',
  notionToken: process.env.NOTION_API_KEY || '',
  notionDatabaseId: process.env.NOTION_DATABASE_ID || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  aiEnabled: true,
  autoSync: true,
  settings: {},
  active: true,
}

async function testProcessor() {
  console.log('🧪 Testing Processor Service\n')
  console.log('════════════════════════════════════════\n')

  // Check environment variables
  const hasAI = !!process.env.ANTHROPIC_API_KEY
  const hasNotion = !!(process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID)

  console.log('🔑 Environment:')
  console.log('   ANTHROPIC_API_KEY:', hasAI ? '✅ Set' : '❌ Not set')
  console.log('   NOTION_API_KEY:', process.env.NOTION_API_KEY ? '✅ Set' : '❌ Not set')
  console.log('   NOTION_DATABASE_ID:', process.env.NOTION_DATABASE_ID ? '✅ Set' : '❌ Not set')
  console.log()

  if (!hasAI) {
    console.log('⚠️  Running without AI (using mock analysis)')
  }
  if (!hasNotion) {
    console.log('⚠️  Running without Notion (skipping task creation)')
  }
  console.log()

  console.log('📋 Test Data:')
  console.log('   Source:', mockParsed.sourceType)
  console.log('   Thread ID:', mockParsed.sourceThreadId)
  console.log('   Title:', mockParsed.title)
  console.log('   Messages:', mockThread.replies.length + 1)
  console.log('   Participants:', mockThread.participants.length)
  console.log()

  try {
    console.log('⚙️  Starting processing pipeline...\n')
    const startTime = Date.now()

    const result = await processDiscussion(mockParsed, {
      thread: mockThread,
      config: mockConfig,
      skipAI: !hasAI,
      skipNotion: !hasNotion,
    })

    const duration = Date.now() - startTime

    console.log('✅ Processing Complete!\n')
    console.log('════════════════════════════════════════\n')
    console.log('📊 Results:')
    console.log('   Discussion ID:', result.discussionId)
    console.log('   Processing Time:', duration + 'ms')
    console.log()

    console.log('🤖 AI Analysis:')
    console.log('   Summary:', result.aiAnalysis.summary.summary)
    console.log('   Key Points:', result.aiAnalysis.summary.keyPoints.length)
    console.log('   Sentiment:', result.aiAnalysis.summary.sentiment || 'N/A')
    console.log('   Confidence:', Math.round((result.aiAnalysis.summary.confidence || 0) * 100) + '%')
    console.log('   Cached:', result.aiAnalysis.cached ? 'Yes' : 'No')
    console.log()

    console.log('📝 Task Detection:')
    console.log('   Tasks Found:', result.aiAnalysis.taskDetection.tasks.length)
    console.log('   Multi-task?', result.isMultiTask ? 'Yes' : 'No')
    console.log()

    if (result.aiAnalysis.taskDetection.tasks.length > 0) {
      console.log('✅ Detected Tasks:')
      result.aiAnalysis.taskDetection.tasks.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task.title}`)
        console.log(`      Priority: ${task.priority || 'medium'}`)
      })
      console.log()
    }

    if (result.notionTasks.length > 0) {
      console.log('📄 Notion Tasks Created:')
      result.notionTasks.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task.url}`)
      })
      console.log()
      console.log('👉 View in Notion:', result.notionTasks[0].url)
      console.log()
    }

    console.log('🎯 Pipeline Stages:')
    console.log('   ✅ 1. Validation')
    console.log('   ✅ 2. Config Loading')
    console.log('   ✅ 3. Thread Building')
    console.log('   ' + (hasAI ? '✅' : '⏭️ ') + ' 4. AI Analysis')
    console.log('   ' + (hasNotion ? '✅' : '⏭️ ') + ' 5. Task Creation')
    console.log('   ✅ 6. Finalization')
    console.log()

    console.log('════════════════════════════════════════')
    console.log('✅ All processor tests passed!')
    console.log('════════════════════════════════════════')
    console.log()

    if (!hasAI || !hasNotion) {
      console.log('💡 To test full pipeline, set:')
      if (!hasAI) {
        console.log('   export ANTHROPIC_API_KEY=sk-ant-...')
      }
      if (!hasNotion) {
        console.log('   export NOTION_API_KEY=secret_...')
        console.log('   export NOTION_DATABASE_ID=abc123...')
      }
    }

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
testProcessor()

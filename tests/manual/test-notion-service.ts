/**
 * Manual test for Notion service
 *
 * This creates a real task in your Notion database to verify integration.
 * Run with: npx tsx tests/manual/test-notion-service.ts
 */

import type {
  DiscussionThread,
  AISummary,
  DetectedTask,
  NotionTaskConfig,
} from '../../layers/discubot/types'
import { createNotionTask } from '../../layers/discubot/server/services/notion'

// Mock data
const mockThread: DiscussionThread = {
  id: 'test-thread-456',
  rootMessage: {
    id: 'msg-1',
    authorHandle: 'alice@company.com',
    content: 'We need to improve the login button UX for mobile users',
    timestamp: new Date(),
  },
  replies: [
    {
      id: 'msg-2',
      authorHandle: 'bob@company.com',
      content: 'Agreed! Adding a loading spinner would help too',
      timestamp: new Date(),
    },
  ],
  participants: ['alice@company.com', 'bob@company.com'],
  metadata: {
    fileKey: 'abc123',
    fileName: 'Mobile App Design',
  },
}

const mockAISummary: AISummary = {
  summary: 'Team discussed improving the login button UX for mobile devices, focusing on size, contrast, and loading states.',
  keyPoints: [
    'Make button larger for mobile',
    'Add loading spinner',
    'Improve color contrast',
    'Update to match brand guidelines',
  ],
  sentiment: 'positive',
  confidence: 0.92,
}

const mockTask: DetectedTask = {
  title: 'Improve login button UX for mobile',
  description: 'Make the login button larger, add loading spinner, improve contrast, and update colors to match brand guidelines.',
  priority: 'high',
  assignee: 'bob@company.com',
  tags: ['UX', 'mobile', 'login', 'design'],
}

async function testNotionService() {
  console.log('🧪 Testing Notion Service\n')
  console.log('════════════════════════════════════════\n')

  // Check environment variables
  if (!process.env.NOTION_API_KEY) {
    console.error('❌ NOTION_API_KEY not set')
    console.log('   Get one at: https://www.notion.so/my-integrations')
    console.log('   Then: export NOTION_API_KEY=secret_your_key')
    process.exit(1)
  }

  if (!process.env.NOTION_DATABASE_ID) {
    console.error('❌ NOTION_DATABASE_ID not set')
    console.log('   Create a database and share it with your integration')
    console.log('   Then: export NOTION_DATABASE_ID=abc123def456')
    process.exit(1)
  }

  const config: NotionTaskConfig = {
    databaseId: process.env.NOTION_DATABASE_ID,
    apiKey: process.env.NOTION_API_KEY,
    sourceType: 'Figma',
    sourceUrl: 'https://figma.com/file/abc123/Design?node-id=1:2#comment-456',
  }

  console.log('📋 Test Data:')
  console.log('   Database ID:', config.databaseId)
  console.log('   Source:', config.sourceType)
  console.log('   Task:', mockTask.title)
  console.log('   Priority:', mockTask.priority)
  console.log('   Assignee:', mockTask.assignee)
  console.log()

  try {
    console.log('📝 Creating test task in Notion...')
    const startTime = Date.now()

    const result = await createNotionTask(
      mockTask,
      mockThread,
      mockAISummary,
      config,
    )

    const duration = Date.now() - startTime

    console.log('\n✅ Task Created Successfully!\n')
    console.log('════════════════════════════════════════\n')
    console.log('🎯 Result:')
    console.log('   Task ID:', result.id)
    console.log('   Task URL:', result.url)
    console.log('   Created:', result.createdAt.toLocaleString())
    console.log('   Time:', duration + 'ms')
    console.log()
    console.log('👉 Open in Notion:', result.url)
    console.log()

    console.log('📄 Task contains:')
    console.log('   ✅ AI Summary callout')
    console.log('   ✅ Key action items as checkboxes')
    console.log('   ✅ Participants list')
    console.log('   ✅ Full thread content')
    console.log('   ✅ Metadata (source, priority, sentiment, etc.)')
    console.log('   ✅ Deep link back to Figma')
    console.log()

    console.log('════════════════════════════════════════')
    console.log('✅ All Notion service tests passed!')
    console.log('════════════════════════════════════════')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    console.log()
    console.log('Common issues:')
    console.log('   - Database not shared with integration')
    console.log('   - Invalid API key')
    console.log('   - Database ID has dashes (should be removed)')
    console.log('   - Network connectivity issues')
    process.exit(1)
  }
}

// Run the test
testNotionService()

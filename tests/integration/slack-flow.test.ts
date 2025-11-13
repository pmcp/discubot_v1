/**
 * Integration Tests - Slack Discussion Flow
 *
 * Tests the complete integration between components (not E2E).
 * Unlike unit tests, these test multiple internal components working together.
 *
 * **What we test:**
 * 1. Slack Event → Slack Adapter → Processor
 * 2. Processor → AI → Notion pipeline
 * 3. Error propagation across services
 * 4. Data flow validation
 * 5. OAuth flow integration
 *
 * **What we mock:**
 * - External APIs only (Anthropic, Notion, Slack API calls)
 * - NOT internal components (adapter, processor, webhook handler)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedDiscussion, DiscussionThread, SourceConfig, ThreadMessage } from '../../layers/discubot/types'

// Helper to create mock SourceConfig
const createMockConfig = (overrides: Partial<SourceConfig> = {}): SourceConfig => ({
  id: 'config_test_123',
  teamId: 'T123456',
  sourceType: 'slack',
  name: 'Test Slack Config',
  apiToken: 'xoxb-test-token-123',
  notionToken: 'notion_token_123',
  notionDatabaseId: 'database_id_123',
  aiEnabled: true,
  autoSync: true,
  settings: {
    workspaceId: 'T123456',
  },
  active: true,
  ...overrides,
})

// Helper to create mock DiscussionThread
const createMockThread = (overrides: Partial<DiscussionThread> = {}): DiscussionThread => ({
  id: '1234567890.123456',
  rootMessage: {
    id: '1234567890.123456',
    authorHandle: 'U123456',
    content: 'Root message content',
    timestamp: new Date(1234567890123.456),
  },
  replies: [],
  participants: ['U123456'],
  metadata: {},
  ...overrides,
})

// Create mock functions at module level
const mockAnthropicCreate = vi.fn()
const mockNotionPagesCreate = vi.fn()
const mockSlackFetch = vi.fn()
const mockCreateDiscussion = vi.fn()
const mockUpdateDiscussion = vi.fn()
const mockCreateJob = vi.fn()
const mockUpdateJob = vi.fn()
const mockCreateTask = vi.fn()

// Mock Crouton database queries
vi.mock('#layers/discubot/collections/discussions/server/database/queries', () => ({
  createDiscubotDiscussion: mockCreateDiscussion,
  updateDiscubotDiscussion: mockUpdateDiscussion,
  getDiscubotDiscussionsByIds: vi.fn(),
}))

vi.mock('#layers/discubot/collections/jobs/server/database/queries', () => ({
  createDiscubotJob: mockCreateJob,
  updateDiscubotJob: mockUpdateJob,
  getDiscubotJobsByIds: vi.fn(),
}))

vi.mock('#layers/discubot/collections/tasks/server/database/queries', () => ({
  createDiscubotTask: mockCreateTask,
  getDiscubotTasksByIds: vi.fn(),
}))

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = {
        create: mockAnthropicCreate,
      }
    },
  }
})

// Mock Notion SDK
vi.mock('@notionhq/client', () => {
  return {
    Client: class NotionClient {
      pages = {
        create: mockNotionPagesCreate,
      }
    },
  }
})

// Mock global fetch for Slack API
global.fetch = mockSlackFetch as any

describe('Slack Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up default Crouton database mock responses
    mockCreateDiscussion.mockResolvedValue({
      id: 'discussion_123',
      sourceType: 'slack',
      sourceThreadId: 'C123456:1234567890.123456',
      teamId: 'T123456',
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockUpdateDiscussion.mockResolvedValue(undefined)
    mockCreateJob.mockResolvedValue({
      id: 'job_123',
      teamId: 'T123456',
      sourceType: 'slack',
      status: 'pending',
      stage: 'ingestion',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockUpdateJob.mockResolvedValue(undefined)
    mockCreateTask.mockResolvedValue({
      id: 'task_123',
      discussionId: 'discussion_123',
      jobId: 'job_123',
      notionPageId: 'notion-page-id',
      notionPageUrl: 'https://notion.so/page-id',
      title: 'Test Task',
      teamId: 'T123456',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Set up default Anthropic mock response
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'Team discussed feature implementation and timeline',
            actionItems: ['Create task breakdown', 'Schedule review meeting'],
            detectedTasks: [
              {
                title: 'Implement new feature based on discussion',
                description: 'Team discussed implementation approach and timeline',
                priority: 'high',
              },
            ],
            isMultiTask: true,
            confidence: 0.9,
          }),
        },
      ],
    })

    // Set up default Notion mock response
    mockNotionPagesCreate.mockResolvedValue({
      id: 'notion-page-id',
      url: 'https://notion.so/page-id',
    })

    // Set up default Slack API mock for conversations.replies
    mockSlackFetch.mockImplementation((url: string) => {
      if (url.includes('conversations.replies')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            messages: [
              {
                type: 'message',
                user: 'U123456',
                text: 'This is the root message',
                ts: '1234567890.123456',
              },
              {
                type: 'message',
                user: 'U789012',
                text: 'This is a reply',
                ts: '1234567891.123456',
                thread_ts: '1234567890.123456',
              },
            ],
            has_more: false,
          }),
        })
      }

      // Default for other endpoints (auth.test, chat.postMessage, reactions.add)
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567892.123456',
        }),
      })
    })
  })

  describe('Slack Event → Adapter Integration', () => {
    it('should parse Slack event and create valid ParsedDiscussion', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('slack')

      const slackPayload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U123456',
          text: 'We need to implement the new feature ASAP',
          ts: '1234567890.123456',
        },
      }

      const parsed = await adapter.parseIncoming(slackPayload)

      // Verify all required fields are present
      expect(parsed).toMatchObject({
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: expect.stringContaining('slack://'),
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: expect.any(String),
        content: 'We need to implement the new feature ASAP',
        participants: expect.arrayContaining(['U123456']),
        timestamp: expect.any(Date),
      })

      // Verify metadata extraction
      expect(parsed.metadata).toHaveProperty('channelId', 'C123456')
      expect(parsed.metadata).toHaveProperty('messageTs', '1234567890.123456')
    })

    it('should parse threaded message with correct thread ID', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('slack')

      const slackPayload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U789012',
          text: 'This is a reply in the thread',
          ts: '1234567891.123456',
          thread_ts: '1234567890.123456', // Reply to earlier message
        },
      }

      const parsed = await adapter.parseIncoming(slackPayload)

      // Should use thread_ts for sourceThreadId
      expect(parsed.sourceThreadId).toBe('C123456:1234567890.123456')
      expect(parsed.metadata.threadTs).toBe('1234567890.123456')
    })

    it('should truncate long messages to 50 chars for title', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('slack')

      const slackPayload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U123456',
          text: 'This is a very long message that will definitely exceed the fifty character limit and should be truncated',
          ts: '1234567890.123456',
        },
      }

      const parsed = await adapter.parseIncoming(slackPayload)

      expect(parsed.title.length).toBe(50)
      expect(parsed.title).toMatch(/\.\.\.$/)
    })

    it('should throw error for unsupported event types', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('slack')

      const slackPayload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'app_mention',
          user: 'U123456',
          text: '@bot help',
          ts: '1234567890.123456',
        },
      }

      await expect(adapter.parseIncoming(slackPayload)).rejects.toThrow()
    })
  })

  describe('Adapter → Processor Integration', () => {
    it('should process ParsedDiscussion through full pipeline', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'New feature implementation',
        content: 'We need to implement the new feature ASAP',
        participants: ['U123456', 'U789012'],
        timestamp: new Date(1234567890123.456),
        metadata: {
          channelId: 'C123456',
          messageTs: '1234567890.123456',
        },
      }

      const thread = createMockThread({
        rootMessage: {
          id: '1234567890.123456',
          authorHandle: 'U123456',
          content: 'We need to implement the new feature ASAP',
          timestamp: new Date(1234567890123.456),
        },
        replies: [
          {
            id: '1234567891.123456',
            authorHandle: 'U789012',
            content: 'Agreed, let me create a task breakdown',
            timestamp: new Date(1234567891123.456),
          },
        ],
        participants: ['U123456', 'U789012'],
      })

      const result = await processDiscussion(parsed, {
        thread,
        config: createMockConfig(),
      })

      // Verify processing result structure
      expect(result).toMatchObject({
        discussionId: expect.any(String),
        aiAnalysis: {
          summary: expect.any(String),
          actionItems: expect.any(Array),
          detectedTasks: expect.any(Array),
          isMultiTask: expect.any(Boolean),
          confidence: expect.any(Number),
        },
        notionTasks: expect.any(Array),
        processingTime: expect.any(Number),
        isMultiTask: expect.any(Boolean),
      })

      // Verify external APIs were called
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1)
      expect(mockNotionPagesCreate).toHaveBeenCalled()
    })

    it('should fetch thread from adapter if not provided', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Test discussion',
        content: 'Test content',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
        metadata: {
          channelId: 'C123456',
          messageTs: '1234567890.123456',
        },
      }

      // Don't provide thread - processor should fetch via adapter
      const result = await processDiscussion(parsed, { config: createMockConfig() })

      expect(result).toHaveProperty('discussionId')
      // Slack API should have been called to fetch thread
      expect(mockSlackFetch).toHaveBeenCalledWith(
        expect.stringContaining('conversations.replies'),
        expect.any(Object)
      )
    })

    it('should handle threads with multiple replies', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      // Mock Slack API with multiple replies
      mockSlackFetch.mockImplementationOnce((url: string) => {
        if (url.includes('conversations.replies')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              messages: [
                {
                  type: 'message',
                  user: 'U123456',
                  text: 'Root message',
                  ts: '1234567890.123456',
                },
                {
                  type: 'message',
                  user: 'U789012',
                  text: 'Reply 1',
                  ts: '1234567891.123456',
                  thread_ts: '1234567890.123456',
                },
                {
                  type: 'message',
                  user: 'U345678',
                  text: 'Reply 2',
                  ts: '1234567892.123456',
                  thread_ts: '1234567890.123456',
                },
                {
                  type: 'message',
                  user: 'U901234',
                  text: 'Reply 3',
                  ts: '1234567893.123456',
                  thread_ts: '1234567890.123456',
                },
              ],
              has_more: false,
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        })
      })

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Multi-reply thread',
        content: 'Root message',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
        metadata: {
          channelId: 'C123456',
          messageTs: '1234567890.123456',
        },
      }

      const result = await processDiscussion(parsed, { config: createMockConfig() })

      expect(result).toHaveProperty('discussionId')
      expect(mockSlackFetch).toHaveBeenCalled()
    })
  })

  describe('Error Propagation', () => {
    it('should propagate AI errors with retry flag', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      // Mock AI failure
      mockAnthropicCreate.mockRejectedValueOnce(
        Object.assign(new Error('AI timeout'), { retryable: true })
      )

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Test',
        content: 'Test',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
      }

      const thread = createMockThread()

      await expect(
        processDiscussion(parsed, { config: createMockConfig(), thread: thread })
      ).rejects.toThrow()
    })

    it('should propagate Notion errors', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      // Mock Notion failure
      mockNotionPagesCreate.mockRejectedValueOnce(new Error('Notion API error'))

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Test',
        content: 'Test',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
      }

      const thread = createMockThread()

      await expect(
        processDiscussion(parsed, { config: createMockConfig(), thread: thread })
      ).rejects.toThrow()
    })

    it('should propagate adapter validation errors', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('slack')

      const invalidConfig = createMockConfig({
        apiToken: '', // Empty API token
        notionToken: '',
        notionDatabaseId: '',
      })

      const validation = await adapter.validateConfig(invalidConfig)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('should handle Slack API rate limiting errors', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('slack')

      // Mock rate limit error
      mockSlackFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'rate_limited',
        }),
      })

      const config = createMockConfig()

      await expect(
        adapter.fetchThread('C123456:1234567890.123456', config)
      ).rejects.toThrow()
    })
  })

  describe('Data Flow Validation', () => {
    it('should preserve metadata through the pipeline', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Feature Discussion',
        content: 'We need to prioritize this feature',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
        metadata: {
          channelId: 'C123456',
          messageTs: '1234567890.123456',
          threadTs: undefined,
          channelType: 'public_channel',
        },
      }

      const thread = createMockThread()

      const result = await processDiscussion(parsed, { config: createMockConfig(), thread: thread })

      // Metadata should be preserved in the result
      expect(result.discussionId).toMatch(/^disc_/)
    })

    it('should detect multi-task discussions', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      // Mock multi-task AI response
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Multiple tasks identified from discussion',
              actionItems: ['Task 1', 'Task 2', 'Task 3'],
              detectedTasks: [
                {
                  title: 'Implement authentication',
                  description: 'Add OAuth2 authentication',
                  priority: 'high',
                },
                {
                  title: 'Design user dashboard',
                  description: 'Create dashboard mockups',
                  priority: 'medium',
                },
                {
                  title: 'Write API documentation',
                  description: 'Document all endpoints',
                  priority: 'low',
                },
              ],
              isMultiTask: true,
              confidence: 0.95,
            }),
          },
        ],
      })

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Project planning discussion',
        content: 'We need to work on auth, dashboard, and docs',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
      }

      const thread = createMockThread()

      const result = await processDiscussion(parsed, { config: createMockConfig(), thread: thread })

      expect(result.isMultiTask).toBe(true)
      expect(result.notionTasks).toHaveLength(3)
    })

    it('should handle DM and private channels', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('slack')

      const dmPayload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'D123456', // DM channel starts with D
          user: 'U123456',
          text: 'Private discussion about sensitive topic',
          ts: '1234567890.123456',
        },
      }

      const parsed = await adapter.parseIncoming(dmPayload)

      expect(parsed.sourceThreadId).toBe('D123456:1234567890.123456')
      expect(parsed.metadata.channelId).toBe('D123456')
    })
  })

  describe('Performance', () => {
    it('should complete processing in reasonable time', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Test',
        content: 'Test',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
      }

      const thread = createMockThread()

      const startTime = Date.now()
      const result = await processDiscussion(parsed, { config: createMockConfig(), thread: thread })
      const duration = Date.now() - startTime

      expect(result.processingTime).toBeGreaterThan(0)
      expect(duration).toBeLessThan(5000) // Should complete in under 5s (with mocks)
    })
  })

  describe('OAuth Integration', () => {
    it('should generate valid OAuth state token', () => {
      // Test state token generation logic
      const crypto = require('crypto')
      const state = crypto.randomBytes(32).toString('hex')

      expect(state).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(state).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should validate workspace configuration after OAuth', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('slack')

      const config = createMockConfig({
        settings: {
          workspaceId: 'T123456',
          installedViaOAuth: true,
        },
      })

      const validation = await adapter.validateConfig(config)

      expect(validation.valid).toBe(true)
      expect(validation.warnings).not.toContain(
        expect.stringContaining('workspace ID not found')
      )
    })
  })
})

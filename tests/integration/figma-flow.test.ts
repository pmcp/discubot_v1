/**
 * Integration Tests - Figma Discussion Flow
 *
 * Tests the complete integration between components (not E2E).
 * Unlike unit tests, these test multiple internal components working together.
 *
 * **What we test:**
 * 1. Email Parser → Figma Adapter → Processor
 * 2. Processor → AI → Notion pipeline
 * 3. Error propagation across services
 * 4. Data flow validation
 *
 * **What we mock:**
 * - External APIs only (Anthropic, Notion, Figma API calls)
 * - NOT internal components (adapter, processor, parser)
 */

/**
 * DEPRECATED: This test suite uses the old SourceConfig approach.
 * For flows-based integration tests, see: tests/integration/flow-end-to-end.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedDiscussion, DiscussionThread, SourceConfig, ThreadMessage } from '../../layers/discubot/types'

// Helper to create mock SourceConfig
const createMockConfig = (overrides: Partial<SourceConfig> = {}): SourceConfig => ({
  id: 'config_test_123',
  teamId: 'design-team',
  sourceType: 'figma',
  name: 'Test Figma Config',
  apiToken: 'figma_token_123',
  notionToken: 'notion_token_123',
  notionDatabaseId: 'database_id_123',
  aiEnabled: true,
  autoSync: true,
  settings: {},
  active: true,
  ...overrides,
})

// Helper to create mock DiscussionThread
const createMockThread = (overrides: Partial<DiscussionThread> = {}): DiscussionThread => ({
  id: 'thread_123',
  rootMessage: {
    id: 'msg_root',
    authorHandle: 'jane',
    content: 'Root message content',
    timestamp: new Date(),
  },
  replies: [],
  participants: ['jane'],
  metadata: {},
  ...overrides,
})

// Create mock functions at module level
const mockAnthropicCreate = vi.fn()
const mockNotionPagesCreate = vi.fn()
const mockFigmaFetch = vi.fn()
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

// Mock global fetch for Figma API
global.fetch = mockFigmaFetch as any

describe.skip('Figma Integration Flow (DEPRECATED - see flow-end-to-end.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up default Crouton database mock responses
    mockCreateDiscussion.mockResolvedValue({
      id: 'discussion_123',
      sourceType: 'figma',
      sourceThreadId: 'thread-1',
      teamId: 'design-team',
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockUpdateDiscussion.mockResolvedValue(undefined)
    mockCreateJob.mockResolvedValue({
      id: 'job_123',
      teamId: 'design-team',
      sourceType: 'figma',
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
      teamId: 'design-team',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Set up default Anthropic mock response
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'Team discussed design improvements and spacing fixes',
            actionItems: ['Update design system', 'Fix spacing issues'],
            detectedTasks: [
              {
                title: 'Update design based on feedback',
                description: 'Team discussed several design improvements',
                priority: 'medium',
              },
            ],
            isMultiTask: true,
            confidence: 0.85,
          }),
        },
      ],
    })

    // Set up default Notion mock response
    mockNotionPagesCreate.mockResolvedValue({
      id: 'notion-page-id',
      url: 'https://notion.so/page-id',
    })

    // Set up default Figma API mock
    mockFigmaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        comments: [
          {
            id: 'comment-123',
            message: 'This looks great!',
            user: { handle: 'jane', img_url: '' },
            created_at: '2024-01-01T12:00:00Z',
          },
          {
            id: 'comment-124',
            message: 'Agreed, but spacing needs work',
            user: { handle: 'john', img_url: '' },
            created_at: '2024-01-01T12:30:00Z',
            parent_id: 'comment-123',
          },
        ],
      }),
    })
  })

  describe('Email Parser → Adapter Integration', () => {
    it('should parse email and create valid ParsedDiscussion', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('figma')

      const mailgunPayload = {
        subject: 'Jane commented on Design System',
        from: 'jane@company.com',
        recipient: 'design-team@discubot.example.com',
        'body-html': `
          <div>
            <p>This looks great!</p>
            <a href="https://www.figma.com/file/abc123xyz/Design-System">View in Figma</a>
          </div>
        `,
        'body-plain': 'This looks great!',
        timestamp: 1699999999,
      }

      const parsed = await adapter.parseIncoming(mailgunPayload)

      // Verify all required fields are present
      expect(parsed).toMatchObject({
        sourceType: 'figma',
        sourceThreadId: expect.any(String),
        sourceUrl: expect.stringContaining('figma.com'),
        teamId: 'design-team',
        authorHandle: 'jane@company.com',
        title: expect.any(String),
        content: expect.any(String),
        participants: expect.arrayContaining(['jane@company.com']),
        timestamp: expect.any(Date),
      })

      // Verify metadata extraction
      expect(parsed.metadata).toHaveProperty('fileKey', 'abc123xyz')
      expect(parsed.metadata).toHaveProperty('fileName')
    })

    it('should handle emails with multiple Figma links', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('figma')

      const mailgunPayload = {
        subject: 'Multiple files',
        from: 'jane@company.com',
        recipient: 'team@discubot.example.com',
        'body-html': `
          <a href="https://www.figma.com/file/file1/Design-A">File 1</a>
          <a href="https://www.figma.com/file/file2/Design-B">File 2</a>
        `,
        timestamp: 1699999999,
      }

      const parsed = await adapter.parseIncoming(mailgunPayload)

      // Should use first link as primary
      expect(parsed.metadata?.fileKey).toBe('file1')
    })

    it('should throw error for email without Figma link', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('figma')

      const mailgunPayload = {
        subject: 'No links',
        from: 'jane@company.com',
        recipient: 'team@discubot.example.com',
        'body-html': '<p>Just text, no Figma links</p>',
        timestamp: 1699999999,
      }

      await expect(adapter.parseIncoming(mailgunPayload)).rejects.toThrow()
    })
  })

  describe('Adapter → Processor Integration', () => {
    it('should process ParsedDiscussion through full pipeline', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'figma',
        sourceThreadId: 'comment-123',
        sourceUrl: 'https://figma.com/file/abc123',
        teamId: 'design-team',
        authorHandle: 'jane',
        title: 'Design System Feedback',
        content: 'This looks great!',
        participants: ['jane', 'john'],
        timestamp: new Date(),
        metadata: {
          fileKey: 'abc123',
          fileName: 'Design System',
        },
      }

      const thread = createMockThread({
        rootMessage: {
          id: 'msg-1',
          authorHandle: 'jane',
          content: 'This looks great!',
          timestamp: new Date(),
        },
        replies: [
          {
            id: 'msg-2',
            authorHandle: 'john',
            content: 'Agreed, but spacing needs work',
            timestamp: new Date(),
          },
        ],
        participants: ['jane', 'john'],
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
        sourceType: 'figma',
        sourceThreadId: 'comment-123',
        sourceUrl: 'https://figma.com/file/abc123',
        teamId: 'team',
        authorHandle: 'jane',
        title: 'Test',
        content: 'Test content',
        participants: ['jane'],
        timestamp: new Date(),
        metadata: { fileKey: 'abc123' },
      }

      // Don't provide thread - processor should fetch via adapter
      const result = await processDiscussion(parsed, { config: createMockConfig() })

      expect(result).toHaveProperty('discussionId')
      // Figma API should have been called to fetch thread
      expect(mockFigmaFetch).toHaveBeenCalled()
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
        sourceType: 'figma',
        sourceThreadId: 'thread-1',
        sourceUrl: 'https://figma.com/file/test',
        teamId: 'team',
        authorHandle: 'jane',
        title: 'Test',
        content: 'Test',
        participants: ['jane'],
        timestamp: new Date(),
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
        sourceType: 'figma',
        sourceThreadId: 'thread-1',
        sourceUrl: 'https://figma.com/file/test',
        teamId: 'team',
        authorHandle: 'jane',
        title: 'Test',
        content: 'Test',
        participants: ['jane'],
        timestamp: new Date(),
      }

      const thread = createMockThread()

      await expect(
        processDiscussion(parsed, { config: createMockConfig(), thread: thread })
      ).rejects.toThrow()
    })

    it('should propagate adapter validation errors', async () => {
      const { getAdapter } = await import('../../layers/discubot/server/adapters')
      const adapter = getAdapter('figma')

      const invalidConfig = createMockConfig({
        apiToken: '', // Empty API token
        notionToken: '',
      })

      const validation = await adapter.validateConfig(invalidConfig)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Data Flow Validation', () => {
    it('should preserve metadata through the pipeline', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'figma',
        sourceThreadId: 'comment-123',
        sourceUrl: 'https://figma.com/file/abc123',
        teamId: 'design-team',
        authorHandle: 'jane@company.com',
        title: 'Design Feedback',
        content: 'Great work!',
        participants: ['jane@company.com'],
        timestamp: new Date(),
        metadata: {
          fileKey: 'abc123',
          fileName: 'Design System',
          commentUrl: 'https://figma.com/file/abc123?comment-id=123',
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
              summary: 'Multiple tasks detected',
              actionItems: ['Task 1', 'Task 2', 'Task 3'],
              detectedTasks: [
                {
                  title: 'Task 1',
                  description: 'First task',
                  priority: 'high',
                },
                {
                  title: 'Task 2',
                  description: 'Second task',
                  priority: 'medium',
                },
                {
                  title: 'Task 3',
                  description: 'Third task',
                  priority: 'low',
                },
              ],
              isMultiTask: true,
              confidence: 0.9,
            }),
          },
        ],
      })

      const parsed: ParsedDiscussion = {
        sourceType: 'figma',
        sourceThreadId: 'thread-1',
        sourceUrl: 'https://figma.com/file/test',
        teamId: 'team',
        authorHandle: 'jane',
        title: 'Multi-task discussion',
        content: 'We need to do several things',
        participants: ['jane'],
        timestamp: new Date(),
      }

      const thread = createMockThread()

      const result = await processDiscussion(parsed, { config: createMockConfig(), thread: thread })

      expect(result.isMultiTask).toBe(true)
      expect(result.notionTasks).toHaveLength(3)
    })
  })

  describe('Performance', () => {
    it('should complete processing in reasonable time', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'figma',
        sourceThreadId: 'thread-1',
        sourceUrl: 'https://figma.com/file/test',
        teamId: 'team',
        authorHandle: 'jane',
        title: 'Test',
        content: 'Test',
        participants: ['jane'],
        timestamp: new Date(),
      }

      const thread = createMockThread()

      const startTime = Date.now()
      const result = await processDiscussion(parsed, { config: createMockConfig(), thread: thread })
      const duration = Date.now() - startTime

      expect(result.processingTime).toBeGreaterThan(0)
      expect(duration).toBeLessThan(5000) // Should complete in under 5s (with mocks)
    })
  })
})

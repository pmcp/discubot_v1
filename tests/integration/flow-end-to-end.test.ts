/**
 * Integration Tests - Flow End-to-End Processing
 *
 * Tests the complete flow architecture with multi-input/multi-output and domain routing.
 *
 * **What we test:**
 * 1. Flow creation with multiple inputs (Slack + Figma)
 * 2. Flow configuration with multiple outputs with domain filters
 * 3. Domain routing - tasks routed to correct outputs based on AI domain detection
 * 4. User mappings scoped by workspace ID
 * 5. Default output fallback for null domains
 * 6. Tasks created in correct outputs
 *
 * **What we mock:**
 * - External APIs only (Anthropic, Notion, Slack API calls)
 * - NOT internal components (processor, domain router)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  ParsedDiscussion,
  DiscussionThread,
  ThreadMessage,
  Flow,
  FlowInput,
  FlowOutput
} from '../../layers/discubot/types'

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

const createMockFlow = (overrides: Partial<Flow> = {}): Flow => ({
  id: 'flow_test_123',
  teamId: 'T123456',
  name: 'Test Multi-Domain Flow',
  description: 'Flow for testing domain routing',
  availableDomains: ['design', 'frontend', 'backend', 'product'],
  aiEnabled: true,
  anthropicApiKey: 'test-api-key',
  aiSummaryPrompt: undefined,
  aiTaskPrompt: undefined,
  onboardingComplete: true,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createMockFlowInput = (overrides: Partial<FlowInput> = {}): FlowInput => ({
  id: 'flowinput_slack_123',
  flowId: 'flow_test_123',
  sourceType: 'slack',
  name: 'Slack Workspace',
  apiToken: 'xoxb-test-token-123',
  webhookUrl: 'https://example.com/webhooks/slack',
  webhookSecret: 'test-secret',
  sourceMetadata: {
    slackTeamId: 'T123456',
    workspaceName: 'Test Workspace',
  },
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createMockFlowOutput = (overrides: Partial<FlowOutput> = {}): FlowOutput => ({
  id: 'flowoutput_notion_design',
  flowId: 'flow_test_123',
  outputType: 'notion',
  name: 'Design Tasks',
  domainFilter: ['design'],
  isDefault: false,
  outputConfig: {
    notionToken: 'notion_token_design',
    databaseId: 'database_design_123',
    fieldMapping: {
      Priority: 'priority',
      Type: 'type',
      Assignee: 'assignee',
    },
  },
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

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

// ============================================================================
// MOCKS
// ============================================================================

const mockAnthropicCreate = vi.fn()
const mockNotionPagesCreate = vi.fn()
const mockSlackFetch = vi.fn()
const mockCreateDiscussion = vi.fn()
const mockUpdateDiscussion = vi.fn()
const mockCreateJob = vi.fn()
const mockUpdateJob = vi.fn()
const mockCreateTask = vi.fn()
const mockGetFlows = vi.fn()
const mockGetFlowInputs = vi.fn()
const mockGetFlowOutputs = vi.fn()
const mockGetUserMappings = vi.fn()

// Mock Crouton database queries for discussions
vi.mock('#layers/discubot/collections/discussions/server/database/queries', () => ({
  createDiscubotDiscussion: mockCreateDiscussion,
  updateDiscubotDiscussion: mockUpdateDiscussion,
  getDiscubotDiscussionsByIds: vi.fn(),
}))

// Mock Crouton database queries for jobs
vi.mock('#layers/discubot/collections/jobs/server/database/queries', () => ({
  createDiscubotJob: mockCreateJob,
  updateDiscubotJob: mockUpdateJob,
  getDiscubotJobsByIds: vi.fn(),
}))

// Mock Crouton database queries for tasks
vi.mock('#layers/discubot/collections/tasks/server/database/queries', () => ({
  createDiscubotTask: mockCreateTask,
  getDiscubotTasksByIds: vi.fn(),
}))

// Mock Crouton database queries for flows
vi.mock('#layers/discubot/collections/flows/server/database/queries', () => ({
  getDiscubotFlows: mockGetFlows,
  getDiscubotFlowsByIds: vi.fn(),
}))

// Mock Crouton database queries for flow inputs
vi.mock('#layers/discubot/collections/flowinputs/server/database/queries', () => ({
  getDiscubotFlowinputs: mockGetFlowInputs,
  getDiscubotFlowinputsByIds: vi.fn(),
}))

// Mock Crouton database queries for flow outputs
vi.mock('#layers/discubot/collections/flowoutputs/server/database/queries', () => ({
  getDiscubotFlowoutputs: mockGetFlowOutputs,
  getDiscubotFlowoutputsByIds: vi.fn(),
}))

// Mock Crouton database queries for user mappings
vi.mock('#layers/discubot/collections/usermappings/server/database/queries', () => ({
  getDiscubotUsermappings: mockGetUserMappings,
  getDiscubotUsermappingsByIds: vi.fn(),
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
      databases = {
        retrieve: vi.fn().mockResolvedValue({
          properties: {
            Priority: { type: 'select' },
            Type: { type: 'select' },
            Assignee: { type: 'people' },
          },
        }),
      }
    },
  }
})

// Mock global fetch for Slack API
global.fetch = mockSlackFetch as any

// ============================================================================
// TESTS
// ============================================================================

describe('Flow End-to-End Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up default Crouton database mock responses
    mockCreateDiscussion.mockResolvedValue({
      id: 'discussion_123',
      sourceType: 'slack',
      sourceThreadId: 'C123456:1234567890.123456',
      teamId: 'T123456',
      status: 'processing',
      flowId: 'flow_test_123',
      inputId: 'flowinput_slack_123',
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
      flowId: 'flow_test_123',
      inputId: 'flowinput_slack_123',
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

    // Set up default Anthropic mock response (design domain)
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'Team discussed UI redesign',
            keyPoints: ['New color scheme', 'Updated components'],
            domain: 'design',
            actionItems: ['Create mockups', 'Update style guide'],
            detectedTasks: [
              {
                title: 'Redesign dashboard UI',
                description: 'Update dashboard with new design system',
                priority: 'high',
                domain: 'design',
              },
            ],
            isMultiTask: false,
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
            ],
            has_more: false,
          }),
        })
      }

      // Default for other endpoints
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567892.123456',
        }),
      })
    })

    // Set up default flow queries
    mockGetFlows.mockResolvedValue([createMockFlow()])
    mockGetFlowInputs.mockResolvedValue([createMockFlowInput()])
    mockGetFlowOutputs.mockResolvedValue([
      createMockFlowOutput({
        id: 'flowoutput_design',
        name: 'Design Tasks',
        domainFilter: ['design'],
        isDefault: false,
        outputConfig: {
          notionToken: 'notion_token_design',
          databaseId: 'database_design_123',
        },
      }),
      createMockFlowOutput({
        id: 'flowoutput_default',
        name: 'All Tasks',
        domainFilter: [],
        isDefault: true,
        outputConfig: {
          notionToken: 'notion_token_default',
          databaseId: 'database_default_123',
        },
      }),
    ])

    // Set up default user mappings
    mockGetUserMappings.mockResolvedValue([
      {
        id: 'usermapping_123',
        sourceType: 'slack',
        sourceWorkspaceId: 'T123456',
        sourceUserId: 'U123456',
        sourceUserEmail: 'user@example.com',
        notionUserId: 'notion-user-id-123',
        teamId: 'T123456',
      },
    ])
  })

  describe('Flow with Multiple Inputs', () => {
    it('should process Slack input through flow', async () => {
      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Design Discussion',
        content: 'We need to redesign the dashboard',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
        metadata: {
          channelId: 'C123456',
          messageTs: '1234567890.123456',
        },
      }

      const thread = createMockThread()

      const result = await processDiscussion(parsed, { thread })

      // Verify flow was loaded
      expect(mockGetFlows).toHaveBeenCalled()
      expect(mockGetFlowInputs).toHaveBeenCalled()
      expect(mockGetFlowOutputs).toHaveBeenCalled()

      // Verify processing completed
      expect(result).toHaveProperty('discussionId')
      expect(result).toHaveProperty('aiAnalysis')
      expect(result).toHaveProperty('notionTasks')
    })

    it('should process Figma email input through flow', async () => {
      // Mock flow with Figma input
      mockGetFlowInputs.mockResolvedValue([
        createMockFlowInput({
          id: 'flowinput_figma_123',
          sourceType: 'figma',
          emailSlug: 'figma-design',
          emailAddress: 'figma-design@example.com',
          sourceMetadata: {
            emailSlug: 'figma-design',
          },
        }),
      ])

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'figma',
        sourceThreadId: 'figma-file-123:comment-456',
        sourceUrl: 'https://figma.com/file/123?comment=456',
        teamId: 'T123456',
        authorHandle: 'user@example.com',
        title: 'Design Feedback',
        content: 'Please update the color scheme',
        participants: ['user@example.com'],
        timestamp: new Date(),
        metadata: {
          emailSlug: 'figma-design',
        },
      }

      const thread = createMockThread({
        id: 'figma-file-123:comment-456',
        rootMessage: {
          id: 'comment-456',
          authorHandle: 'user@example.com',
          content: 'Please update the color scheme',
          timestamp: new Date(),
        },
      })

      const result = await processDiscussion(parsed, { thread })

      expect(result).toHaveProperty('discussionId')
      expect(mockGetFlows).toHaveBeenCalled()
    })
  })

  describe('Domain Routing', () => {
    it('should route design tasks to design output', async () => {
      // AI returns design domain
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Team discussed UI redesign',
              domain: 'design',
              detectedTasks: [
                {
                  title: 'Redesign dashboard',
                  description: 'Update UI with new design',
                  priority: 'high',
                  domain: 'design',
                },
              ],
              isMultiTask: false,
              confidence: 0.9,
            }),
          },
        ],
      })

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Design task',
        content: 'Redesign the dashboard',
        participants: ['U123456'],
        timestamp: new Date(),
        metadata: {},
      }

      const thread = createMockThread()

      await processDiscussion(parsed, { thread })

      // Verify Notion was called with design database
      expect(mockNotionPagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: expect.objectContaining({
            database_id: 'database_design_123',
          }),
        })
      )
    })

    it('should route frontend tasks to frontend output', async () => {
      // Mock frontend output
      mockGetFlowOutputs.mockResolvedValue([
        createMockFlowOutput({
          id: 'flowoutput_frontend',
          name: 'Frontend Tasks',
          domainFilter: ['frontend'],
          isDefault: false,
          outputConfig: {
            notionToken: 'notion_token_frontend',
            databaseId: 'database_frontend_123',
          },
        }),
        createMockFlowOutput({
          id: 'flowoutput_default',
          name: 'All Tasks',
          domainFilter: [],
          isDefault: true,
          outputConfig: {
            notionToken: 'notion_token_default',
            databaseId: 'database_default_123',
          },
        }),
      ])

      // AI returns frontend domain
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Team discussed React component',
              domain: 'frontend',
              detectedTasks: [
                {
                  title: 'Build new component',
                  description: 'Create React component',
                  priority: 'high',
                  domain: 'frontend',
                },
              ],
              isMultiTask: false,
              confidence: 0.9,
            }),
          },
        ],
      })

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Frontend task',
        content: 'Build a new React component',
        participants: ['U123456'],
        timestamp: new Date(),
        metadata: {},
      }

      const thread = createMockThread()

      await processDiscussion(parsed, { thread })

      // Verify Notion was called with frontend database
      expect(mockNotionPagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: expect.objectContaining({
            database_id: 'database_frontend_123',
          }),
        })
      )
    })

    it('should route tasks with null domain to default output', async () => {
      // AI returns null domain (uncertain)
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'General discussion',
              domain: null,
              detectedTasks: [
                {
                  title: 'General task',
                  description: 'Task with no clear domain',
                  priority: 'medium',
                  domain: null,
                },
              ],
              isMultiTask: false,
              confidence: 0.7,
            }),
          },
        ],
      })

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'General discussion',
        content: 'Lets discuss this',
        participants: ['U123456'],
        timestamp: new Date(),
        metadata: {},
      }

      const thread = createMockThread()

      await processDiscussion(parsed, { thread })

      // Verify Notion was called with default database
      expect(mockNotionPagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: expect.objectContaining({
            database_id: 'database_default_123',
          }),
        })
      )
    })

    it('should create tasks in multiple outputs when domain matches multiple filters', async () => {
      // Mock two outputs with overlapping domains
      mockGetFlowOutputs.mockResolvedValue([
        createMockFlowOutput({
          id: 'flowoutput_design_primary',
          name: 'Design Tasks Primary',
          domainFilter: ['design', 'product'],
          isDefault: false,
          outputConfig: {
            notionToken: 'notion_token_design1',
            databaseId: 'database_design1_123',
          },
        }),
        createMockFlowOutput({
          id: 'flowoutput_design_secondary',
          name: 'Design Tasks Secondary',
          domainFilter: ['design', 'frontend'],
          isDefault: false,
          outputConfig: {
            notionToken: 'notion_token_design2',
            databaseId: 'database_design2_123',
          },
        }),
        createMockFlowOutput({
          id: 'flowoutput_default',
          name: 'All Tasks',
          domainFilter: [],
          isDefault: true,
          outputConfig: {
            notionToken: 'notion_token_default',
            databaseId: 'database_default_123',
          },
        }),
      ])

      // AI returns design domain
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Design discussion',
              domain: 'design',
              detectedTasks: [
                {
                  title: 'Design task',
                  description: 'Update design',
                  priority: 'high',
                  domain: 'design',
                },
              ],
              isMultiTask: false,
              confidence: 0.9,
            }),
          },
        ],
      })

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Design task',
        content: 'Update the design',
        participants: ['U123456'],
        timestamp: new Date(),
        metadata: {},
      }

      const thread = createMockThread()

      await processDiscussion(parsed, { thread })

      // Verify Notion was called twice (once for each matching output)
      expect(mockNotionPagesCreate).toHaveBeenCalledTimes(2)

      // Verify both databases were used
      const calls = mockNotionPagesCreate.mock.calls
      const databaseIds = calls.map((call: any) => call[0].parent.database_id)
      expect(databaseIds).toContain('database_design1_123')
      expect(databaseIds).toContain('database_design2_123')
    })
  })

  describe('User Mappings with Workspace Scoping', () => {
    it('should resolve user mappings with correct workspace ID', async () => {
      // Mock user mappings with workspace scoping
      mockGetUserMappings.mockResolvedValue([
        {
          id: 'usermapping_workspace1',
          sourceType: 'slack',
          sourceWorkspaceId: 'T123456',
          sourceUserId: 'U123456',
          sourceUserEmail: 'user1@workspace1.com',
          notionUserId: 'notion-user-workspace1',
          teamId: 'T123456',
        },
        {
          id: 'usermapping_workspace2',
          sourceType: 'slack',
          sourceWorkspaceId: 'T999999',  // Different workspace
          sourceUserId: 'U123456',  // Same user ID, different workspace
          sourceUserEmail: 'user1@workspace2.com',
          notionUserId: 'notion-user-workspace2',
          teamId: 'T123456',
        },
      ])

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Test',
        content: 'Test content',
        participants: ['U123456'],
        timestamp: new Date(),
        metadata: {
          channelId: 'C123456',
        },
      }

      const thread = createMockThread()

      await processDiscussion(parsed, { thread })

      // Verify user mappings were queried with workspace filter
      expect(mockGetUserMappings).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceType: 'slack',
            sourceWorkspaceId: 'T123456',  // Should filter by correct workspace
          }),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should throw error if no default output configured', async () => {
      // Mock flow outputs without default
      mockGetFlowOutputs.mockResolvedValue([
        createMockFlowOutput({
          id: 'flowoutput_design',
          name: 'Design Tasks',
          domainFilter: ['design'],
          isDefault: false,
        }),
      ])

      // AI returns null domain (needs default)
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'General discussion',
              domain: null,
              detectedTasks: [
                {
                  title: 'General task',
                  description: 'Task with no domain',
                  priority: 'medium',
                  domain: null,
                },
              ],
              isMultiTask: false,
              confidence: 0.7,
            }),
          },
        ],
      })

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Test',
        content: 'Test',
        participants: ['U123456'],
        timestamp: new Date(),
        metadata: {},
      }

      const thread = createMockThread()

      await expect(processDiscussion(parsed, { thread })).rejects.toThrow()
    })

    it('should handle output-specific errors gracefully', async () => {
      // Mock one successful and one failing output
      mockNotionPagesCreate
        .mockResolvedValueOnce({
          id: 'notion-page-1',
          url: 'https://notion.so/page-1',
        })
        .mockRejectedValueOnce(new Error('Notion API error'))

      // Mock two outputs that both match
      mockGetFlowOutputs.mockResolvedValue([
        createMockFlowOutput({
          id: 'flowoutput_design1',
          name: 'Design Tasks 1',
          domainFilter: ['design'],
          isDefault: false,
          outputConfig: {
            notionToken: 'notion_token_1',
            databaseId: 'database_1',
          },
        }),
        createMockFlowOutput({
          id: 'flowoutput_design2',
          name: 'Design Tasks 2',
          domainFilter: ['design'],
          isDefault: false,
          outputConfig: {
            notionToken: 'notion_token_2',
            databaseId: 'database_2',
          },
        }),
      ])

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Design task',
        content: 'Test',
        participants: ['U123456'],
        timestamp: new Date(),
        metadata: {},
      }

      const thread = createMockThread()

      // Should not throw - should handle partial failures
      const result = await processDiscussion(parsed, { thread })

      // Should still have processed successfully for the working output
      expect(result).toHaveProperty('discussionId')
      expect(mockNotionPagesCreate).toHaveBeenCalledTimes(2)
    })
  })

  describe('Backward Compatibility', () => {
    it('should fallback to legacy config if no flow found', async () => {
      // Mock no flows found
      mockGetFlows.mockResolvedValue([])

      // Import the legacy config mock
      const { getDiscubotConfigs } = await import('#layers/discubot/collections/configs/server/database/queries')
      const mockGetConfigs = getDiscubotConfigs as any

      // Mock legacy config query
      vi.mocked(mockGetConfigs).mockResolvedValue([
        {
          id: 'config_legacy_123',
          teamId: 'T123456',
          sourceType: 'slack',
          name: 'Legacy Config',
          apiToken: 'xoxb-test-token',
          notionToken: 'notion_token',
          notionDatabaseId: 'database_123',
          aiEnabled: true,
          autoSync: true,
          settings: {
            workspaceId: 'T123456',
          },
          active: true,
        },
      ])

      const { processDiscussion } = await import('../../layers/discubot/server/services/processor')

      const parsed: ParsedDiscussion = {
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'Test',
        content: 'Test content',
        participants: ['U123456'],
        timestamp: new Date(),
        metadata: {},
      }

      const thread = createMockThread()

      const result = await processDiscussion(parsed, { thread })

      // Should process successfully with legacy config
      expect(result).toHaveProperty('discussionId')
    })
  })
})

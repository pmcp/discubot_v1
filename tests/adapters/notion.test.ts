/**
 * Tests for Notion Adapter
 *
 * Tests all adapter interface methods:
 * - parseIncoming()
 * - fetchThread()
 * - postReply()
 * - updateStatus()
 * - validateConfig()
 * - testConnection()
 *
 * Also tests helper functions:
 * - checkForTrigger()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  NotionAdapter,
  checkForTrigger,
  DEFAULT_TRIGGER_KEYWORD,
} from '../../layers/discubot/server/adapters/notion'
import { AdapterError } from '../../layers/discubot/server/adapters/base'
import type { SourceConfig } from '../../layers/discubot/types'

// Mock $fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

// Mock logger to suppress console output during tests
vi.mock('../../layers/discubot/server/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('NotionAdapter', () => {
  let adapter: NotionAdapter

  beforeEach(() => {
    adapter = new NotionAdapter()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // checkForTrigger() Tests
  // ============================================================================

  describe('checkForTrigger()', () => {
    it('should find trigger in plain text', () => {
      const richText = [{ type: 'text', plain_text: 'Hey @discubot please create a task' }]
      expect(checkForTrigger(richText)).toBe(true)
    })

    it('should find trigger with different casing (case insensitive)', () => {
      const richTextUpper = [{ type: 'text', plain_text: 'Hey @DISCUBOT please help' }]
      expect(checkForTrigger(richTextUpper)).toBe(true)

      const richTextMixed = [{ type: 'text', plain_text: 'Hey @DiScUbOt please help' }]
      expect(checkForTrigger(richTextMixed)).toBe(true)
    })

    it('should not find trigger when not present', () => {
      const richText = [{ type: 'text', plain_text: 'This is a regular comment' }]
      expect(checkForTrigger(richText)).toBe(false)
    })

    it('should handle empty rich_text array', () => {
      expect(checkForTrigger([])).toBe(false)
    })

    it('should handle null or undefined rich_text', () => {
      expect(checkForTrigger(null as any)).toBe(false)
      expect(checkForTrigger(undefined as any)).toBe(false)
    })

    it('should find trigger with custom keyword', () => {
      const richText = [{ type: 'text', plain_text: 'Hey #todo create a task' }]
      expect(checkForTrigger(richText, '#todo')).toBe(true)
    })

    it('should find trigger with custom keyword case insensitive', () => {
      const richText = [{ type: 'text', plain_text: 'Hey #TODO create a task' }]
      expect(checkForTrigger(richText, '#todo')).toBe(true)
    })

    it('should combine multiple rich text elements', () => {
      const richText = [
        { type: 'text', plain_text: 'Hey ' },
        { type: 'text', plain_text: '@discubot' },
        { type: 'text', plain_text: ' please help' },
      ]
      expect(checkForTrigger(richText)).toBe(true)
    })

    it('should handle special characters in trigger keyword', () => {
      const richText = [{ type: 'text', plain_text: 'Check @discubot for updates' }]
      expect(checkForTrigger(richText, '@discubot')).toBe(true)
    })

    it('should use default trigger keyword when not specified', () => {
      const richText = [{ type: 'text', plain_text: `Testing ${DEFAULT_TRIGGER_KEYWORD} here` }]
      expect(checkForTrigger(richText)).toBe(true)
    })
  })

  // ============================================================================
  // parseIncoming() Tests
  // ============================================================================

  describe('parseIncoming()', () => {
    it('should parse valid webhook payload', async () => {
      const payload = {
        type: 'comment.created',
        data: {
          id: 'comment-123',
          parent: {
            type: 'page_id',
            page_id: 'page-456',
          },
          discussion_id: 'discussion-789',
        },
        entity: {
          id: 'page-456',
          type: 'page',
        },
        timestamp: '2024-01-15T10:30:00Z',
        workspace_id: 'workspace-abc',
      }

      // Mock fetchComment to return comment content
      mockFetch.mockResolvedValueOnce({
        id: 'comment-123',
        parent: { type: 'page_id', page_id: 'page-456' },
        discussion_id: 'discussion-789',
        rich_text: [{ type: 'text', plain_text: 'This is a test comment' }],
        created_time: '2024-01-15T10:30:00Z',
        created_by: { id: 'user-001', object: 'user' },
      })

      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'notion',
        name: 'Test Notion',
        apiToken: 'secret_test_token',
        notionToken: 'secret_test_token',
        notionDatabaseId: 'db_test',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.parseIncoming(payload, config)

      expect(result).toMatchObject({
        sourceType: 'notion',
        sourceThreadId: 'page-456:discussion-789',
        teamId: 'workspace-abc',
        authorHandle: 'user-001',
        content: 'This is a test comment',
      })
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.metadata.commentId).toBe('comment-123')
      expect(result.metadata.discussionId).toBe('discussion-789')
      expect(result.metadata.parentId).toBe('page-456')
      expect(result.metadata.parentType).toBe('page_id')
    })

    it('should parse payload with block_id parent type', async () => {
      const payload = {
        type: 'comment.created',
        data: {
          id: 'comment-123',
          parent: {
            type: 'block_id',
            block_id: 'block-456',
          },
          discussion_id: 'discussion-789',
        },
        entity: {
          id: 'block-456',
          type: 'block',
        },
        timestamp: '2024-01-15T10:30:00Z',
        workspace_id: 'workspace-abc',
      }

      mockFetch.mockResolvedValueOnce({
        id: 'comment-123',
        parent: { type: 'block_id', block_id: 'block-456' },
        discussion_id: 'discussion-789',
        rich_text: [{ type: 'text', plain_text: 'Block comment' }],
        created_time: '2024-01-15T10:30:00Z',
        created_by: { id: 'user-002', object: 'user' },
      })

      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'notion',
        name: 'Test Notion',
        apiToken: 'secret_test_token',
        notionToken: 'secret_test_token',
        notionDatabaseId: 'db_test',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.parseIncoming(payload, config)

      expect(result.sourceThreadId).toBe('block-456:discussion-789')
      expect(result.metadata.parentType).toBe('block_id')
    })

    it('should throw error for missing comment ID', async () => {
      const payload = {
        type: 'comment.created',
        data: {
          id: '',
          parent: {
            type: 'page_id',
            page_id: 'page-456',
          },
          discussion_id: 'discussion-789',
        },
        entity: { id: 'page-456', type: 'page' },
        timestamp: '2024-01-15T10:30:00Z',
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('Missing required IDs')
    })

    it('should throw error for missing discussion ID', async () => {
      const payload = {
        type: 'comment.created',
        data: {
          id: 'comment-123',
          parent: {
            type: 'page_id',
            page_id: 'page-456',
          },
          discussion_id: '',
        },
        entity: { id: 'page-456', type: 'page' },
        timestamp: '2024-01-15T10:30:00Z',
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('Missing required IDs')
    })

    it('should throw error for missing parent ID', async () => {
      const payload = {
        type: 'comment.created',
        data: {
          id: 'comment-123',
          parent: {
            type: 'page_id',
          },
          discussion_id: 'discussion-789',
        },
        entity: { id: 'page-456', type: 'page' },
        timestamp: '2024-01-15T10:30:00Z',
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('Missing required IDs')
    })

    it('should throw error for unsupported event type', async () => {
      const payload = {
        type: 'comment.deleted',
        data: {
          id: 'comment-123',
          parent: { type: 'page_id', page_id: 'page-456' },
          discussion_id: 'discussion-789',
        },
        entity: { id: 'page-456', type: 'page' },
        timestamp: '2024-01-15T10:30:00Z',
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('Unsupported event type')
    })

    it('should fallback to "default" team ID if workspace_id is missing', async () => {
      const payload = {
        type: 'comment.created',
        data: {
          id: 'comment-123',
          parent: { type: 'page_id', page_id: 'page-456' },
          discussion_id: 'discussion-789',
        },
        entity: { id: 'page-456', type: 'page' },
        timestamp: '2024-01-15T10:30:00Z',
        // No workspace_id
      }

      const result = await adapter.parseIncoming(payload)

      expect(result.teamId).toBe('default')
    })

    it('should work without config (no API token)', async () => {
      const payload = {
        type: 'comment.created',
        data: {
          id: 'comment-123',
          parent: { type: 'page_id', page_id: 'page-456' },
          discussion_id: 'discussion-789',
        },
        entity: { id: 'page-456', type: 'page' },
        timestamp: '2024-01-15T10:30:00Z',
        workspace_id: 'workspace-abc',
      }

      const result = await adapter.parseIncoming(payload)

      // Should work but with empty content (no API token to fetch comment)
      expect(result.sourceThreadId).toBe('page-456:discussion-789')
      expect(result.content).toBe('')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // fetchThread() Tests
  // ============================================================================

  describe('fetchThread()', () => {
    const mockConfig: SourceConfig = {
      id: 'config_1',
      teamId: 'team_123',
      sourceType: 'notion',
      name: 'Test Notion',
      apiToken: 'secret_test_token',
      notionToken: 'secret_test_token',
      notionDatabaseId: 'db_test',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should fetch thread with valid thread ID format', async () => {
      mockFetch.mockResolvedValueOnce({
        object: 'list',
        results: [
          {
            id: 'comment-1',
            parent: { type: 'page_id', page_id: 'page-456' },
            discussion_id: 'discussion-789',
            rich_text: [{ type: 'text', plain_text: 'Root comment' }],
            created_time: '2024-01-15T10:00:00Z',
            created_by: { id: 'user-001', object: 'user' },
          },
          {
            id: 'comment-2',
            parent: { type: 'page_id', page_id: 'page-456' },
            discussion_id: 'discussion-789',
            rich_text: [{ type: 'text', plain_text: 'Reply comment' }],
            created_time: '2024-01-15T10:05:00Z',
            created_by: { id: 'user-002', object: 'user' },
          },
        ],
        has_more: false,
        next_cursor: null,
      })

      const result = await adapter.fetchThread('page-456:discussion-789', mockConfig)

      expect(result.id).toBe('discussion-789')
      expect(result.rootMessage.content).toBe('Root comment')
      expect(result.rootMessage.authorHandle).toBe('user-001')
      expect(result.replies).toHaveLength(1)
      expect(result.replies[0].content).toBe('Reply comment')
      expect(result.participants).toContain('user-001')
      expect(result.participants).toContain('user-002')
      expect(result.metadata.pageId).toBe('page-456')
      expect(result.metadata.discussionId).toBe('discussion-789')
    })

    it('should throw error for invalid thread ID format (missing colon)', async () => {
      await expect(adapter.fetchThread('invalid-format', mockConfig)).rejects.toThrow(AdapterError)
      await expect(adapter.fetchThread('invalid-format', mockConfig)).rejects.toThrow(
        'Invalid thread ID format'
      )
    })

    it('should throw error for invalid thread ID format (empty parts)', async () => {
      await expect(adapter.fetchThread('page-456:', mockConfig)).rejects.toThrow(AdapterError)
      await expect(adapter.fetchThread(':discussion-789', mockConfig)).rejects.toThrow(AdapterError)
    })

    it('should throw error for empty thread (no comments found)', async () => {
      mockFetch.mockResolvedValueOnce({
        object: 'list',
        results: [],
        has_more: false,
        next_cursor: null,
      })

      try {
        await adapter.fetchThread('page-456:discussion-789', mockConfig)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError)
        expect((error as AdapterError).message).toContain('No comments found')
      }
    })

    it('should handle pagination for large threads', async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        object: 'list',
        results: [
          {
            id: 'comment-1',
            parent: { type: 'page_id', page_id: 'page-456' },
            discussion_id: 'discussion-789',
            rich_text: [{ type: 'text', plain_text: 'First comment' }],
            created_time: '2024-01-15T10:00:00Z',
            created_by: { id: 'user-001', object: 'user' },
          },
        ],
        has_more: true,
        next_cursor: 'cursor-abc',
      })

      // Second page
      mockFetch.mockResolvedValueOnce({
        object: 'list',
        results: [
          {
            id: 'comment-2',
            parent: { type: 'page_id', page_id: 'page-456' },
            discussion_id: 'discussion-789',
            rich_text: [{ type: 'text', plain_text: 'Second comment' }],
            created_time: '2024-01-15T10:05:00Z',
            created_by: { id: 'user-002', object: 'user' },
          },
        ],
        has_more: false,
        next_cursor: null,
      })

      const result = await adapter.fetchThread('page-456:discussion-789', mockConfig)

      expect(result.rootMessage.content).toBe('First comment')
      expect(result.replies).toHaveLength(1)
      expect(result.replies[0].content).toBe('Second comment')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should filter comments by discussion_id', async () => {
      mockFetch.mockResolvedValueOnce({
        object: 'list',
        results: [
          {
            id: 'comment-1',
            parent: { type: 'page_id', page_id: 'page-456' },
            discussion_id: 'discussion-789',
            rich_text: [{ type: 'text', plain_text: 'Target discussion' }],
            created_time: '2024-01-15T10:00:00Z',
            created_by: { id: 'user-001', object: 'user' },
          },
          {
            id: 'comment-2',
            parent: { type: 'page_id', page_id: 'page-456' },
            discussion_id: 'other-discussion',
            rich_text: [{ type: 'text', plain_text: 'Other discussion' }],
            created_time: '2024-01-15T10:05:00Z',
            created_by: { id: 'user-002', object: 'user' },
          },
        ],
        has_more: false,
        next_cursor: null,
      })

      const result = await adapter.fetchThread('page-456:discussion-789', mockConfig)

      expect(result.rootMessage.content).toBe('Target discussion')
      expect(result.replies).toHaveLength(0)
    })

    it('should sort comments by creation time', async () => {
      mockFetch.mockResolvedValueOnce({
        object: 'list',
        results: [
          {
            id: 'comment-2',
            parent: { type: 'page_id', page_id: 'page-456' },
            discussion_id: 'discussion-789',
            rich_text: [{ type: 'text', plain_text: 'Later comment' }],
            created_time: '2024-01-15T10:05:00Z',
            created_by: { id: 'user-002', object: 'user' },
          },
          {
            id: 'comment-1',
            parent: { type: 'page_id', page_id: 'page-456' },
            discussion_id: 'discussion-789',
            rich_text: [{ type: 'text', plain_text: 'Earlier comment' }],
            created_time: '2024-01-15T10:00:00Z',
            created_by: { id: 'user-001', object: 'user' },
          },
        ],
        has_more: false,
        next_cursor: null,
      })

      const result = await adapter.fetchThread('page-456:discussion-789', mockConfig)

      // Earlier comment should be root (oldest first)
      expect(result.rootMessage.content).toBe('Earlier comment')
      expect(result.replies[0].content).toBe('Later comment')
    })
  })

  // ============================================================================
  // postReply() Tests
  // ============================================================================

  describe('postReply()', () => {
    const mockConfig: SourceConfig = {
      id: 'config_1',
      teamId: 'team_123',
      sourceType: 'notion',
      name: 'Test Notion',
      apiToken: 'secret_test_token',
      notionToken: 'secret_test_token',
      notionDatabaseId: 'db_test',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should post reply successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        id: 'new-comment-123',
        parent: { type: 'page_id', page_id: 'page-456' },
        discussion_id: 'discussion-789',
        rich_text: [{ type: 'text', text: { content: 'Task created!' } }],
        created_time: '2024-01-15T10:30:00Z',
        created_by: { id: 'bot-001', object: 'user' },
      })

      const result = await adapter.postReply('page-456:discussion-789', 'Task created!', mockConfig)

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notion.com/v1/comments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer secret_test_token',
            'Notion-Version': '2022-06-28',
          }),
          body: expect.objectContaining({
            discussion_id: 'discussion-789',
            rich_text: [{ type: 'text', text: { content: 'Task created!' } }],
          }),
        })
      )
    })

    it('should return false for API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await adapter.postReply('page-456:discussion-789', 'Test message', mockConfig)

      expect(result).toBe(false)
    })

    it('should return false for missing discussion ID', async () => {
      const result = await adapter.postReply('page-456', 'Test message', mockConfig)

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return false when API returns null', async () => {
      mockFetch.mockResolvedValueOnce(null)

      const result = await adapter.postReply('page-456:discussion-789', 'Test message', mockConfig)

      expect(result).toBe(false)
    })
  })

  // ============================================================================
  // validateConfig() Tests
  // ============================================================================

  describe('validateConfig()', () => {
    it('should validate valid config with all fields', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'notion',
        name: 'Test Notion',
        apiToken: 'secret_test_token_123',
        notionToken: 'secret_test_token_123',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate config with ntn_ token prefix', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'notion',
        name: 'Test Notion',
        apiToken: 'ntn_test_token_123',
        notionToken: 'ntn_test_token_123',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should error for missing token', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'notion',
        name: 'Test Notion',
        apiToken: '',
        notionToken: '',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion API token is required')
    })

    it('should warn for invalid token format (not starting with secret_ or ntn_)', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'notion',
        name: 'Test Notion',
        apiToken: 'invalid_token_format',
        notionToken: 'invalid_token_format',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true) // Still valid, just warning
      expect(result.warnings).toContain(
        'Notion API token should start with "secret_" or "ntn_" (internal integration token format)'
      )
    })

    it('should error for source type mismatch', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'slack',
        name: 'Test Notion',
        apiToken: 'secret_test_token',
        notionToken: 'secret_test_token',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Source type mismatch: expected 'notion', got 'slack'")
    })

    it('should use notionToken when apiToken is empty', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'notion',
        name: 'Test Notion',
        apiToken: '',
        notionToken: 'secret_test_token_123',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true)
    })
  })

  // ============================================================================
  // testConnection() Tests
  // ============================================================================

  describe('testConnection()', () => {
    const mockConfig: SourceConfig = {
      id: 'config_1',
      teamId: 'team_123',
      sourceType: 'notion',
      name: 'Test Notion',
      apiToken: 'secret_test_token',
      notionToken: 'secret_test_token',
      notionDatabaseId: 'db_test_123',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should return true for successful connection', async () => {
      mockFetch.mockResolvedValueOnce({
        object: 'user',
        id: 'bot-001',
        type: 'bot',
        name: 'Test Bot',
        avatar_url: null,
      })

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notion.com/v1/users/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer secret_test_token',
            'Notion-Version': '2022-06-28',
          }),
        })
      )
    })

    it('should return false for invalid token', async () => {
      mockFetch.mockRejectedValueOnce({
        statusCode: 401,
        message: 'Unauthorized',
      })

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })

    it('should return false for network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })

    it('should return false when response is not a user object', async () => {
      mockFetch.mockResolvedValueOnce({
        object: 'error',
        status: 400,
        code: 'invalid_request',
        message: 'Invalid request',
      })

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })

    it('should return false when no token provided', async () => {
      const configWithoutToken: SourceConfig = {
        ...mockConfig,
        apiToken: '',
        notionToken: '',
      }

      const result = await adapter.testConnection(configWithoutToken)

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should use notionToken when apiToken is empty', async () => {
      const configWithNotionToken: SourceConfig = {
        ...mockConfig,
        apiToken: '',
        notionToken: 'ntn_test_token',
      }

      mockFetch.mockResolvedValueOnce({
        object: 'user',
        id: 'bot-001',
        type: 'bot',
        name: 'Test Bot',
      })

      const result = await adapter.testConnection(configWithNotionToken)

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notion.com/v1/users/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer ntn_test_token',
          }),
        })
      )
    })
  })

  // ============================================================================
  // updateStatus() Tests
  // ============================================================================

  describe('updateStatus()', () => {
    const mockConfig: SourceConfig = {
      id: 'config_1',
      teamId: 'team_123',
      sourceType: 'notion',
      name: 'Test Notion',
      apiToken: 'secret_test_token',
      notionToken: 'secret_test_token',
      notionDatabaseId: 'db_test_123',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should return true (no-op)', async () => {
      const result = await adapter.updateStatus('page-456:discussion-789', 'completed', mockConfig)

      expect(result).toBe(true)
      // Should NOT call any API (it's a no-op)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return true for all status types', async () => {
      const statuses = ['pending', 'processing', 'analyzed', 'completed', 'failed', 'retrying']

      for (const status of statuses) {
        const result = await adapter.updateStatus(
          'page-456:discussion-789',
          status as any,
          mockConfig
        )
        expect(result).toBe(true)
      }

      // Should never call API
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // sourceType Tests
  // ============================================================================

  describe('sourceType', () => {
    it('should have correct source type', () => {
      expect(adapter.sourceType).toBe('notion')
    })
  })
})

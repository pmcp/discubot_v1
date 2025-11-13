/**
 * Tests for Figma Adapter
 *
 * Tests all adapter interface methods:
 * - parseIncoming()
 * - fetchThread()
 * - postReply()
 * - updateStatus()
 * - validateConfig()
 * - testConnection()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FigmaAdapter } from '../../layers/discubot/server/adapters/figma'
import type { SourceConfig } from '../../layers/discubot/types'

describe('FigmaAdapter', () => {
  let adapter: FigmaAdapter
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new FigmaAdapter()
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseIncoming', () => {
    it('should parse valid Figma email from Mailgun', async () => {
      const mailgunPayload = {
        subject: 'John commented on Design File',
        from: 'john@example.com',
        recipient: 'team-abc@discubot.example.com',
        'body-html': '<html><body><p>This is a great design!</p><a href="https://www.figma.com/file/abc123def456/Design-File">View in Figma</a></body></html>',
        'stripped-text': 'This is a great design!',
        timestamp: 1699999999,
      }

      const result = await adapter.parseIncoming(mailgunPayload)

      expect(result).toMatchObject({
        sourceType: 'figma',
        sourceThreadId: 'abc123def456',
        teamId: 'team-abc',
        authorHandle: 'john@example.com',
        title: 'John commented on Design File',
        content: 'This is a great design!',
      })
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.metadata.fileKey).toBe('abc123def456')
    })

    it('should extract team ID from recipient email', async () => {
      const payload = {
        subject: 'Comment',
        from: 'user@example.com',
        recipient: 'my-team@discubot.example.com',
        'body-html': '<a href="https://www.figma.com/file/test123/File">Link</a>',
        'stripped-text': 'Test',
        timestamp: 1699999999,
      }

      const result = await adapter.parseIncoming(payload)

      expect(result.teamId).toBe('my-team')
    })

    it('should fallback to "default" team ID if recipient is invalid', async () => {
      const payload = {
        subject: 'Comment',
        from: 'user@example.com',
        recipient: '',
        'body-html': '<a href="https://www.figma.com/file/test123/File">Link</a>',
        'stripped-text': 'Test',
        timestamp: 1699999999,
      }

      const result = await adapter.parseIncoming(payload)

      expect(result.teamId).toBe('default')
    })

    it('should throw error if no file key found', async () => {
      const payload = {
        subject: 'Comment',
        from: 'user@example.com',
        recipient: 'team@discubot.example.com',
        'body-html': '<p>No Figma links here</p>',
        'stripped-text': 'No links',
        timestamp: 1699999999,
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow('No Figma file key found')
    })

    it('should throw error if comment text is empty', async () => {
      const payload = {
        subject: 'Comment',
        from: 'user@example.com',
        recipient: 'team@discubot.example.com',
        'body-html': '<html><body><a href="https://www.figma.com/file/abc123/File"></a></body></html>',
        'stripped-text': '',
        timestamp: 1699999999,
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow('No comment text found')
    })

    it('should extract participants from email', async () => {
      const payload = {
        subject: 'Comment',
        from: 'alice@example.com',
        recipient: 'team@discubot.example.com',
        'body-html': '<a href="https://www.figma.com/file/abc123/File">Link</a>',
        'stripped-text': 'Great work!',
        timestamp: 1699999999,
      }

      const result = await adapter.parseIncoming(payload)

      expect(result.participants).toContain('alice@example.com')
    })
  })

  describe('fetchThread', () => {
    const mockConfig: SourceConfig = {
      id: '1',
      teamId: 'team-abc',
      sourceType: 'figma',
      name: 'Test Config',
      apiToken: 'figd_test_token_1234567890',
      notionToken: 'secret_notion_token',
      notionDatabaseId: 'abc123',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should fetch and build thread from Figma API', async () => {
      const mockComments = {
        comments: [
          {
            id: 'comment-1',
            file_key: 'abc123',
            parent_id: '',
            user: { id: 'user-1', handle: 'alice' },
            created_at: '2024-01-01T10:00:00Z',
            resolved_at: null,
            message: 'Root comment',
            order_id: 1,
          },
          {
            id: 'comment-2',
            file_key: 'abc123',
            parent_id: 'comment-1',
            user: { id: 'user-2', handle: 'bob' },
            created_at: '2024-01-01T10:05:00Z',
            resolved_at: null,
            message: 'Reply to root',
            order_id: 2,
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComments,
      })

      const result = await adapter.fetchThread('abc123:comment-1', mockConfig)

      expect(result.id).toBe('comment-1')
      expect(result.rootMessage.content).toBe('Root comment')
      expect(result.replies).toHaveLength(1)
      expect(result.replies[0].content).toBe('Reply to root')
      expect(result.participants).toContain('alice')
      expect(result.participants).toContain('bob')
    })

    it('should use most recent root comment if no comment ID specified', async () => {
      const mockComments = {
        comments: [
          {
            id: 'comment-1',
            file_key: 'abc123',
            parent_id: '',
            user: { id: 'user-1', handle: 'alice' },
            created_at: '2024-01-01T09:00:00Z',
            resolved_at: null,
            message: 'Older comment',
            order_id: 1,
          },
          {
            id: 'comment-2',
            file_key: 'abc123',
            parent_id: '',
            user: { id: 'user-2', handle: 'bob' },
            created_at: '2024-01-01T10:00:00Z',
            resolved_at: null,
            message: 'Newer comment',
            order_id: 2,
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComments,
      })

      const result = await adapter.fetchThread('abc123', mockConfig)

      expect(result.id).toBe('comment-2')
      expect(result.rootMessage.content).toBe('Newer comment')
    })

    it('should throw error if comment not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      })

      await expect(adapter.fetchThread('abc123:missing', mockConfig)).rejects.toThrow('Comment not found')
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ err: 'Invalid token' }),
      })

      await expect(adapter.fetchThread('abc123', mockConfig)).rejects.toThrow('Invalid token')
    })

    it('should call Figma API with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-1',
              file_key: 'abc123',
              parent_id: '',
              user: { id: 'user-1', handle: 'alice' },
              created_at: '2024-01-01T10:00:00Z',
              resolved_at: null,
              message: 'Test',
              order_id: 1,
            },
          ],
        }),
      })

      await adapter.fetchThread('abc123', mockConfig)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/abc123/comments',
        expect.objectContaining({
          headers: {
            'X-Figma-Token': 'figd_test_token_1234567890',
          },
        })
      )
    })
  })

  describe('postReply', () => {
    const mockConfig: SourceConfig = {
      id: '1',
      teamId: 'team-abc',
      sourceType: 'figma',
      name: 'Test Config',
      apiToken: 'figd_test_token',
      notionToken: 'secret_notion_token',
      notionDatabaseId: 'abc123',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should post reply to Figma comment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-comment' }),
      })

      const success = await adapter.postReply(
        'abc123:comment-1',
        'Task created!',
        mockConfig
      )

      expect(success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/abc123/comments',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-Figma-Token': 'figd_test_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Task created!',
            comment_id: 'comment-1',
          }),
        })
      )
    })

    it('should return false if no comment ID provided', async () => {
      const success = await adapter.postReply('abc123', 'Message', mockConfig)

      expect(success).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return false on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ err: 'Invalid token' }),
      })

      const success = await adapter.postReply('abc123:comment-1', 'Message', mockConfig)

      expect(success).toBe(false)
    })
  })

  describe('updateStatus', () => {
    const mockConfig: SourceConfig = {
      id: '1',
      teamId: 'team-abc',
      sourceType: 'figma',
      name: 'Test Config',
      apiToken: 'figd_test_token',
      notionToken: 'secret_notion_token',
      notionDatabaseId: 'abc123',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should add reaction emoji for status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const success = await adapter.updateStatus('abc123:comment-1', 'completed', mockConfig)

      expect(success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/files/abc123/comments/comment-1/reactions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ emoji: ':white_check_mark:' }),
        })
      )
    })

    it('should map all status types to emoji', async () => {
      const statusEmojiMap = {
        pending: ':eyes:',
        processing: ':hourglass:',
        analyzed: ':robot:',
        completed: ':white_check_mark:',
        failed: ':x:',
        retrying: ':arrows_counterclockwise:',
      }

      for (const [status, emoji] of Object.entries(statusEmojiMap)) {
        mockFetch.mockClear()
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

        await adapter.updateStatus('abc123:comment-1', status as any, mockConfig)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({ emoji }),
          })
        )
      }
    })

    it('should return false if no comment ID provided', async () => {
      const success = await adapter.updateStatus('abc123', 'completed', mockConfig)

      expect(success).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('validateConfig', () => {
    it('should validate correct config', async () => {
      const config: SourceConfig = {
        id: '1',
        teamId: 'team-abc',
        sourceType: 'figma',
        name: 'Test Config',
        apiToken: 'figd_valid_token_1234567890',
        notionToken: 'secret_notion_token_1234567890',
        notionDatabaseId: 'abc123def456',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing API token', async () => {
      const config: SourceConfig = {
        id: '1',
        teamId: 'team-abc',
        sourceType: 'figma',
        name: 'Test Config',
        apiToken: '',
        notionToken: 'secret_notion_token',
        notionDatabaseId: 'abc123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Figma API token is required')
    })

    it('should detect missing Notion token', async () => {
      const config: SourceConfig = {
        id: '1',
        teamId: 'team-abc',
        sourceType: 'figma',
        name: 'Test Config',
        apiToken: 'figd_valid_token_1234567890',
        notionToken: '',
        notionDatabaseId: 'abc123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion API token is required')
    })

    it('should detect source type mismatch', async () => {
      const config: SourceConfig = {
        id: '1',
        teamId: 'team-abc',
        sourceType: 'slack',
        name: 'Test Config',
        apiToken: 'figd_valid_token_1234567890',
        notionToken: 'secret_notion_token',
        notionDatabaseId: 'abc123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Source type mismatch: expected 'figma', got 'slack'")
    })

    it('should warn if API token is too short', async () => {
      const config: SourceConfig = {
        id: '1',
        teamId: 'team-abc',
        sourceType: 'figma',
        name: 'Test Config',
        apiToken: 'short',
        notionToken: 'secret_notion_token',
        notionDatabaseId: 'abc123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.warnings).toContain('Figma API token appears to be too short')
    })
  })

  describe('testConnection', () => {
    const mockConfig: SourceConfig = {
      id: '1',
      teamId: 'team-abc',
      sourceType: 'figma',
      name: 'Test Config',
      apiToken: 'figd_test_token',
      notionToken: 'secret_notion_token',
      notionDatabaseId: 'abc123',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should return true if connection successful', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'user-123', handle: 'testuser' }),
      })

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.figma.com/v1/me',
        expect.objectContaining({
          headers: {
            'X-Figma-Token': 'figd_test_token',
          },
        })
      )
    })

    it('should return false if connection fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      })

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })

    it('should return false if fetch throws error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(false)
    })
  })

  describe('sourceType', () => {
    it('should have correct source type', () => {
      expect(adapter.sourceType).toBe('figma')
    })
  })
})

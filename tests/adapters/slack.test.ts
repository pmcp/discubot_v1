/**
 * Tests for Slack Adapter
 *
 * Tests all adapter interface methods:
 * - parseIncoming()
 * - fetchThread()
 * - postReply()
 * - updateStatus()
 * - validateConfig()
 * - testConnection()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SlackAdapter } from '../../layers/discubot/server/adapters/slack'
import { AdapterError } from '../../layers/discubot/server/adapters/base'
import type { SourceConfig } from '../../layers/discubot/types'

describe('SlackAdapter', () => {
  let adapter: SlackAdapter

  beforeEach(() => {
    adapter = new SlackAdapter()
    vi.clearAllMocks()
  })

  describe('parseIncoming()', () => {
    it('should parse valid Slack message event', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U123456',
          text: 'This is a test message',
          ts: '1234567890.123456',
        },
      }

      const result = await adapter.parseIncoming(payload)

      expect(result).toEqual({
        sourceType: 'slack',
        sourceThreadId: 'C123456:1234567890.123456',
        sourceUrl: 'slack://channel?team=T123456&id=C123456&message=1234567890123456',
        teamId: 'T123456',
        authorHandle: 'U123456',
        title: 'This is a test message',
        content: 'This is a test message',
        participants: ['U123456'],
        timestamp: new Date(1234567890123.456),
        metadata: {
          channelId: 'C123456',
          messageTs: '1234567890.123456',
          threadTs: undefined,
          channelType: undefined,
        },
      })
    })

    it('should parse threaded message event', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U123456',
          text: 'Reply in thread',
          ts: '1234567891.123456',
          thread_ts: '1234567890.123456', // This is a reply to another message
        },
      }

      const result = await adapter.parseIncoming(payload)

      // Should use thread_ts for sourceThreadId
      expect(result.sourceThreadId).toBe('C123456:1234567890.123456')
      expect(result.metadata.threadTs).toBe('1234567890.123456')
    })

    it('should truncate long title to 50 chars', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U123456',
          text: 'This is a very long message that should be truncated to 50 characters maximum',
          ts: '1234567890.123456',
        },
      }

      const result = await adapter.parseIncoming(payload)

      expect(result.title).toBe('This is a very long message that should be trun...')
      expect(result.title.length).toBe(50)
    })

    it('should use first line as title for multiline messages', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U123456',
          text: 'First line\nSecond line\nThird line',
          ts: '1234567890.123456',
        },
      }

      const result = await adapter.parseIncoming(payload)

      expect(result.title).toBe('First line')
      expect(result.content).toBe('First line\nSecond line\nThird line')
    })

    it('should throw error for URL verification challenge', async () => {
      const payload = {
        type: 'url_verification',
        challenge: 'test_challenge',
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('URL verification challenge')
    })

    it('should throw error for missing event', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('No event found')
    })

    it('should throw error for non-message events', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'app_mention',
          user: 'U123456',
          text: '@bot help',
          ts: '1234567890.123456',
        },
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('Unsupported event type')
    })

    it('should throw error for message subtypes (e.g., message_changed)', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          subtype: 'message_changed',
          channel: 'C123456',
        },
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('Unsupported event type')
    })

    it('should throw error for missing text', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U123456',
          text: '',
          ts: '1234567890.123456',
        },
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('No message text found')
    })

    it('should throw error for missing channel', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          user: 'U123456',
          text: 'Test message',
          ts: '1234567890.123456',
        },
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('No channel ID found')
    })

    it('should throw error for missing user', async () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          channel: 'C123456',
          text: 'Test message',
          ts: '1234567890.123456',
        },
      }

      await expect(adapter.parseIncoming(payload)).rejects.toThrow(AdapterError)
      await expect(adapter.parseIncoming(payload)).rejects.toThrow('No user ID found')
    })

    it('should fallback to "default" team ID if missing', async () => {
      const payload = {
        type: 'event_callback',
        // No team_id
        event: {
          type: 'message',
          channel: 'C123456',
          user: 'U123456',
          text: 'Test message',
          ts: '1234567890.123456',
        },
      }

      const result = await adapter.parseIncoming(payload)
      expect(result.teamId).toBe('default')
    })
  })

  describe('fetchThread()', () => {
    const mockConfig: SourceConfig = {
      id: 'config_1',
      teamId: 'team_123',
      sourceType: 'slack',
      name: 'Test Slack',
      apiToken: 'xoxb-test-token',
      notionToken: 'notion_test',
      notionDatabaseId: 'db_test',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should fetch thread with replies', async () => {
      const mockResponse = {
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
            text: 'First reply',
            ts: '1234567891.123456',
            thread_ts: '1234567890.123456',
          },
          {
            type: 'message',
            user: 'U345678',
            text: 'Second reply',
            ts: '1234567892.123456',
            thread_ts: '1234567890.123456',
          },
        ],
        has_more: false,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await adapter.fetchThread('C123456:1234567890.123456', mockConfig)

      expect(result).toEqual({
        id: '1234567890.123456',
        rootMessage: {
          id: '1234567890.123456',
          authorHandle: 'U123456',
          content: 'Root message',
          timestamp: new Date(1234567890123.456),
        },
        replies: [
          {
            id: '1234567891.123456',
            authorHandle: 'U789012',
            content: 'First reply',
            timestamp: new Date(1234567891123.456),
          },
          {
            id: '1234567892.123456',
            authorHandle: 'U345678',
            content: 'Second reply',
            timestamp: new Date(1234567892123.456),
          },
        ],
        participants: ['U123456', 'U789012', 'U345678'],
        metadata: {
          channelId: 'C123456',
          threadTs: '1234567890.123456',
          messageCount: 3,
          hasMore: false,
        },
      })

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/conversations.replies?channel=C123456&ts=1234567890.123456&limit=100',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-test-token',
          }),
        })
      )
    })

    it('should handle thread with no replies', async () => {
      const mockResponse = {
        ok: true,
        messages: [
          {
            type: 'message',
            user: 'U123456',
            text: 'Root message only',
            ts: '1234567890.123456',
          },
        ],
        has_more: false,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await adapter.fetchThread('C123456:1234567890.123456', mockConfig)

      expect(result.replies).toEqual([])
      expect(result.participants).toEqual(['U123456'])
    })

    it('should throw error for invalid thread ID format', async () => {
      await expect(adapter.fetchThread('invalid', mockConfig)).rejects.toThrow(AdapterError)
      await expect(adapter.fetchThread('invalid', mockConfig)).rejects.toThrow('Invalid thread ID format')
    })

    it('should throw error for HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(adapter.fetchThread('C123456:1234567890.123456', mockConfig)).rejects.toThrow(AdapterError)
      await expect(adapter.fetchThread('C123456:1234567890.123456', mockConfig)).rejects.toThrow('404')
    })

    it('should throw error for Slack API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'channel_not_found',
        }),
      })

      await expect(adapter.fetchThread('C123456:1234567890.123456', mockConfig)).rejects.toThrow(AdapterError)
      await expect(adapter.fetchThread('C123456:1234567890.123456', mockConfig)).rejects.toThrow('channel_not_found')
    })

    it('should throw error when no messages found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [],
        }),
      })

      await expect(adapter.fetchThread('C123456:1234567890.123456', mockConfig)).rejects.toThrow(AdapterError)
      await expect(adapter.fetchThread('C123456:1234567890.123456', mockConfig)).rejects.toThrow('No messages found')
    })

    it('should mark rate_limited errors as retryable', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'rate_limited',
        }),
      })

      try {
        await adapter.fetchThread('C123456:1234567890.123456', mockConfig)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError)
        expect((error as AdapterError).context?.retryable).toBe(true)
      }
    })
  })

  describe('postReply()', () => {
    const mockConfig: SourceConfig = {
      id: 'config_1',
      teamId: 'team_123',
      sourceType: 'slack',
      name: 'Test Slack',
      apiToken: 'xoxb-test-token',
      notionToken: 'notion_test',
      notionDatabaseId: 'db_test',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should post threaded reply successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          channel: 'C123456',
          ts: '1234567891.123456',
        }),
      })

      const result = await adapter.postReply(
        'C123456:1234567890.123456',
        'Test reply message',
        mockConfig
      )

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-test-token',
          }),
          body: JSON.stringify({
            channel: 'C123456',
            text: 'Test reply message',
            thread_ts: '1234567890.123456',
          }),
        })
      )
    })

    it('should return false for invalid thread ID', async () => {
      const result = await adapter.postReply('invalid', 'Test message', mockConfig)
      expect(result).toBe(false)
    })

    it('should return false for HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const result = await adapter.postReply(
        'C123456:1234567890.123456',
        'Test message',
        mockConfig
      )

      expect(result).toBe(false)
    })

    it('should return false for Slack API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'channel_not_found',
        }),
      })

      const result = await adapter.postReply(
        'C123456:1234567890.123456',
        'Test message',
        mockConfig
      )

      expect(result).toBe(false)
    })
  })

  describe('updateStatus()', () => {
    const mockConfig: SourceConfig = {
      id: 'config_1',
      teamId: 'team_123',
      sourceType: 'slack',
      name: 'Test Slack',
      apiToken: 'xoxb-test-token',
      notionToken: 'notion_test',
      notionDatabaseId: 'db_test',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should add reaction for each status', async () => {
      const statusEmojiMap = {
        pending: 'eyes',
        processing: 'hourglass_flowing_sand',
        analyzed: 'robot_face',
        completed: 'white_check_mark',
        failed: 'x',
        retrying: 'arrows_counterclockwise',
      }

      for (const [status, emoji] of Object.entries(statusEmojiMap)) {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ ok: true }),
        })

        const result = await adapter.updateStatus(
          'C123456:1234567890.123456',
          status as any,
          mockConfig
        )

        expect(result).toBe(true)
        expect(global.fetch).toHaveBeenCalledWith(
          'https://slack.com/api/reactions.add',
          expect.objectContaining({
            body: JSON.stringify({
              channel: 'C123456',
              timestamp: '1234567890.123456',
              name: emoji,
            }),
          })
        )
      }
    })

    it('should return true for already_reacted error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'already_reacted',
        }),
      })

      const result = await adapter.updateStatus(
        'C123456:1234567890.123456',
        'completed',
        mockConfig
      )

      expect(result).toBe(true) // Should treat as success
    })

    it('should return false for invalid thread ID', async () => {
      const result = await adapter.updateStatus('invalid', 'completed', mockConfig)
      expect(result).toBe(false)
    })

    it('should return false for other API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'no_reaction',
        }),
      })

      const result = await adapter.updateStatus(
        'C123456:1234567890.123456',
        'completed',
        mockConfig
      )

      expect(result).toBe(false)
    })
  })

  describe('validateConfig()', () => {
    it('should validate correct configuration', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'slack',
        name: 'Test Slack',
        apiToken: 'xoxb-test-token',
        notionToken: 'notion_test_token',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {
          workspaceId: 'T123456',
        },
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('should warn for token without proper prefix', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'slack',
        name: 'Test Slack',
        apiToken: 'invalid-token',
        notionToken: 'notion_test_token',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.warnings).toContain(
        'Slack API token should start with "xoxb-" (bot token) or "xoxp-" (user token)'
      )
    })

    it('should error for missing API token', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'slack',
        name: 'Test Slack',
        apiToken: '',
        notionToken: 'notion_test_token',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Slack API token is required')
    })

    it('should error for missing Notion token', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'slack',
        name: 'Test Slack',
        apiToken: 'xoxb-test-token',
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

    it('should error for missing Notion database ID', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'slack',
        name: 'Test Slack',
        apiToken: 'xoxb-test-token',
        notionToken: 'notion_test_token',
        notionDatabaseId: '',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Notion database ID is required')
    })

    it('should warn for missing workspace ID', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'slack',
        name: 'Test Slack',
        apiToken: 'xoxb-test-token',
        notionToken: 'notion_test_token',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.warnings).toContain(
        'Slack workspace ID not found in settings - deep links may not work correctly'
      )
    })

    it('should error for source type mismatch', async () => {
      const config: SourceConfig = {
        id: 'config_1',
        teamId: 'team_123',
        sourceType: 'figma',
        name: 'Test Slack',
        apiToken: 'xoxb-test-token',
        notionToken: 'notion_test_token',
        notionDatabaseId: 'db_test_123',
        aiEnabled: true,
        autoSync: true,
        settings: {},
        active: true,
      }

      const result = await adapter.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Source type mismatch: expected 'slack', got 'figma'"
      )
    })
  })

  describe('testConnection()', () => {
    const mockConfig: SourceConfig = {
      id: 'config_1',
      teamId: 'team_123',
      sourceType: 'slack',
      name: 'Test Slack',
      apiToken: 'xoxb-test-token',
      notionToken: 'notion_test',
      notionDatabaseId: 'db_test',
      aiEnabled: true,
      autoSync: true,
      settings: {},
      active: true,
    }

    it('should return true for successful connection', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          url: 'https://myworkspace.slack.com/',
          team: 'My Workspace',
          user: 'testbot',
          team_id: 'T123456',
          user_id: 'U123456',
        }),
      })

      const result = await adapter.testConnection(mockConfig)

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-test-token',
          }),
        })
      )
    })

    it('should return false for HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      })

      const result = await adapter.testConnection(mockConfig)
      expect(result).toBe(false)
    })

    it('should return false for Slack API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'invalid_auth',
        }),
      })

      const result = await adapter.testConnection(mockConfig)
      expect(result).toBe(false)
    })

    it('should return false for network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await adapter.testConnection(mockConfig)
      expect(result).toBe(false)
    })
  })
})

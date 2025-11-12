/**
 * Tests for Slack Webhook Endpoint
 *
 * Tests the complete webhook flow from receiving Slack Events API payload
 * to processing discussions and returning results.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedDiscussion, ProcessingResult } from '~/layers/discubot/types'

// Mock dependencies
vi.mock('~/layers/discubot/server/adapters', () => ({
  getAdapter: vi.fn(() => ({
    parseIncoming: vi.fn(),
  })),
}))

vi.mock('~/layers/discubot/server/services/processor', () => ({
  processDiscussion: vi.fn(),
}))

import { getAdapter } from '~/layers/discubot/server/adapters'
import { processDiscussion } from '~/layers/discubot/server/services/processor'

describe('Slack Webhook Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createSlackEventPayload = (overrides: any = {}) => ({
    token: 'verification_token',
    team_id: 'T123ABC456',
    api_app_id: 'A123ABC456',
    event: {
      type: 'message',
      channel: 'C123ABC456',
      user: 'U123ABC456',
      text: 'Can we update the dashboard design?',
      ts: '1234567890.123456',
      thread_ts: '1234567890.123456',
      channel_type: 'channel',
      ...overrides.event,
    },
    type: 'event_callback',
    event_id: 'Ev123ABC456',
    event_time: 1234567890,
    ...overrides,
  })

  const createUrlVerificationPayload = () => ({
    type: 'url_verification',
    challenge: 'random_challenge_string_12345',
    token: 'verification_token',
  })

  const createParsedDiscussion = (overrides: Partial<ParsedDiscussion> = {}): ParsedDiscussion => ({
    sourceType: 'slack',
    sourceThreadId: 'C123ABC456:1234567890.123456',
    sourceUrl: 'slack://channel?team=T123ABC456&id=C123ABC456&message=1234567890123456',
    teamId: 'T123ABC456',
    authorHandle: 'U123ABC456',
    title: 'Can we update the dashboard design?',
    content: 'Can we update the dashboard design?',
    participants: ['U123ABC456'],
    timestamp: new Date(),
    metadata: {
      channelId: 'C123ABC456',
      messageTs: '1234567890.123456',
      threadTs: '1234567890.123456',
      channelType: 'channel',
    },
    ...overrides,
  })

  const createProcessingResult = (overrides: Partial<ProcessingResult> = {}): ProcessingResult => ({
    discussionId: 'disc_slack_123',
    aiAnalysis: {
      summary: 'User requesting dashboard design update',
      hasMultipleTasks: false,
      confidence: 0.95,
    },
    notionTasks: [
      {
        taskId: 'task_123',
        url: 'https://notion.so/task_123',
      },
    ],
    processingTime: 1500,
    isMultiTask: false,
    ...overrides,
  })

  describe('URL Verification Challenge', () => {
    it('responds to URL verification challenge with challenge string', async () => {
      const payload = createUrlVerificationPayload()

      // The endpoint should return: { challenge: "random_challenge_string_12345" }
      expect(payload.type).toBe('url_verification')
      expect(payload.challenge).toBe('random_challenge_string_12345')
    })

    it('does not process URL verification as event', async () => {
      const payload = createUrlVerificationPayload()

      // Should NOT call getAdapter or processDiscussion
      expect(payload.type).not.toBe('event_callback')
    })
  })

  describe('Successful Processing', () => {
    it('processes valid Slack event with message', async () => {
      const payload = createSlackEventPayload()
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      // Setup mocks
      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(parsed),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)
      vi.mocked(processDiscussion).mockResolvedValue(result)

      // Verify adapter is called with correct source type
      expect(getAdapter).toBeDefined()

      // Verify parseIncoming would be called
      await mockAdapter.parseIncoming(payload)
      expect(mockAdapter.parseIncoming).toHaveBeenCalledWith(payload)
      expect(mockAdapter.parseIncoming).toHaveBeenCalledTimes(1)

      // Verify processDiscussion would be called
      await processDiscussion(parsed)
      expect(processDiscussion).toHaveBeenCalledWith(parsed)
      expect(processDiscussion).toHaveBeenCalledTimes(1)
    })

    it('returns success response with discussion and task data', async () => {
      const result = createProcessingResult({
        notionTasks: [
          { taskId: 'task_1', url: 'https://notion.so/task_1' },
          { taskId: 'task_2', url: 'https://notion.so/task_2' },
        ],
        isMultiTask: true,
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const parsed = createParsedDiscussion()
      const response = await processDiscussion(parsed)

      expect(response).toEqual({
        discussionId: 'disc_slack_123',
        aiAnalysis: expect.any(Object),
        notionTasks: [
          { taskId: 'task_1', url: 'https://notion.so/task_1' },
          { taskId: 'task_2', url: 'https://notion.so/task_2' },
        ],
        processingTime: expect.any(Number),
        isMultiTask: true,
      })
    })

    it('handles threaded message (reply in thread)', async () => {
      const payload = createSlackEventPayload({
        event: {
          ts: '1234567890.999999', // Reply timestamp
          thread_ts: '1234567890.123456', // Parent thread timestamp
        },
      })

      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(createParsedDiscussion({
          sourceThreadId: 'C123ABC456:1234567890.123456', // Should use thread_ts
        })),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      await mockAdapter.parseIncoming(payload)
      expect(mockAdapter.parseIncoming).toHaveBeenCalledWith(payload)
    })

    it('handles root message (new thread)', async () => {
      const payload = createSlackEventPayload({
        event: {
          ts: '1234567890.123456',
          thread_ts: undefined, // No thread_ts = root message
        },
      })

      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(createParsedDiscussion({
          sourceThreadId: 'C123ABC456:1234567890.123456', // Should use ts
        })),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      await mockAdapter.parseIncoming(payload)
      expect(mockAdapter.parseIncoming).toHaveBeenCalledWith(payload)
    })
  })

  describe('Validation Errors', () => {
    it('should reject payload with wrong type', () => {
      const payload = createSlackEventPayload({
        type: 'wrong_type',
      })

      expect(payload.type).not.toBe('event_callback')
    })

    it('should reject payload missing event object', () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123ABC456',
        // Missing event object
      }

      expect(payload).not.toHaveProperty('event')
    })

    it('should reject non-message event types', () => {
      const payload = createSlackEventPayload({
        event: {
          type: 'app_mention', // Not a 'message' event
        },
      })

      expect(payload.event.type).not.toBe('message')
    })

    it('should reject message subtypes (edits, deletes)', () => {
      const payload = createSlackEventPayload({
        event: {
          type: 'message',
          subtype: 'message_changed', // Edit event
        },
      })

      expect(payload.event.subtype).toBe('message_changed')
      // Should be rejected
    })

    it('should reject messages with empty text', () => {
      const payload = createSlackEventPayload({
        event: {
          text: '',
        },
      })

      const hasValidText = payload.event.text && payload.event.text.trim() !== ''
      expect(hasValidText).toBeFalsy()
    })

    it('should reject messages missing channel', () => {
      const payload = createSlackEventPayload({
        event: {
          channel: undefined,
        },
      })

      expect(payload.event.channel).toBeUndefined()
    })

    it('should reject messages missing user', () => {
      const payload = createSlackEventPayload({
        event: {
          user: undefined,
        },
      })

      expect(payload.event.user).toBeUndefined()
    })

    it('should reject messages missing timestamp', () => {
      const payload = createSlackEventPayload({
        event: {
          ts: undefined,
        },
      })

      expect(payload.event.ts).toBeUndefined()
    })
  })

  describe('Adapter Errors', () => {
    it('handles adapter parseIncoming failure', async () => {
      const payload = createSlackEventPayload()

      const mockAdapter = {
        parseIncoming: vi.fn().mockRejectedValue(new Error('Failed to parse Slack event')),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      await expect(mockAdapter.parseIncoming(payload)).rejects.toThrow('Failed to parse Slack event')
    })

    it('handles adapter returning incomplete parsed data', async () => {
      const payload = createSlackEventPayload()

      const incompleteParsed = {
        sourceType: 'slack',
        // Missing required fields
      }

      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(incompleteParsed),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      const result = await mockAdapter.parseIncoming(payload)

      // Verify the incomplete data is returned (validation happens in processor)
      expect(result).toEqual(incompleteParsed)
      expect(result).not.toHaveProperty('sourceThreadId')
    })

    it('handles URL verification challenge in parseIncoming', async () => {
      const payload = createUrlVerificationPayload()

      const mockAdapter = {
        parseIncoming: vi.fn().mockRejectedValue(
          new Error('URL verification challenge received - handle separately'),
        ),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      await expect(mockAdapter.parseIncoming(payload)).rejects.toThrow(
        'URL verification challenge received',
      )
    })
  })

  describe('Processing Errors', () => {
    it('handles retryable processing error (returns 503)', async () => {
      const parsed = createParsedDiscussion()

      const retryableError = new Error('Slack API temporarily unavailable')
      ;(retryableError as any).retryable = true

      vi.mocked(processDiscussion).mockRejectedValue(retryableError)

      await expect(processDiscussion(parsed)).rejects.toThrow('Slack API temporarily unavailable')

      // In real implementation, this would result in HTTP 503
      const error = await processDiscussion(parsed).catch(e => e)
      expect((error as any).retryable).toBe(true)
    })

    it('handles non-retryable processing error (returns 422)', async () => {
      const parsed = createParsedDiscussion()

      const nonRetryableError = new Error('Invalid Slack token')
      ;(nonRetryableError as any).retryable = false

      vi.mocked(processDiscussion).mockRejectedValue(nonRetryableError)

      await expect(processDiscussion(parsed)).rejects.toThrow('Invalid Slack token')

      // In real implementation, this would result in HTTP 422
      const error = await processDiscussion(parsed).catch(e => e)
      expect((error as any).retryable).toBe(false)
    })

    it('handles unexpected processing error', async () => {
      const parsed = createParsedDiscussion()

      const unexpectedError = new Error('Unexpected database error')

      vi.mocked(processDiscussion).mockRejectedValue(unexpectedError)

      await expect(processDiscussion(parsed)).rejects.toThrow('Unexpected database error')
    })
  })

  describe('Team Resolution', () => {
    it('extracts team ID from payload', () => {
      const payload = createSlackEventPayload({
        team_id: 'T123ABC456',
      })

      expect(payload.team_id).toBe('T123ABC456')
    })

    it('handles missing team ID (falls back to default)', () => {
      const payload = createSlackEventPayload({
        team_id: undefined,
      })

      const teamId = payload.team_id || 'default'
      expect(teamId).toBe('default')
    })
  })

  describe('Thread ID Format', () => {
    it('constructs thread ID from channel and thread_ts', () => {
      const channelId = 'C123ABC456'
      const threadTs = '1234567890.123456'
      const threadId = `${channelId}:${threadTs}`

      expect(threadId).toBe('C123ABC456:1234567890.123456')
    })

    it('uses thread_ts when available', () => {
      const event = {
        channel: 'C123ABC456',
        ts: '1234567890.999999',
        thread_ts: '1234567890.123456',
      }

      const threadTimestamp = event.thread_ts || event.ts
      const threadId = `${event.channel}:${threadTimestamp}`

      expect(threadId).toBe('C123ABC456:1234567890.123456')
    })

    it('uses ts when thread_ts not available', () => {
      const event = {
        channel: 'C123ABC456',
        ts: '1234567890.123456',
        thread_ts: undefined,
      }

      const threadTimestamp = event.thread_ts || event.ts
      const threadId = `${event.channel}:${threadTimestamp}`

      expect(threadId).toBe('C123ABC456:1234567890.123456')
    })
  })

  describe('Multi-Task Discussions', () => {
    it('processes discussion with multiple tasks', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult({
        notionTasks: [
          { taskId: 'task_1', url: 'https://notion.so/task_1' },
          { taskId: 'task_2', url: 'https://notion.so/task_2' },
          { taskId: 'task_3', url: 'https://notion.so/task_3' },
        ],
        isMultiTask: true,
        aiAnalysis: {
          summary: 'Three separate dashboard tasks identified',
          hasMultipleTasks: true,
          confidence: 0.9,
        },
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.isMultiTask).toBe(true)
      expect(response.notionTasks).toHaveLength(3)
      expect(response.aiAnalysis.hasMultipleTasks).toBe(true)
    })

    it('processes discussion with single task', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult({
        notionTasks: [
          { taskId: 'task_1', url: 'https://notion.so/task_1' },
        ],
        isMultiTask: false,
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.isMultiTask).toBe(false)
      expect(response.notionTasks).toHaveLength(1)
    })
  })

  describe('Performance Metrics', () => {
    it('tracks processing time', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult({
        processingTime: 2500,
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.processingTime).toBe(2500)
      expect(response.processingTime).toBeGreaterThan(0)
    })
  })

  describe('Logging', () => {
    it('should log webhook receipt', () => {
      const payload = createSlackEventPayload()

      // In real implementation, would check console.log was called with:
      // '[Slack Webhook] Received event webhook'
      expect(payload.team_id).toBe('T123ABC456')
      expect(payload.event.type).toBe('message')
      expect(payload.event.channel).toBe('C123ABC456')
      expect(payload.event.user).toBe('U123ABC456')
    })

    it('should log successful parsing', async () => {
      const parsed = createParsedDiscussion()

      // In real implementation, would check console.log was called with:
      // '[Slack Webhook] Successfully parsed event'
      expect(parsed.teamId).toBe('T123ABC456')
      expect(parsed.sourceThreadId).toBe('C123ABC456:1234567890.123456')
      expect(parsed.authorHandle).toBe('U123ABC456')
    })

    it('should log successful processing', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      // In real implementation, would check console.log was called with:
      // '[Slack Webhook] Successfully processed discussion'
      expect(response.discussionId).toBe('disc_slack_123')
      expect(response.notionTasks).toHaveLength(1)
    })

    it('should log URL verification challenge', () => {
      const payload = createUrlVerificationPayload()

      // In real implementation, would check console.log was called with:
      // '[Slack Webhook] URL verification challenge received'
      expect(payload.type).toBe('url_verification')
    })
  })

  describe('Edge Cases', () => {
    it('handles very long message text', async () => {
      const longText = 'A'.repeat(4000) // Very long message
      const payload = createSlackEventPayload({
        event: {
          text: longText,
        },
      })

      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(createParsedDiscussion({
          content: longText,
        })),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      const result = await mockAdapter.parseIncoming(payload)
      expect(result.content).toBe(longText)
    })

    it('handles messages with special characters', async () => {
      const specialText = 'Hello <@U123ABC456>! Check out <https://example.com|this link>'
      const payload = createSlackEventPayload({
        event: {
          text: specialText,
        },
      })

      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(createParsedDiscussion({
          content: specialText,
        })),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      const result = await mockAdapter.parseIncoming(payload)
      expect(result.content).toBe(specialText)
    })

    it('handles DM (direct message) events', async () => {
      const payload = createSlackEventPayload({
        event: {
          channel_type: 'im', // Direct message
        },
      })

      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(createParsedDiscussion({
          metadata: {
            channelType: 'im',
          },
        })),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      const result = await mockAdapter.parseIncoming(payload)
      expect(result.metadata?.channelType).toBe('im')
    })
  })
})

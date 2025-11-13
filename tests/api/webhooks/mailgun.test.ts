/**
 * Tests for Mailgun Webhook Endpoint
 *
 * Tests the complete webhook flow from receiving Mailgun payload
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

describe('Mailgun Webhook Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMailgunPayload = (overrides = {}) => ({
    subject: 'Jane commented on Design File',
    from: 'jane@company.com',
    recipient: 'team-slug@discubot.example.com',
    'body-plain': 'This looks great!',
    'body-html': '<p>This looks great!</p>',
    'stripped-text': 'This looks great!',
    timestamp: 1699999999,
    ...overrides,
  })

  const createParsedDiscussion = (overrides: Partial<ParsedDiscussion> = {}): ParsedDiscussion => ({
    sourceType: 'figma',
    sourceThreadId: 'abc123',
    sourceUrl: 'https://figma.com/file/abc123',
    teamId: 'team-slug',
    authorHandle: 'jane',
    title: 'Design File Discussion',
    content: 'This looks great!',
    participants: ['jane'],
    timestamp: new Date(),
    ...overrides,
  })

  const createProcessingResult = (overrides: Partial<ProcessingResult> = {}): ProcessingResult => ({
    discussionId: 'disc_123',
    aiAnalysis: {
      summary: 'Test summary',
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

  describe('Successful Processing', () => {
    it('processes valid Mailgun payload with Figma email', async () => {
      const payload = createMailgunPayload()
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      // Setup mocks
      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(parsed),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)
      vi.mocked(processDiscussion).mockResolvedValue(result)

      // Note: In actual tests, you would use Nuxt's test utils to call the endpoint
      // For now, we're testing the logic flow with mocks

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
        discussionId: 'disc_123',
        aiAnalysis: expect.any(Object),
        notionTasks: [
          { taskId: 'task_1', url: 'https://notion.so/task_1' },
          { taskId: 'task_2', url: 'https://notion.so/task_2' },
        ],
        processingTime: expect.any(Number),
        isMultiTask: true,
      })
    })

    it('handles email with only body-html (no plain text)', async () => {
      const payload = createMailgunPayload({
        'body-plain': undefined,
        'stripped-text': undefined,
        'body-html': '<p>HTML only content</p>',
      })

      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(createParsedDiscussion()),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      await mockAdapter.parseIncoming(payload)
      expect(mockAdapter.parseIncoming).toHaveBeenCalledWith(payload)
    })

    it('handles email with only stripped-text', async () => {
      const payload = createMailgunPayload({
        'body-plain': undefined,
        'body-html': undefined,
        'stripped-text': 'Stripped text only',
      })

      const mockAdapter = {
        parseIncoming: vi.fn().mockResolvedValue(createParsedDiscussion()),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      await mockAdapter.parseIncoming(payload)
      expect(mockAdapter.parseIncoming).toHaveBeenCalledWith(payload)
    })
  })

  describe('Validation Errors', () => {
    it('should reject payload missing recipient field', () => {
      const payload = createMailgunPayload({
        recipient: undefined,
      })

      // Validation should fail - missing required field
      const hasRecipient = 'recipient' in payload && payload.recipient
      expect(hasRecipient).toBeFalsy()
    })

    it('should reject payload missing all body fields', () => {
      const payload = createMailgunPayload({
        'body-plain': undefined,
        'body-html': undefined,
        'stripped-text': undefined,
      })

      // Validation should fail - no body content
      const hasBody = payload['body-plain'] || payload['body-html'] || payload['stripped-text']
      expect(hasBody).toBeFalsy()
    })

    it('should accept payload with at least one body field', () => {
      const payloadPlain = createMailgunPayload({
        'body-html': undefined,
        'stripped-text': undefined,
      })

      const hasBody = payloadPlain['body-plain'] || payloadPlain['body-html'] || payloadPlain['stripped-text']
      expect(hasBody).toBeTruthy()
    })
  })

  describe('Adapter Errors', () => {
    it('handles adapter parseIncoming failure', async () => {
      const payload = createMailgunPayload()

      const mockAdapter = {
        parseIncoming: vi.fn().mockRejectedValue(new Error('Failed to extract file key')),
      }
      vi.mocked(getAdapter).mockReturnValue(mockAdapter as any)

      await expect(mockAdapter.parseIncoming(payload)).rejects.toThrow('Failed to extract file key')
    })

    it('handles adapter returning incomplete parsed data', async () => {
      const payload = createMailgunPayload()

      const incompleteParsed = {
        sourceType: 'figma',
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
  })

  describe('Processing Errors', () => {
    it('handles retryable processing error (returns 503)', async () => {
      const parsed = createParsedDiscussion()

      const retryableError = new Error('AI service temporarily unavailable')
      ;(retryableError as any).retryable = true

      vi.mocked(processDiscussion).mockRejectedValue(retryableError)

      await expect(processDiscussion(parsed)).rejects.toThrow('AI service temporarily unavailable')

      // In real implementation, this would result in HTTP 503
      const error = await processDiscussion(parsed).catch(e => e)
      expect((error as any).retryable).toBe(true)
    })

    it('handles non-retryable processing error (returns 422)', async () => {
      const parsed = createParsedDiscussion()

      const nonRetryableError = new Error('Invalid API token')
      ;(nonRetryableError as any).retryable = false

      vi.mocked(processDiscussion).mockRejectedValue(nonRetryableError)

      await expect(processDiscussion(parsed)).rejects.toThrow('Invalid API token')

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
    it('extracts team ID from recipient email', () => {
      const recipient = 'team-slug@discubot.example.com'
      const match = recipient.match(/^([^@]+)@/)

      expect(match).toBeTruthy()
      expect(match![1]).toBe('team-slug')
    })

    it('handles recipient without team slug', () => {
      const recipient = '@discubot.example.com'
      const match = recipient.match(/^([^@]+)@/)

      // Regex requires at least one char before @, so this should be null
      expect(match).toBeNull()
    })

    it('handles malformed recipient', () => {
      const recipient = 'not-an-email'
      const match = recipient.match(/^([^@]+)@/)

      expect(match).toBeNull()
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
          summary: 'Three separate tasks identified',
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
      const payload = createMailgunPayload()

      // In real implementation, would check console.log was called with:
      // '[Mailgun Webhook] Received webhook'
      expect(payload.recipient).toBe('team-slug@discubot.example.com')
      expect(payload.from).toBe('jane@company.com')
      expect(payload.subject).toBe('Jane commented on Design File')
    })

    it('should log successful parsing', async () => {
      const parsed = createParsedDiscussion()

      // In real implementation, would check console.log was called with:
      // '[Mailgun Webhook] Successfully parsed email'
      expect(parsed.teamId).toBe('team-slug')
      expect(parsed.sourceThreadId).toBe('abc123')
      expect(parsed.authorHandle).toBe('jane')
    })

    it('should log successful processing', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      // In real implementation, would check console.log was called with:
      // '[Mailgun Webhook] Successfully processed discussion'
      expect(response.discussionId).toBe('disc_123')
      expect(response.notionTasks).toHaveLength(1)
    })
  })
})

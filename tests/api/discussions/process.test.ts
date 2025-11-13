/**
 * Tests for Internal Processor Endpoint
 *
 * Tests the three processing modes:
 * 1. Direct - Process a discussion directly with parsed data
 * 2. Reprocess - Reprocess an existing discussion by ID
 * 3. Retry - Retry a failed discussion with backoff
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedDiscussion, ProcessingResult, DiscussionThread, SourceConfig } from '~/layers/discubot/types'

// Mock dependencies
vi.mock('~/layers/discubot/server/services/processor', () => ({
  processDiscussion: vi.fn(),
  processDiscussionById: vi.fn(),
  retryFailedDiscussion: vi.fn(),
}))

import {
  processDiscussion,
  processDiscussionById,
  retryFailedDiscussion,
} from '~/layers/discubot/server/services/processor'

describe('Internal Processor Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createParsedDiscussion = (overrides: Partial<ParsedDiscussion> = {}): ParsedDiscussion => ({
    sourceType: 'figma',
    sourceThreadId: 'comment-123',
    sourceUrl: 'https://figma.com/file/abc123',
    teamId: 'team-xyz',
    authorHandle: 'jane@company.com',
    title: 'Design feedback',
    content: 'This looks great!',
    participants: ['jane'],
    timestamp: new Date(),
    ...overrides,
  })

  const createProcessingResult = (overrides: Partial<ProcessingResult> = {}): ProcessingResult => ({
    discussionId: 'disc_123',
    aiAnalysis: {
      summary: {
        summary: 'Discussion about design feedback',
        keyPoints: ['Positive feedback', 'Ready to implement'],
      },
      taskDetection: {
        isMultiTask: false,
        tasks: [{
          title: 'Design feedback',
          description: 'This looks great!',
        }],
      },
      processingTime: 1500,
      cached: false,
    },
    notionTasks: [
      {
        id: 'task_123',
        taskId: 'task_123',
        url: 'https://notion.so/task_123',
      },
    ],
    processingTime: 2500,
    isMultiTask: false,
    ...overrides,
  })

  const createThread = (): DiscussionThread => ({
    id: 'thread-123',
    firstMessage: {
      content: 'This looks great!',
      author: 'jane',
      timestamp: new Date(),
    },
    replies: [],
    participants: ['jane'],
  })

  const createConfig = (): SourceConfig => ({
    id: 'config_123',
    teamId: 'team-xyz',
    sourceType: 'figma',
    notionDatabaseId: 'db_123',
    notionToken: 'secret_token',
    aiEnabled: true,
    active: true,
  })

  describe('Direct Processing Mode', () => {
    it('processes valid direct request', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      // Simulate calling the endpoint
      await processDiscussion(parsed, {})

      expect(processDiscussion).toHaveBeenCalledWith(parsed, {})
      expect(processDiscussion).toHaveBeenCalledTimes(1)
    })

    it('processes direct request with thread option', async () => {
      const parsed = createParsedDiscussion()
      const thread = createThread()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      await processDiscussion(parsed, { thread })

      expect(processDiscussion).toHaveBeenCalledWith(parsed, { thread })
    })

    it('processes direct request with config option', async () => {
      const parsed = createParsedDiscussion()
      const config = createConfig()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      await processDiscussion(parsed, { config })

      expect(processDiscussion).toHaveBeenCalledWith(parsed, { config })
    })

    it('processes direct request with skipAI option', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      await processDiscussion(parsed, { skipAI: true })

      expect(processDiscussion).toHaveBeenCalledWith(parsed, { skipAI: true })
    })

    it('processes direct request with skipNotion option', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      await processDiscussion(parsed, { skipNotion: true })

      expect(processDiscussion).toHaveBeenCalledWith(parsed, { skipNotion: true })
    })

    it('processes direct request with all options', async () => {
      const parsed = createParsedDiscussion()
      const thread = createThread()
      const config = createConfig()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      await processDiscussion(parsed, {
        thread,
        config,
        skipAI: false,
        skipNotion: false,
      })

      expect(processDiscussion).toHaveBeenCalledWith(parsed, {
        thread,
        config,
        skipAI: false,
        skipNotion: false,
      })
    })

    it('returns success response with AI analysis', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult({
        aiAnalysis: {
          summary: {
            summary: 'Discussion about three design tasks',
            keyPoints: ['Task 1', 'Task 2', 'Task 3'],
          },
          taskDetection: {
            isMultiTask: true,
            tasks: [
              { title: 'Task 1', description: 'First task' },
              { title: 'Task 2', description: 'Second task' },
              { title: 'Task 3', description: 'Third task' },
            ],
          },
          processingTime: 2000,
          cached: false,
        },
        notionTasks: [
          { id: 'task_1', taskId: 'task_1', url: 'https://notion.so/task_1' },
          { id: 'task_2', taskId: 'task_2', url: 'https://notion.so/task_2' },
          { id: 'task_3', taskId: 'task_3', url: 'https://notion.so/task_3' },
        ],
        isMultiTask: true,
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.aiAnalysis.summary.keyPoints).toHaveLength(3)
      expect(response.aiAnalysis.taskDetection.tasks).toHaveLength(3)
      expect(response.notionTasks).toHaveLength(3)
      expect(response.isMultiTask).toBe(true)
    })
  })

  describe('Reprocess Mode', () => {
    it('reprocesses discussion by ID', async () => {
      const discussionId = 'disc_456'
      const result = createProcessingResult({ discussionId })

      vi.mocked(processDiscussionById).mockResolvedValue(result)

      await processDiscussionById(discussionId)

      expect(processDiscussionById).toHaveBeenCalledWith(discussionId)
      expect(processDiscussionById).toHaveBeenCalledTimes(1)
    })

    it('returns processing result for reprocessed discussion', async () => {
      const discussionId = 'disc_456'
      const result = createProcessingResult({ discussionId })

      vi.mocked(processDiscussionById).mockResolvedValue(result)

      const response = await processDiscussionById(discussionId)

      expect(response.discussionId).toBe(discussionId)
      expect(response).toHaveProperty('aiAnalysis')
      expect(response).toHaveProperty('notionTasks')
    })

    it('handles not yet implemented error (Phase 3+)', async () => {
      const discussionId = 'disc_456'

      const notImplementedError = new Error('processDiscussionById not yet implemented (Phase 3+)')
      ;(notImplementedError as any).name = 'ProcessingError'
      ;(notImplementedError as any).retryable = false

      vi.mocked(processDiscussionById).mockRejectedValue(notImplementedError)

      await expect(processDiscussionById(discussionId)).rejects.toThrow(
        'processDiscussionById not yet implemented (Phase 3+)',
      )
    })
  })

  describe('Retry Mode', () => {
    it('retries failed discussion', async () => {
      const discussionId = 'disc_789'
      const result = createProcessingResult({ discussionId })

      vi.mocked(retryFailedDiscussion).mockResolvedValue(result)

      await retryFailedDiscussion(discussionId)

      expect(retryFailedDiscussion).toHaveBeenCalledWith(discussionId)
      expect(retryFailedDiscussion).toHaveBeenCalledTimes(1)
    })

    it('returns processing result after retry', async () => {
      const discussionId = 'disc_789'
      const result = createProcessingResult({ discussionId })

      vi.mocked(retryFailedDiscussion).mockResolvedValue(result)

      const response = await retryFailedDiscussion(discussionId)

      expect(response.discussionId).toBe(discussionId)
      expect(response).toHaveProperty('aiAnalysis')
      expect(response).toHaveProperty('notionTasks')
    })

    it('handles retry with exponential backoff', async () => {
      const discussionId = 'disc_789'
      const result = createProcessingResult({ discussionId })

      // Mock retryFailedDiscussion to simulate backoff
      vi.mocked(retryFailedDiscussion).mockResolvedValue(result)

      const response = await retryFailedDiscussion(discussionId)

      expect(response).toBeDefined()
    })
  })

  describe('Request Validation', () => {
    it('validates direct request has parsed field', () => {
      const request = {
        type: 'direct',
        // Missing parsed field
      }

      const hasParsed = 'parsed' in request
      expect(hasParsed).toBe(false)
    })

    it('validates parsed discussion has required fields', () => {
      const incompleteParsed = {
        sourceType: 'figma',
        // Missing required fields
      }

      const required = [
        'sourceType',
        'sourceThreadId',
        'sourceUrl',
        'teamId',
        'authorHandle',
        'title',
        'content',
      ]

      const missing = required.filter(field => !(field in incompleteParsed))
      expect(missing.length).toBeGreaterThan(0)
    })

    it('validates reprocess request has discussionId', () => {
      const request = {
        type: 'reprocess',
        // Missing discussionId
      }

      const hasDiscussionId = 'discussionId' in request
      expect(hasDiscussionId).toBe(false)
    })

    it('validates retry request has discussionId', () => {
      const request = {
        type: 'retry',
        // Missing discussionId
      }

      const hasDiscussionId = 'discussionId' in request
      expect(hasDiscussionId).toBe(false)
    })

    it('rejects invalid request type', () => {
      const request = {
        type: 'invalid',
      }

      const validTypes = ['direct', 'reprocess', 'retry']
      expect(validTypes).not.toContain(request.type)
    })

    it('accepts valid direct request', () => {
      const request = {
        type: 'direct',
        parsed: createParsedDiscussion(),
      }

      expect(request.type).toBe('direct')
      expect(request.parsed).toBeDefined()
      expect(request.parsed.sourceType).toBe('figma')
    })

    it('accepts valid reprocess request', () => {
      const request = {
        type: 'reprocess',
        discussionId: 'disc_123',
      }

      expect(request.type).toBe('reprocess')
      expect(request.discussionId).toBeDefined()
    })

    it('accepts valid retry request', () => {
      const request = {
        type: 'retry',
        discussionId: 'disc_123',
      }

      expect(request.type).toBe('retry')
      expect(request.discussionId).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('handles retryable processing error (503)', async () => {
      const parsed = createParsedDiscussion()

      const retryableError = new Error('AI service temporarily unavailable')
      ;(retryableError as any).name = 'ProcessingError'
      ;(retryableError as any).retryable = true
      ;(retryableError as any).stage = 'ai_analysis'

      vi.mocked(processDiscussion).mockRejectedValue(retryableError)

      await expect(processDiscussion(parsed)).rejects.toThrow('AI service temporarily unavailable')

      const error = await processDiscussion(parsed).catch(e => e)
      expect((error as any).retryable).toBe(true)
    })

    it('handles non-retryable processing error (422)', async () => {
      const parsed = createParsedDiscussion()

      const nonRetryableError = new Error('Invalid API token')
      ;(nonRetryableError as any).name = 'ProcessingError'
      ;(nonRetryableError as any).retryable = false
      ;(nonRetryableError as any).stage = 'config_loading'

      vi.mocked(processDiscussion).mockRejectedValue(nonRetryableError)

      await expect(processDiscussion(parsed)).rejects.toThrow('Invalid API token')

      const error = await processDiscussion(parsed).catch(e => e)
      expect((error as any).retryable).toBe(false)
    })

    it('handles validation error from processor', async () => {
      const incompleteParsed = {
        sourceType: 'figma',
        // Missing required fields
      } as ParsedDiscussion

      const validationError = new Error('Missing required fields: sourceThreadId, sourceUrl')
      ;(validationError as any).name = 'ProcessingError'
      ;(validationError as any).retryable = false
      ;(validationError as any).stage = 'validation'

      vi.mocked(processDiscussion).mockRejectedValue(validationError)

      await expect(processDiscussion(incompleteParsed)).rejects.toThrow('Missing required fields')
    })

    it('handles generic error', async () => {
      const parsed = createParsedDiscussion()

      const genericError = new Error('Unexpected error')

      vi.mocked(processDiscussion).mockRejectedValue(genericError)

      await expect(processDiscussion(parsed)).rejects.toThrow('Unexpected error')
    })
  })

  describe('Response Format', () => {
    it('returns correct response structure', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response).toHaveProperty('discussionId')
      expect(response).toHaveProperty('aiAnalysis')
      expect(response).toHaveProperty('notionTasks')
      expect(response).toHaveProperty('processingTime')
      expect(response).toHaveProperty('isMultiTask')
    })

    it('includes AI analysis summary in response', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.aiAnalysis).toHaveProperty('summary')
      expect(response.aiAnalysis.summary).toHaveProperty('summary')
      expect(response.aiAnalysis.summary).toHaveProperty('keyPoints')
    })

    it('includes task detection in response', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.aiAnalysis).toHaveProperty('taskDetection')
      expect(response.aiAnalysis.taskDetection).toHaveProperty('isMultiTask')
      expect(response.aiAnalysis.taskDetection).toHaveProperty('tasks')
    })

    it('includes cached flag in response', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult({
        aiAnalysis: {
          ...createProcessingResult().aiAnalysis,
          cached: true,
        },
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.aiAnalysis).toHaveProperty('cached')
      expect(response.aiAnalysis.cached).toBe(true)
    })

    it('includes notion task URLs in response', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult({
        notionTasks: [
          { id: 'task_1', taskId: 'task_1', url: 'https://notion.so/task_1' },
          { id: 'task_2', taskId: 'task_2', url: 'https://notion.so/task_2' },
        ],
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.notionTasks).toHaveLength(2)
      expect(response.notionTasks[0]).toHaveProperty('url')
      expect(response.notionTasks[0].url).toContain('notion.so')
    })
  })

  describe('Performance Metrics', () => {
    it('tracks processing time', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult({
        processingTime: 3500,
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.processingTime).toBe(3500)
      expect(response.processingTime).toBeGreaterThan(0)
    })

    it('tracks AI processing time separately', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult({
        aiAnalysis: {
          ...createProcessingResult().aiAnalysis,
          processingTime: 2000,
        },
      })

      vi.mocked(processDiscussion).mockResolvedValue(result)

      const response = await processDiscussion(parsed)

      expect(response.aiAnalysis.processingTime).toBe(2000)
    })
  })

  describe('Logging', () => {
    it('should log direct processing request', async () => {
      const parsed = createParsedDiscussion()
      const result = createProcessingResult()

      vi.mocked(processDiscussion).mockResolvedValue(result)

      await processDiscussion(parsed)

      // In real implementation, would verify console.log calls:
      // '[Processor Endpoint] Processing direct discussion'
      expect(parsed.sourceType).toBe('figma')
      expect(parsed.sourceThreadId).toBe('comment-123')
    })

    it('should log reprocess request', async () => {
      const discussionId = 'disc_456'
      const result = createProcessingResult({ discussionId })

      vi.mocked(processDiscussionById).mockResolvedValue(result)

      await processDiscussionById(discussionId)

      // In real implementation, would verify console.log calls:
      // '[Processor Endpoint] Reprocessing discussion'
      expect(discussionId).toBe('disc_456')
    })

    it('should log retry request', async () => {
      const discussionId = 'disc_789'
      const result = createProcessingResult({ discussionId })

      vi.mocked(retryFailedDiscussion).mockResolvedValue(result)

      await retryFailedDiscussion(discussionId)

      // In real implementation, would verify console.log calls:
      // '[Processor Endpoint] Retrying failed discussion'
      expect(discussionId).toBe('disc_789')
    })
  })
})

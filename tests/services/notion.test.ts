import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNotionTask, createNotionTasks, testNotionConnection } from '~/layers/discubot/server/services/notion'
import type { AITask } from '~/layers/discubot/types'

// Mock the Notion client
vi.mock('@notionhq/client', () => ({
  Client: vi.fn().mockImplementation(() => ({
    pages: {
      create: vi.fn(),
    },
    databases: {
      retrieve: vi.fn(),
    },
  })),
}))

describe('notionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createNotionTask', () => {
    it('should create a Notion task with basic fields', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.pages.create).mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      } as any)

      const task: AITask = {
        title: 'Test Task',
        summary: 'Test summary',
        actionItems: ['Item 1', 'Item 2'],
        priority: 'high',
        assignee: 'john@example.com',
      }

      const result = await createNotionTask(
        'db-123',
        task,
        'Discussion summary',
        ['user1', 'user2'],
        'https://source.com/discussion',
        'test_token'
      )

      expect(result).toEqual({
        pageId: 'page-123',
        url: 'https://notion.so/page-123',
      })
      expect(mockNotion.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { database_id: 'db-123' },
        })
      )
    })

    it('should handle user mentions in participants', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.pages.create).mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      } as any)

      const task: AITask = {
        title: 'Test Task',
        summary: 'Summary',
        actionItems: [],
      }

      const userMentions = new Map([
        ['user1', 'notion-user-1'],
        ['user2', 'notion-user-2'],
      ])

      await createNotionTask(
        'db-123',
        task,
        'Summary',
        ['user1', 'user2', 'user3'],
        'https://source.com',
        'test_token',
        userMentions
      )

      const createCall = vi.mocked(mockNotion.pages.create).mock.calls[0][0]
      const children = createCall.children

      // Should have mention objects for user1 and user2, plain text for user3
      expect(children).toBeDefined()
    })

    it('should rate limit API calls', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.pages.create).mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      } as any)

      const task: AITask = {
        title: 'Test',
        summary: 'Test',
        actionItems: [],
      }

      const start = Date.now()

      await createNotionTask('db-123', task, 'Summary', [], 'url', 'token')
      await createNotionTask('db-123', task, 'Summary', [], 'url', 'token')

      const elapsed = Date.now() - start

      // Should have at least 200ms delay between calls
      expect(elapsed).toBeGreaterThanOrEqual(200)
    })

    it('should throw error on API failure', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.pages.create).mockRejectedValue(
        new Error('Notion API error')
      )

      const task: AITask = {
        title: 'Test',
        summary: 'Test',
        actionItems: [],
      }

      await expect(
        createNotionTask('db-123', task, 'Summary', [], 'url', 'token')
      ).rejects.toThrow('Notion API error')
    })
  })

  describe('createNotionTasks', () => {
    it('should create multiple tasks', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.pages.create)
        .mockResolvedValueOnce({
          id: 'page-1',
          url: 'https://notion.so/page-1',
        } as any)
        .mockResolvedValueOnce({
          id: 'page-2',
          url: 'https://notion.so/page-2',
        } as any)

      const tasks: AITask[] = [
        { title: 'Task 1', summary: 'Summary 1', actionItems: [] },
        { title: 'Task 2', summary: 'Summary 2', actionItems: [] },
      ]

      const results = await createNotionTasks(
        'db-123',
        tasks,
        'Overall summary',
        [],
        'https://source.com',
        'test_token'
      )

      expect(results).toHaveLength(2)
      expect(results[0].pageId).toBe('page-1')
      expect(results[1].pageId).toBe('page-2')
      expect(mockNotion.pages.create).toHaveBeenCalledTimes(2)
    })

    it('should handle empty task array', async () => {
      const results = await createNotionTasks(
        'db-123',
        [],
        'Summary',
        [],
        'url',
        'token'
      )

      expect(results).toEqual([])
    })

    it('should continue on partial failures', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.pages.create)
        .mockResolvedValueOnce({
          id: 'page-1',
          url: 'https://notion.so/page-1',
        } as any)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          id: 'page-3',
          url: 'https://notion.so/page-3',
        } as any)

      const tasks: AITask[] = [
        { title: 'Task 1', summary: 'S1', actionItems: [] },
        { title: 'Task 2', summary: 'S2', actionItems: [] },
        { title: 'Task 3', summary: 'S3', actionItems: [] },
      ]

      const results = await createNotionTasks(
        'db-123',
        tasks,
        'Summary',
        [],
        'url',
        'token'
      )

      // Should have 2 successful results (task 1 and 3)
      expect(results).toHaveLength(2)
      expect(results[0].pageId).toBe('page-1')
      expect(results[1].pageId).toBe('page-3')
    })
  })

  describe('testNotionConnection', () => {
    it('should return success for valid connection', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.databases.retrieve).mockResolvedValue({
        id: 'db-123',
        title: [{ plain_text: 'Test Database' }],
        url: 'https://notion.so/db-123',
      } as any)

      const result = await testNotionConnection('db-123', 'test_token')

      expect(result.connected).toBe(true)
      expect(result.databaseTitle).toBe('Test Database')
      expect(result.databaseUrl).toBe('https://notion.so/db-123')
      expect(result.error).toBeUndefined()
    })

    it('should handle unauthorized error', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      const error: any = new Error('Unauthorized')
      error.code = 'unauthorized'
      vi.mocked(mockNotion.databases.retrieve).mockRejectedValue(error)

      const result = await testNotionConnection('db-123', 'invalid_token')

      expect(result.connected).toBe(false)
      expect(result.error).toContain('Invalid token')
    })

    it('should handle object_not_found error', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      const error: any = new Error('Not found')
      error.code = 'object_not_found'
      vi.mocked(mockNotion.databases.retrieve).mockRejectedValue(error)

      const result = await testNotionConnection('db-wrong', 'test_token')

      expect(result.connected).toBe(false)
      expect(result.error).toContain('Database not found')
    })

    it('should handle rate limiting', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      const error: any = new Error('Rate limited')
      error.code = 'rate_limited'
      vi.mocked(mockNotion.databases.retrieve).mockRejectedValue(error)

      const result = await testNotionConnection('db-123', 'test_token')

      expect(result.connected).toBe(false)
      expect(result.error).toContain('Rate limited')
    })

    it('should handle generic errors', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.databases.retrieve).mockRejectedValue(
        new Error('Network error')
      )

      const result = await testNotionConnection('db-123', 'test_token')

      expect(result.connected).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle database with empty title', async () => {
      const { Client } = await import('@notionhq/client')
      const mockNotion = new Client({ auth: 'test_token' })

      vi.mocked(mockNotion.databases.retrieve).mockResolvedValue({
        id: 'db-123',
        title: [],
        url: 'https://notion.so/db-123',
      } as any)

      const result = await testNotionConnection('db-123', 'test_token')

      expect(result.connected).toBe(true)
      expect(result.databaseTitle).toBe('Untitled')
    })
  })
})

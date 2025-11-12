/**
 * Notion Service - Task Creation in Notion Databases
 *
 * Provides:
 * - Generic task creation from any source (Figma, Slack, etc.)
 * - Rich content blocks with AI summaries and action items
 * - Rate limiting (200ms delays between tasks)
 * - Retry logic with exponential backoff
 * - Official Notion SDK integration
 *
 * Design decisions:
 * - Only uses "Name" property to avoid database-specific property errors
 * - All other data goes into page content blocks
 * - Generic metadata section works for any source type
 * - Functional exports (not class-based)
 */

import { Client } from '@notionhq/client'
import type {
  AISummary,
  DetectedTask,
  DiscussionThread,
  NotionTaskConfig,
  NotionTaskResult,
} from '../../types'
import { retryWithBackoff } from '../utils/retry'

/**
 * Initialize Notion client
 * Uses API key from config parameter, runtime config, or environment variable
 *
 * Checks in this order:
 * 1. apiKey parameter (passed explicitly)
 * 2. Environment variable (for standalone testing)
 * 3. Nuxt runtime config (for Nuxt context)
 */
function getNotionClient(apiKey?: string): Client {
  let key = apiKey || process.env.NOTION_API_KEY

  // Try Nuxt runtime config if not in env (and if available)
  if (!key) {
    try {
      const config = useRuntimeConfig()
      key = config.notionApiKey
    }
    catch {
      // useRuntimeConfig not available (standalone testing)
    }
  }

  if (!key) {
    throw new Error('NOTION_API_KEY is not configured')
  }

  return new Client({ auth: key })
}

/**
 * Build Notion properties from task data
 *
 * Strategy: Only use "Name" (title) property to avoid errors.
 * All other data goes into the page content blocks.
 */
function buildTaskProperties(task: DetectedTask): Record<string, any> {
  return {
    Name: {
      title: [
        {
          text: { content: task.title.substring(0, 2000) },
        },
      ],
    },
  }
}

/**
 * Build rich content blocks for Notion page
 *
 * Generic structure that works for any source type:
 * - AI Summary callout
 * - Action items as checkboxes
 * - Participants list
 * - Thread content
 * - Generic metadata section
 * - Deep link back to source
 */
function buildTaskContent(
  task: DetectedTask,
  thread: DiscussionThread,
  aiSummary: AISummary,
  config: NotionTaskConfig,
): any[] {
  const blocks: any[] = []

  // AI Summary callout
  if (aiSummary.summary) {
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        icon: { emoji: '🤖' },
        rich_text: [
          {
            type: 'text',
            text: { content: `AI Summary: ${aiSummary.summary}` },
          },
        ],
      },
    })
  }

  // Action items as checkboxes
  if (aiSummary.keyPoints && aiSummary.keyPoints.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'text',
            text: { content: '📋 Key Action Items' },
          },
        ],
      },
    })

    for (const point of aiSummary.keyPoints) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          checked: false,
          rich_text: [
            {
              type: 'text',
              text: { content: point },
            },
          ],
        },
      })
    }
  }

  // Participants
  if (thread.participants.length > 0) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `👥 Participants: ${thread.participants.join(', ')}` },
          },
        ],
      },
    })
  }

  // Divider
  blocks.push({
    object: 'block',
    type: 'divider',
    divider: {},
  })

  // Thread content
  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [
        {
          type: 'text',
          text: { content: 'Thread Content' },
        },
      ],
    },
  })

  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: { content: task.description.substring(0, 2000) },
        },
      ],
    },
  })

  // Divider
  blocks.push({
    object: 'block',
    type: 'divider',
    divider: {},
  })

  // Metadata section (generic for any source)
  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [
        {
          type: 'text',
          text: { content: 'Metadata' },
        },
      ],
    },
  })

  const metadataItems = [
    `Source: ${config.sourceType}`,
    `Thread ID: ${thread.id}`,
    `Thread Size: ${thread.replies.length + 1} messages`,
    `Created By: @${thread.rootMessage.authorHandle}`,
    `Priority: ${task.priority || 'medium'}`,
    `Sentiment: ${aiSummary.sentiment || 'neutral'}`,
    `Confidence: ${Math.round((aiSummary.confidence || 0) * 100)}%`,
    `Timestamp: ${new Date().toLocaleString()}`,
  ]

  if (task.assignee) {
    metadataItems.push(`Assignee: @${task.assignee}`)
  }

  if (task.tags && task.tags.length > 0) {
    metadataItems.push(`Tags: ${task.tags.join(', ')}`)
  }

  for (const item of metadataItems) {
    blocks.push({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          {
            type: 'text',
            text: { content: item },
          },
        ],
      },
    })
  }

  // Deep link back to source
  if (config.sourceUrl) {
    blocks.push({
      object: 'block',
      type: 'divider',
      divider: {},
    })

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: '🔗 ' },
          },
          {
            type: 'text',
            text: {
              content: `View Discussion in ${config.sourceType}`,
              link: { url: config.sourceUrl },
            },
            annotations: {
              bold: true,
              color: 'blue',
            },
          },
        ],
      },
    })
  }

  return blocks
}

/**
 * Create a single task in Notion
 *
 * Uses retry logic for transient failures.
 */
export async function createNotionTask(
  task: DetectedTask,
  thread: DiscussionThread,
  aiSummary: AISummary,
  config: NotionTaskConfig,
): Promise<NotionTaskResult> {
  console.log('[Notion Service] Creating task:', {
    title: task.title,
    databaseId: config.databaseId,
    sourceType: config.sourceType,
  })

  const notion = getNotionClient(config.apiKey)
  const properties = buildTaskProperties(task)
  const children = buildTaskContent(task, thread, aiSummary, config)

  const startTime = Date.now()

  const page = await retryWithBackoff(
    () =>
      notion.pages.create({
        parent: { database_id: config.databaseId },
        properties,
        children,
      }),
    {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    },
  )

  const duration = Date.now() - startTime

  console.log(
    `[Notion Service] Task created successfully in ${duration}ms:`,
    page.id,
  )

  return {
    id: page.id,
    url: page.url,
    createdAt: new Date(),
  }
}

/**
 * Create multiple tasks in Notion with rate limiting
 *
 * Processes tasks sequentially with 200ms delays to respect
 * Notion's 3 requests/second rate limit.
 *
 * Fails fast - stops on first error to avoid partial imports.
 */
export async function createNotionTasks(
  tasks: DetectedTask[],
  thread: DiscussionThread,
  aiSummary: AISummary,
  config: NotionTaskConfig,
): Promise<NotionTaskResult[]> {
  console.log('[Notion Service] Creating batch of tasks:', {
    taskCount: tasks.length,
    titles: tasks.map(t => t.title),
  })

  const results: NotionTaskResult[] = []
  const startTime = Date.now()

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    try {
      const result = await createNotionTask(task, thread, aiSummary, config)
      results.push(result)

      console.log(
        `[Notion Service] Created task ${i + 1}/${tasks.length}: ${result.id}`,
      )

      // Rate limiting: 200ms delay between requests (respects 3 req/sec limit)
      if (i < tasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    catch (error) {
      console.error(
        `[Notion Service] Failed to create task "${task.title}":`,
        error,
      )
      throw error // Fail fast on errors
    }
  }

  const duration = Date.now() - startTime

  console.log(
    `[Notion Service] Successfully created ${results.length} tasks in ${duration}ms`,
  )

  return results
}

/**
 * Test Notion connection and database access
 *
 * Useful for Admin UI validation in Phase 5.
 * Verifies:
 * - API key is valid
 * - Database exists and is accessible
 */
export async function testNotionConnection(
  databaseId: string,
  apiKey: string,
): Promise<boolean> {
  try {
    const notion = getNotionClient(apiKey)

    await retryWithBackoff(
      () => notion.databases.retrieve({ database_id: databaseId }),
      {
        maxAttempts: 2,
        baseDelay: 500,
      },
    )

    console.log('[Notion Service] Connection test successful')
    return true
  }
  catch (error) {
    console.error('[Notion Service] Connection test failed:', error)
    return false
  }
}

/**
 * Format a value as a Notion property based on property type
 *
 * Adapted from figno's notionIntegration.ts but kept generic.
 * Used for future property mapping support (Phase 5+).
 */
export function formatNotionProperty(
  value: any,
  propertyType: string,
): any {
  switch (propertyType) {
    case 'title':
      return {
        title: [
          {
            text: { content: String(value).substring(0, 2000) },
          },
        ],
      }

    case 'rich_text':
      return {
        rich_text: [
          {
            text: { content: String(value).substring(0, 2000) },
          },
        ],
      }

    case 'number':
      return {
        number: Number(value) || 0,
      }

    case 'select':
      return {
        select: { name: String(value) },
      }

    case 'multi_select': {
      const values = Array.isArray(value) ? value : [value]
      return {
        multi_select: values.map(v => ({ name: String(v) })),
      }
    }

    case 'date':
      return {
        date: {
          start: value instanceof Date ? value.toISOString() : String(value),
        },
      }

    case 'checkbox':
      return {
        checkbox: Boolean(value),
      }

    case 'url':
      return {
        url: String(value),
      }

    case 'email':
      return {
        email: String(value),
      }

    case 'phone_number':
      return {
        phone_number: String(value),
      }

    default:
      // Fallback to rich_text for unknown types
      return {
        rich_text: [
          {
            text: { content: String(value).substring(0, 2000) },
          },
        ],
      }
  }
}

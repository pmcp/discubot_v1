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

import type {
  AISummary,
  DetectedTask,
  DiscussionThread,
  NotionTaskConfig,
  NotionTaskResult,
} from '#layers/discubot/types'
import { retryWithBackoff } from '../utils/retry'

/**
 * Notion API Version
 * https://developers.notion.com/reference/versioning
 */
const NOTION_API_VERSION = '2022-06-28'

/**
 * Get Notion API key from config, runtime, or environment
 *
 * Checks in this order:
 * 1. apiKey parameter (passed explicitly)
 * 2. Environment variable (for standalone testing)
 * 3. Nuxt runtime config (for Nuxt context)
 */
function getNotionApiKey(apiKey?: string): string {
  let key = apiKey || process.env.NOTION_API_KEY

  // Try Nuxt runtime config if not in env (and if available)
  if (!key) {
    try {
      const config = useRuntimeConfig()
      key = config.notionApiKey as string | undefined
    }
    catch {
      // useRuntimeConfig not available (standalone testing)
    }
  }

  if (!key) {
    throw new Error('NOTION_API_KEY is not configured')
  }

  return key
}

/**
 * Make a request to the Notion API using edge-compatible fetch
 *
 * Replaces the @notionhq/client SDK for Cloudflare Workers compatibility.
 *
 * @see https://developers.notion.com/reference/intro
 */
async function notionRequest(
  endpoint: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    apiKey: string
    body?: any
  }
): Promise<any> {
  const url = `https://api.notion.com/v1/${endpoint}`

  const response = await $fetch(url, {
    method: options.method,
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  return response
}

/**
 * Build Notion properties from task data
 *
 * Strategy: Use "Name" (title) property + apply field mappings for other properties.
 * Field mappings allow smart population of Notion database properties like Priority, Assignee, etc.
 *
 * @param task - Detected task with AI-generated fields
 * @param fieldMapping - Optional field mapping configuration from config.notionFieldMapping
 * @param userMappings - Optional map of source user IDs to Notion user IDs for assignee field
 */
async function buildTaskProperties(
  task: DetectedTask,
  fieldMapping?: Record<string, any>,
  userMappings?: Map<string, string>,
): Promise<Record<string, any>> {
  const properties: Record<string, any> = {
    Name: {
      title: [
        {
          text: { content: task.title.substring(0, 2000) },
        },
      ],
    },
  }

  // If no field mapping provided, return basic properties
  if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
    return properties
  }

  // Import transformValue utility for select field value transformation
  const { transformValue } = await import('../utils/field-mapping')

  // Map AI fields to Notion properties based on field mapping
  const aiFieldValues: Record<string, any> = {
    priority: task.priority,
    type: task.type,
    assignee: task.assignee,
    dueDate: task.dueDate,
    tags: task.tags,
  }

  for (const [aiField, value] of Object.entries(aiFieldValues)) {
    // Skip if value is null/undefined
    if (value == null) {
      continue
    }

    // Check if this field has a mapping
    const mapping = fieldMapping[aiField]
    if (!mapping || !mapping.notionProperty) {
      continue
    }

    const { notionProperty, propertyType, valueMap } = mapping

    // Special handling for 'people' type (assignee field)
    if (propertyType === 'people') {
      console.log(`[Notion] 🔍 Assignee Mapping Debug - AI extracted assignee: "${value}"`)
      console.log(`[Notion] 🔍 Assignee Mapping Debug - User mappings available: ${userMappings ? userMappings.size : 0}`)

      if (!userMappings) {
        console.warn(`[Notion] ❌ No user mappings Map provided for assignee field: ${value}`)
        continue
      }

      if (userMappings.size === 0) {
        console.warn(`[Notion] ⚠️  User mappings Map is empty - no mappings to lookup`)
      } else {
        console.log(`[Notion] 🔍 Available mapping keys: ${Array.from(userMappings.keys()).join(', ')}`)
      }

      // Resolve source user ID to Notion user ID
      const lookupKey = String(value)
      console.log(`[Notion] 🔍 Looking up key: "${lookupKey}"`)
      const notionUserId = userMappings.get(lookupKey)

      if (!notionUserId) {
        console.warn(`[Notion] ❌ No user mapping found for assignee: "${value}"`)
        console.warn(`[Notion] 💡 Tip: Ensure sourceUserId in your mapping exactly matches: "${value}"`)
        continue
      }

      console.log(`[Notion] ✅ Found mapping: ${value} -> ${notionUserId}`)

      const formattedProperty = formatNotionProperty(notionUserId, propertyType)
      if (formattedProperty) {
        properties[notionProperty] = formattedProperty
        console.log(`[Notion] ✅ Successfully mapped assignee: ${value} -> ${notionUserId} to property "${notionProperty}"`)
      } else {
        console.warn(`[Notion] ⚠️  formatNotionProperty returned null for assignee: ${notionUserId}`)
      }
      continue
    }

    // Handle value transformation for select/multi_select/status fields
    let transformedValue = value
    if (propertyType === 'select' || propertyType === 'multi_select' || propertyType === 'status') {
      // For these types, we need to transform the AI value to match Notion's options
      // The valueMap in the mapping config provides explicit transformations
      if (typeof value === 'string') {
        transformedValue = transformValue(value, undefined, valueMap) || value
      }
    }

    // Format and add the property
    const formattedProperty = formatNotionProperty(transformedValue, propertyType)
    if (formattedProperty) {
      properties[notionProperty] = formattedProperty
      console.log(`[Notion] Mapped ${aiField}: ${value} -> ${notionProperty} (${propertyType})`)
    }
  }

  return properties
}

/**
 * Build rich content blocks for Notion page
 *
 * Generic structure that works for any source type:
 * - AI Summary callout
 * - Action items as checkboxes
 * - Participants list with @mentions (if userMentions provided)
 * - Thread content
 * - Generic metadata section
 * - Deep link back to source
 *
 * @param userMentions - Optional map of source user IDs to Notion user IDs for @mentions
 */
function buildTaskContent(
  task: DetectedTask,
  thread: DiscussionThread,
  aiSummary: AISummary,
  config: NotionTaskConfig,
  userMentions?: Map<string, string>,
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

  // Participants with @mentions (if userMentions provided)
  if (thread.participants.length > 0) {
    console.log(`[Notion] 💬 Building participants section with ${thread.participants.length} participants`)
    console.log(`[Notion] 💬 User mentions available: ${userMentions ? userMentions.size : 0}`)

    const participantRichText: any[] = [
      {
        type: 'text',
        text: { content: '👥 Participants: ' },
      },
    ]

    // Build rich text with @mentions for each participant
    for (let i = 0; i < thread.participants.length; i++) {
      const participantId = thread.participants[i]
      if (!participantId) continue

      // Try to get Notion user ID for mention
      const notionUserId = userMentions?.get(participantId)

      if (notionUserId) {
        // Add proper @mention
        console.log(`[Notion] ✅ Creating @mention for participant ${participantId} → ${notionUserId}`)
        participantRichText.push({
          type: 'mention',
          mention: {
            type: 'user',
            user: {
              id: notionUserId,
            },
          },
        })
      }
      else {
        // Fallback to plain text if no mapping
        console.log(`[Notion] ⚠️  No mention mapping for participant ${participantId}, using plain text`)
        participantRichText.push({
          type: 'text',
          text: { content: `@${participantId}` },
        })
      }

      // Add separator between participants (except for last one)
      if (i < thread.participants.length - 1) {
        participantRichText.push({
          type: 'text',
          text: { content: ', ' },
        })
      }
    }

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: participantRichText,
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
 *
 * @param userMentions - Optional map of source user IDs to Notion user IDs for @mentions
 */
export async function createNotionTask(
  task: DetectedTask,
  thread: DiscussionThread,
  aiSummary: AISummary,
  config: NotionTaskConfig,
  userMentions?: Map<string, string>,
  fieldMapping?: Record<string, any>,
  userMappings?: Map<string, string>,
): Promise<NotionTaskResult> {
  console.log('[Notion Service] Creating task:', {
    title: task.title,
    databaseId: config.databaseId,
    sourceType: config.sourceType,
  })

  const apiKey = getNotionApiKey(config.apiKey)
  const properties = await buildTaskProperties(task, fieldMapping, userMappings)
  const children = buildTaskContent(task, thread, aiSummary, config, userMentions)

  const startTime = Date.now()

  const page = await retryWithBackoff(
    () =>
      notionRequest('pages', {
        method: 'POST',
        apiKey,
        body: {
          parent: { database_id: config.databaseId },
          properties,
          children,
        },
      }),
    {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      timeout: 15000, // 15 second timeout to prevent hanging
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
 *
 * @param userMentions - Optional map of source user IDs to Notion user IDs for @mentions
 * @param fieldMapping - Optional field mapping configuration from config.notionFieldMapping
 * @param userMappings - Optional map of source user IDs to Notion user IDs for assignee field
 */
export async function createNotionTasks(
  tasks: DetectedTask[],
  thread: DiscussionThread,
  aiSummary: AISummary,
  config: NotionTaskConfig,
  userMentions?: Map<string, string>,
  fieldMapping?: Record<string, any>,
  userMappings?: Map<string, string>,
): Promise<NotionTaskResult[]> {
  console.log('[Notion Service] Creating batch of tasks:', {
    taskCount: tasks.length,
    titles: tasks.map(t => t.title),
  })

  const results: NotionTaskResult[] = []
  const startTime = Date.now()

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (!task) continue

    try {
      const result = await createNotionTask(task, thread, aiSummary, config, userMentions, fieldMapping, userMappings)
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
        `[Notion Service] Failed to create task "${task?.title}":`,
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
 * Result of Notion connection test
 */
export interface NotionConnectionTestResult {
  connected: boolean
  details?: {
    databaseId: string
    title: string
    url: string
  }
  error?: string
}

/**
 * Test Notion connection and database access
 *
 * Enhanced version for Admin UI validation (Phase 5.5).
 * Verifies:
 * - API key is valid
 * - Database exists and is accessible
 * - Returns database details (title, URL) on success
 *
 * @param config - Configuration with API key and database ID
 * @returns Test result with connection status and details/error
 */
export async function testNotionConnection(config: {
  apiKey: string
  databaseId: string
}): Promise<NotionConnectionTestResult> {
  try {
    const apiKey = getNotionApiKey(config.apiKey)

    const database: any = await retryWithBackoff(
      () => notionRequest(`databases/${config.databaseId}`, {
        method: 'GET',
        apiKey,
      }),
      {
        maxAttempts: 2,
        baseDelay: 500,
        timeout: 10000, // 10 second timeout
      },
    )

    // Extract database title (can be in different formats)
    let title = 'Untitled Database'
    if (database.title && Array.isArray(database.title) && database.title.length > 0) {
      title = database.title[0]?.plain_text || title
    }

    console.log('[Notion Service] Connection test successful', {
      databaseId: config.databaseId,
      title,
    })

    return {
      connected: true,
      details: {
        databaseId: config.databaseId,
        title,
        url: database.url || `https://notion.so/${config.databaseId.replace(/-/g, '')}`,
      },
    }
  }
  catch (error) {
    console.error('[Notion Service] Connection test failed:', error)

    const errorMessage = (error as any).body?.message
      || (error as Error).message
      || 'Unknown error'

    return {
      connected: false,
      error: errorMessage,
    }
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

    case 'people': {
      // Handle array of user IDs for people fields
      const userIds = Array.isArray(value) ? value : [value]
      // Filter out null/undefined values
      const validIds = userIds.filter(id => id != null)

      if (validIds.length === 0) {
        return null
      }

      return {
        people: validIds.map(id => ({
          object: 'user',
          id: String(id),
        })),
      }
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

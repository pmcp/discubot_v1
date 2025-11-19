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
import { logger } from '../utils/logger'

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

  try {
    // Log sanitized request body for debugging
    if (options.body) {
      logger.debug('Notion API request', {
        url,
        method: options.method,
        bodyPreview: JSON.stringify(options.body).substring(0, 200),
      })
    }

    const response = await $fetch(url, {
      method: options.method,
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    logger.debug('Notion API request successful', { url })
    return response
  } catch (error: any) {
    // Extract detailed error information from Notion API
    const errorDetails = error.data || error.response?._data || {}
    logger.error('Notion API request failed', error, {
      url,
      method: options.method,
      status: error.status || error.statusCode,
      statusText: error.statusText,
      message: error.message,
      notionErrorMessage: errorDetails.message,
      notionErrorCode: errorDetails.code,
      notionErrorDetails: errorDetails,
    })

    // Re-throw the original error
    throw error
  }
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

    const { notionProperty: rawNotionProperty, propertyType, valueMap } = mapping

    // Extract property name (handle both string and object formats from USelectMenu)
    const notionProperty = typeof rawNotionProperty === 'string'
      ? rawNotionProperty
      : rawNotionProperty?.value || rawNotionProperty?.name || null

    if (!notionProperty) {
      logger.warn('Invalid notionProperty format', { aiField, rawNotionProperty })
      continue
    }

    logger.debug('Mapping field to Notion property', { aiField, notionProperty, propertyType })

    // Special handling for 'people' type (assignee field)
    if (propertyType === 'people') {
      logger.debug('Assignee field - AI extracted value', { value })

      // Check if the value is already a Notion UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      const isNotionUuid = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

      let notionUserId: string | undefined

      if (isNotionUuid) {
        // AI returned Notion UUID directly (new flow with @Name (uuid) format)
        notionUserId = value
        logger.debug('AI returned Notion UUID directly', { notionUserId })
      } else {
        // Old flow: AI returned source user ID, need to map to Notion ID
        logger.debug('Value is not a UUID, attempting user mapping lookup', {
          value,
          userMappingsAvailable: userMappings ? userMappings.size : 0
        })

        if (!userMappings) {
          logger.warn('No user mappings Map provided for assignee field', { value })
          continue
        }

        if (userMappings.size === 0) {
          logger.warn('User mappings Map is empty - no mappings to lookup')
        } else {
          logger.debug('Available mapping keys', { keys: Array.from(userMappings.keys()) })
        }

        const lookupKey = String(value)
        logger.debug('Looking up key', { lookupKey })
        notionUserId = userMappings.get(lookupKey)

        if (!notionUserId) {
          logger.warn('No user mapping found for assignee', { value, tip: 'Ensure sourceUserId in your mapping exactly matches this value' })
          continue
        }

        logger.debug('Found mapping', { value, notionUserId })
      }

      const formattedProperty = formatNotionProperty(notionUserId, propertyType)
      if (formattedProperty) {
        properties[notionProperty] = formattedProperty
        logger.debug('Successfully set assignee to property', { notionProperty, notionUserId })
      } else {
        logger.warn('formatNotionProperty returned null for assignee', { notionUserId })
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
      logger.debug('Mapped field', { aiField, value, notionProperty, propertyType })
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

  // AI Summary callout (concise, task-focused)
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

  // Task-specific action items (NEW)
  if (task.actionItems && task.actionItems.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'text',
            text: { content: '📋 This Task Requires' },
          },
        ],
      },
    })

    for (const item of task.actionItems) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          checked: false,
          rich_text: [
            {
              type: 'text',
              text: { content: item },
            },
          ],
        },
      })
    }
  }

  // Discussion Context (collapsible) - Global insights from discussion
  if (aiSummary.keyPoints && aiSummary.keyPoints.length > 0) {
    blocks.push({
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: [
          {
            type: 'text',
            text: { content: '🔍 Discussion Context' },
            annotations: { bold: true },
          },
        ],
        children: aiSummary.keyPoints.map(point => ({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: { content: point },
              },
            ],
          },
        })),
      },
    })
  }

  // Participants with @mentions (if userMentions provided)
  if (thread.participants.length > 0) {
    logger.debug('Building participants section', {
      participantCount: thread.participants.length,
      userMentionsAvailable: userMentions ? userMentions.size : 0
    })

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
        logger.debug('Creating @mention for participant', { participantId, notionUserId })
        const mentionObject = {
          type: 'mention',
          mention: {
            type: 'user',
            user: {
              object: 'user', // Required by Notion API
              id: notionUserId,
            },
          },
        }
        logger.debug('Mention object structure', { mentionObject })
        participantRichText.push(mentionObject)
      }
      else {
        // Fallback to plain text if no mapping
        logger.debug('No mention mapping for participant, using plain text', { participantId })
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

    logger.debug('Complete participantRichText array', { participantRichText })

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

  // Thread content summary (task-specific description)
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


  // Helper to get display name (resolved name or fallback to ID)
  const getDisplayName = (authorHandle: string, authorName?: string) => {
    return authorName ? `@${authorName}` : authorHandle
  }
  // Full Discussion Thread (collapsible)
  const threadMessages: any[] = []

  // Add root message
  threadMessages.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: { content: `${thread.rootMessage.authorHandle}:` },
          annotations: { bold: true },
        },
      ],
    },
  })
  threadMessages.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: { content: thread.rootMessage.content.substring(0, 2000) },
        },
      ],
    },
  })

  // Add replies
  for (const reply of thread.replies) {
    threadMessages.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: '—' },
          },
        ],
      },
    })
    threadMessages.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `${reply.authorHandle}:` },
            annotations: { bold: true },
          },
        ],
      },
    })
    threadMessages.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: reply.content.substring(0, 2000) },
          },
        ],
      },
    })
  }

  blocks.push({
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [
        {
          type: 'text',
          text: { content: '💬 Full Discussion Thread' },
          annotations: { bold: true },
        },
      ],
      children: threadMessages,
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

  // Helper to create metadata item with optional Notion mention
  const createMetadataItem = (label: string, value: string, notionUserId?: string) => {
    const richText: any[] = [
      {
        type: 'text',
        text: { content: `${label}: ` },
      },
    ]

    if (notionUserId) {
      // Add Notion user mention
      richText.push({
        type: 'mention',
        mention: {
          type: 'user',
          user: {
            object: 'user',
            id: notionUserId,
          },
        },
      })
    } else {
      // Just add plain text
      richText.push({
        type: 'text',
        text: { content: value },
      })
    }

    return {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: { rich_text: richText },
    }
  }

  // Get Notion user ID for the message author
  const authorHandle = thread.rootMessage.authorHandle
  const authorNotionId = userMentions?.get(authorHandle)

  logger.debug('Metadata - Author info', {
    authorHandle,
    authorNotionId: authorNotionId || 'not found'
  })
  if (userMentions) {
    logger.debug('Metadata - Available user mentions', { mentions: Array.from(userMentions.keys()) })
  }

  // Basic metadata items
  blocks.push(createMetadataItem('Source', config.sourceType))
  blocks.push(createMetadataItem('Thread ID', thread.id))
  blocks.push(createMetadataItem('Thread Size', `${thread.replies.length + 1} messages`))
  blocks.push(createMetadataItem('Created By', thread.rootMessage.authorHandle, authorNotionId))
  blocks.push(createMetadataItem('Priority', task.priority || 'medium'))
  blocks.push(createMetadataItem('Sentiment', aiSummary.sentiment || 'neutral'))
  blocks.push(createMetadataItem('Confidence', `${Math.round((aiSummary.confidence || 0) * 100)}%`))
  blocks.push(createMetadataItem('Timestamp', new Date().toLocaleString()))

  // Assignee with Notion mention if available
  if (task.assignee) {
    // Check if assignee is a Notion UUID
    const isNotionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.assignee)
    const assigneeNotionId = isNotionUuid ? task.assignee : userMentions?.get(task.assignee)
    blocks.push(createMetadataItem('Assignee', task.assignee, assigneeNotionId))
  }

  // Tags
  if (task.tags && task.tags.length > 0) {
    blocks.push(createMetadataItem('Tags', task.tags.join(', ')))
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

  logger.debug('Complete blocks array (children)', { blocksCount: blocks.length })

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
  logger.info('Creating Notion task', {
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

  logger.info('Task created successfully', { taskId: page.id, duration })

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
  logger.info('Creating batch of tasks', {
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

      logger.info('Created task in batch', {
        index: i + 1,
        total: tasks.length,
        taskId: result.id,
      })

      // Rate limiting: 200ms delay between requests (respects 3 req/sec limit)
      if (i < tasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    catch (error) {
      logger.error('Failed to create task', error, {
        title: task?.title,
      })
      throw error // Fail fast on errors
    }
  }

  const duration = Date.now() - startTime

  logger.info('Successfully created tasks', {
    count: results.length,
    duration,
  })

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

    logger.info('Connection test successful', {
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
    logger.error('Connection test failed', error)

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

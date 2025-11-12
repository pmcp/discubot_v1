/**
 * Processor Service - Discussion Processing Orchestration
 *
 * This is the heart of Discubot. It orchestrates the complete workflow:
 *
 * **Processing Pipeline (6 Stages):**
 *
 * 1. **Validation** - Validate incoming discussion, check required fields
 * 2. **Config Loading** - Load source configuration (API keys, settings)
 * 3. **Thread Building** - Build complete thread (via adapter or direct input)
 * 4. **AI Analysis** - Analyze with Claude (summary + task detection)
 * 5. **Task Creation** - Create tasks in Notion
 * 6. **Notification** - Update status and send confirmations
 *
 * **Error Handling:**
 * - Transient failures → Retry with exponential backoff
 * - Permanent failures → Mark as failed, log error
 * - Status tracking at each stage for observability
 *
 * **Design Principles:**
 * - Fail fast with clear error messages
 * - Update status at each stage for UI tracking
 * - Log key events for debugging
 * - Support both adapter-based and direct thread input
 * - Keep it simple (KISS) - optimize later if needed
 */

import type {
  ParsedDiscussion,
  DiscussionThread,
  DiscussionStatus,
  AIAnalysisResult,
  NotionTaskResult,
  NotionTaskConfig,
  SourceConfig,
} from '../../types'
import { analyzeDiscussion } from './ai'
import { createNotionTask, createNotionTasks } from './notion'
import { retryWithBackoff } from '../utils/retry'
import { eq, and } from 'drizzle-orm'

/**
 * Processing result returned after successful processing
 */
export interface ProcessingResult {
  /** Discussion ID in database */
  discussionId: string
  /** AI analysis results */
  aiAnalysis: AIAnalysisResult
  /** Created Notion task IDs and URLs */
  notionTasks: NotionTaskResult[]
  /** Total processing time in milliseconds */
  processingTime: number
  /** Whether this was a multi-task discussion */
  isMultiTask: boolean
}

/**
 * Processing error with context
 */
export class ProcessingError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly context?: Record<string, any>,
    public readonly retryable: boolean = false,
  ) {
    super(message)
    this.name = 'ProcessingError'
  }
}

/**
 * Validate parsed discussion has all required fields
 */
function validateParsedDiscussion(parsed: ParsedDiscussion): void {
  const required = [
    'sourceType',
    'sourceThreadId',
    'sourceUrl',
    'teamId',
    'authorHandle',
    'title',
    'content',
  ]

  const missing = required.filter(field => !parsed[field as keyof ParsedDiscussion])

  if (missing.length > 0) {
    throw new ProcessingError(
      `Missing required fields: ${missing.join(', ')}`,
      'validation',
      { missing },
      false, // Not retryable - bad input
    )
  }
}

/**
 * Load source configuration from database
 *
 * Queries the configs collection by teamId and sourceType.
 * Returns the first active config found.
 */
async function loadSourceConfig(
  teamId: string,
  sourceType: string,
): Promise<SourceConfig> {
  const db = useDB()

  // Import the schema table
  const { discubotConfigs } = await import('#layers/discubot-configs/server/database/schema')

  // Query by sourceMetadata.slackTeamId (for Slack) or teamId (for other sources)
  // The teamId passed here is the Slack workspace team ID from the webhook
  const configs = await db
    .select()
    .from(discubotConfigs)
    .where(and(
      eq(discubotConfigs.sourceType, sourceType),
      eq(discubotConfigs.active, true),
    ))
    .all()

  // Filter by slackTeamId in sourceMetadata (stored as JSON)
  const matchingConfig = configs.find(config => {
    if (sourceType === 'slack' && config.sourceMetadata) {
      return (config.sourceMetadata as any).slackTeamId === teamId
    }
    // For other sources, match by teamId directly
    return config.teamId === teamId
  })

  if (!matchingConfig) {
    throw new ProcessingError(
      `No active config found for team ${teamId} and source ${sourceType}`,
      'config_loading',
      { teamId, sourceType, availableConfigs: configs.length },
      false,
    )
  }

  const config = matchingConfig

  // Map database config to SourceConfig type
  return {
    id: config.id,
    teamId: config.teamId,
    sourceType: config.sourceType as 'slack' | 'figma',
    webhookUrl: config.webhookUrl || '',
    apiToken: config.apiToken || '',
    notionToken: config.notionToken,
    notionDatabaseId: config.notionDatabaseId,
    notionFieldMapping: config.notionFieldMapping || {},
    anthropicApiKey: config.anthropicApiKey || undefined,
    aiEnabled: config.aiEnabled || false,
    aiSummaryPrompt: config.aiSummaryPrompt || undefined,
    aiTaskPrompt: config.aiTaskPrompt || undefined,
  }
}

/**
 * Save discussion to database
 *
 * Creates a new discussion record with initial status.
 */
async function saveDiscussion(
  parsed: ParsedDiscussion,
  configId: string,
  status: DiscussionStatus = 'pending',
): Promise<string> {
  // TODO: Use Crouton collection queries
  // For now, this is a placeholder
  console.log('[Processor] Saving discussion to database:', {
    sourceType: parsed.sourceType,
    sourceThreadId: parsed.sourceThreadId,
    status,
  })

  // Future implementation:
  // const result = await useDB()
  //   .insert(discussions)
  //   .values({
  //     teamId: parsed.teamId,
  //     sourceType: parsed.sourceType,
  //     sourceThreadId: parsed.sourceThreadId,
  //     sourceUrl: parsed.sourceUrl,
  //     sourceConfigId: configId,
  //     title: parsed.title,
  //     content: parsed.content,
  //     authorHandle: parsed.authorHandle,
  //     participants: parsed.participants,
  //     status,
  //     rawPayload: parsed.metadata,
  //     owner: 'system',
  //     createdBy: 'system',
  //     updatedBy: 'system',
  //   })
  //   .returning({ id: discussions.id })
  //
  // return result[0].id

  // Temporary: Return mock ID
  return `disc_${Date.now()}`
}

/**
 * Update discussion status in database
 */
async function updateDiscussionStatus(
  discussionId: string,
  status: DiscussionStatus,
  error?: string,
): Promise<void> {
  console.log('[Processor] Updating discussion status:', {
    discussionId,
    status,
    error,
  })

  // Future implementation:
  // await useDB()
  //   .update(discussions)
  //   .set({
  //     status,
  //     ...(error && { metadata: { error } }),
  //     updatedAt: new Date(),
  //     updatedBy: 'system',
  //   })
  //   .where(eq(discussions.id, discussionId))
}

/**
 * Update discussion with processing results
 */
async function updateDiscussionResults(
  discussionId: string,
  thread: DiscussionThread,
  aiAnalysis: AIAnalysisResult,
  notionTasks: NotionTaskResult[],
): Promise<void> {
  console.log('[Processor] Updating discussion with results:', {
    discussionId,
    taskCount: notionTasks.length,
  })

  // Future implementation:
  // await useDB()
  //   .update(discussions)
  //   .set({
  //     status: 'completed',
  //     threadData: thread,
  //     totalMessages: thread.replies.length + 1,
  //     aiSummary: aiAnalysis.summary.summary,
  //     aiKeyPoints: aiAnalysis.summary.keyPoints,
  //     aiTasks: aiAnalysis.taskDetection,
  //     isMultiTask: aiAnalysis.taskDetection.isMultiTask,
  //     notionTaskIds: notionTasks.map(t => t.id),
  //     processedAt: new Date(),
  //     updatedAt: new Date(),
  //     updatedBy: 'system',
  //   })
  //   .where(eq(discussions.id, discussionId))
}

/**
 * Build discussion thread
 *
 * Fetches the complete thread from the source using the adapter.
 * For testing, you can also provide a thread directly.
 */
async function buildThread(
  parsed: ParsedDiscussion,
  config: SourceConfig,
  threadInput?: DiscussionThread,
): Promise<DiscussionThread> {
  // If thread provided directly, use it (for testing)
  if (threadInput) {
    console.log('[Processor] Using provided thread input')
    return threadInput
  }

  // Fetch thread from source using adapter
  const { getAdapter } = await import('../adapters')
  const adapter = getAdapter(parsed.sourceType)
  const thread = await adapter.fetchThread(parsed.sourceThreadId, config)
  return thread
}

/**
 * Process a discussion through the complete pipeline
 *
 * @param parsed - Parsed discussion from adapter or manual input
 * @param options - Processing options
 * @returns Processing result with discussion ID and created tasks
 *
 * @example
 * ```typescript
 * // With direct thread input (Phase 2 - for testing)
 * const result = await processDiscussion(parsed, {
 *   thread: mockThread,
 *   config: mockConfig
 * })
 *
 * // With adapter (Phase 3+)
 * const result = await processDiscussion(parsed)
 * // Will use adapter to fetch thread from source
 * ```
 */
export async function processDiscussion(
  parsed: ParsedDiscussion,
  options: {
    /** Direct thread input (for testing/Phase 2) */
    thread?: DiscussionThread
    /** Source config (for testing/Phase 2) */
    config?: SourceConfig
    /** Skip AI analysis (for testing) */
    skipAI?: boolean
    /** Skip Notion task creation (for testing) */
    skipNotion?: boolean
  } = {},
): Promise<ProcessingResult> {
  const startTime = Date.now()
  let discussionId: string | undefined

  console.log('[Processor] Starting discussion processing:', {
    sourceType: parsed.sourceType,
    sourceThreadId: parsed.sourceThreadId,
    title: parsed.title,
  })

  try {
    // ============================================================================
    // STAGE 1: Validation
    // ============================================================================
    console.log('[Processor] Stage 1: Validation')
    validateParsedDiscussion(parsed)

    // Add initial "eyes" reaction to show bot is processing
    try {
      const { getAdapter } = await import('../adapters')
      const adapter = getAdapter(parsed.sourceType)

      // Get a minimal config for the initial reaction (we'll load full config next)
      // For now, we need to load config first to get the API token
      const tempConfig = options.config || await loadSourceConfig(parsed.teamId, parsed.sourceType)

      await adapter.updateStatus(parsed.sourceThreadId, 'pending', tempConfig)

      console.log('[Processor] Initial status reaction added (eyes)')
    } catch (error) {
      // Don't fail if initial reaction fails
      console.error('[Processor] Failed to add initial status reaction:', error)
    }

    // ============================================================================
    // STAGE 2: Config Loading
    // ============================================================================
    console.log('[Processor] Stage 2: Config Loading')
    let config: SourceConfig

    if (options.config) {
      // Use provided config (for testing)
      config = options.config
      console.log('[Processor] Using provided config')
    }
    else {
      // Load from database (Phase 3+)
      config = await loadSourceConfig(parsed.teamId, parsed.sourceType)
    }

    // Save discussion record
    discussionId = await saveDiscussion(parsed, config.id, 'processing')

    // ============================================================================
    // STAGE 3: Thread Building
    // ============================================================================
    console.log('[Processor] Stage 3: Thread Building')
    await updateDiscussionStatus(discussionId, 'processing')

    const thread = await buildThread(parsed, config, options.thread)
    console.log('[Processor] Thread built:', {
      id: thread.id,
      messages: thread.replies.length + 1,
      participants: thread.participants.length,
    })

    // ============================================================================
    // STAGE 4: AI Analysis
    // ============================================================================
    console.log('[Processor] Stage 4: AI Analysis')
    let aiAnalysis: AIAnalysisResult

    if (options.skipAI) {
      // Mock AI analysis for testing
      aiAnalysis = {
        summary: {
          summary: 'Mock summary',
          keyPoints: ['Mock point 1'],
        },
        taskDetection: {
          isMultiTask: false,
          tasks: [{
            title: parsed.title,
            description: parsed.content,
          }],
        },
        processingTime: 0,
        cached: false,
      }
    }
    else {
      aiAnalysis = await analyzeDiscussion(thread, {
        sourceType: parsed.sourceType,
      })

      console.log('[Processor] AI analysis complete:', {
        summary: aiAnalysis.summary.summary,
        taskCount: aiAnalysis.taskDetection.tasks.length,
        isMultiTask: aiAnalysis.taskDetection.isMultiTask,
        cached: aiAnalysis.cached,
      })
    }

    // ============================================================================
    // STAGE 5: Task Creation
    // ============================================================================
    console.log('[Processor] Stage 5: Task Creation')
    await updateDiscussionStatus(discussionId, 'analyzed')

    let notionTasks: NotionTaskResult[] = []

    if (!options.skipNotion && config.aiEnabled) {
      const notionConfig: NotionTaskConfig = {
        databaseId: config.notionDatabaseId,
        apiKey: config.notionToken,
        sourceType: parsed.sourceType,
        sourceUrl: parsed.sourceUrl,
      }

      const tasks = aiAnalysis.taskDetection.tasks

      if (tasks.length === 0) {
        console.log('[Processor] No tasks detected, skipping Notion creation')
      }
      else if (tasks.length === 1) {
        // Single task
        const task = tasks[0]
        console.log('[Processor] Creating single Notion task')

        const result = await createNotionTask(
          task,
          thread,
          aiAnalysis.summary,
          notionConfig,
        )

        notionTasks.push(result)
      }
      else {
        // Multiple tasks
        console.log(`[Processor] Creating ${tasks.length} Notion tasks`)

        notionTasks = await createNotionTasks(
          tasks,
          thread,
          aiAnalysis.summary,
          notionConfig,
        )
      }

      console.log('[Processor] Notion tasks created:', {
        count: notionTasks.length,
        ids: notionTasks.map(t => t.id),
      })
    }
    else {
      console.log('[Processor] Skipping Notion task creation')
    }

    // ============================================================================
    // STAGE 6: Finalization
    // ============================================================================
    console.log('[Processor] Stage 6: Finalization')

    // Update discussion with results
    await updateDiscussionResults(
      discussionId,
      thread,
      aiAnalysis,
      notionTasks,
    )

    // Mark as completed
    await updateDiscussionStatus(discussionId, 'completed')

    // Send notification back to source
    try {
      const { getAdapter } = await import('../adapters')
      const adapter = getAdapter(parsed.sourceType)

      // Remove the initial "eyes" reaction
      if ('removeReaction' in adapter && typeof adapter.removeReaction === 'function') {
        await adapter.removeReaction(parsed.sourceThreadId, 'eyes', config)
      }

      // Build confirmation message with Notion task URLs
      const confirmationMessage = buildConfirmationMessage(notionTasks)

      // Post reply to the thread
      await adapter.postReply(parsed.sourceThreadId, confirmationMessage, config)

      // Update status with completed emoji/reaction
      await adapter.updateStatus(parsed.sourceThreadId, 'completed', config)

      console.log('[Processor] Notification sent to source:', {
        sourceType: parsed.sourceType,
        sourceThreadId: parsed.sourceThreadId,
        taskCount: notionTasks.length,
      })
    } catch (error) {
      // Don't fail the entire process if notification fails
      console.error('[Processor] Failed to send notification to source:', error)
    }

    const processingTime = Date.now() - startTime

    console.log('[Processor] Processing complete:', {
      discussionId,
      processingTime: `${processingTime}ms`,
      taskCount: notionTasks.length,
    })

    return {
      discussionId,
      aiAnalysis,
      notionTasks,
      processingTime,
      isMultiTask: aiAnalysis.taskDetection.isMultiTask,
    }
  }
  catch (error) {
    console.error('[Processor] Processing failed:', error)

    // Update discussion status to failed
    if (discussionId) {
      await updateDiscussionStatus(
        discussionId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }

    // Wrap error if not already a ProcessingError
    if (error instanceof ProcessingError) {
      throw error
    }

    throw new ProcessingError(
      error instanceof Error ? error.message : 'Unknown error',
      'unknown',
      { originalError: error },
      true, // Assume retryable by default
    )
  }
}

/**
 * Process an existing discussion by ID
 *
 * Useful for reprocessing or manual triggers from Admin UI.
 */
export async function processDiscussionById(
  discussionId: string,
): Promise<ProcessingResult> {
  console.log('[Processor] Processing discussion by ID:', discussionId)

  // TODO Phase 3: Load discussion from database
  // const discussion = await loadDiscussion(discussionId)
  //
  // const parsed: ParsedDiscussion = {
  //   sourceType: discussion.sourceType,
  //   sourceThreadId: discussion.sourceThreadId,
  //   sourceUrl: discussion.sourceUrl,
  //   teamId: discussion.teamId,
  //   authorHandle: discussion.authorHandle,
  //   title: discussion.title,
  //   content: discussion.content,
  //   participants: discussion.participants || [],
  //   timestamp: discussion.createdAt,
  //   metadata: discussion.metadata || {},
  // }
  //
  // return await processDiscussion(parsed)

  throw new ProcessingError(
    'processDiscussionById not yet implemented (Phase 3+)',
    'load_discussion',
    { discussionId },
    false,
  )
}

/**
 * Retry a failed discussion
 *
 * Loads failed discussion and attempts to reprocess.
 */
export async function retryFailedDiscussion(
  discussionId: string,
): Promise<ProcessingResult> {
  console.log('[Processor] Retrying failed discussion:', discussionId)

  return await retryWithBackoff(
    () => processDiscussionById(discussionId),
    {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 30000,
    },
  )
}

/**
 * Build confirmation message for source notification
 *
 * Formats Notion task results into a user-friendly message.
 */
function buildConfirmationMessage(tasks: NotionTaskResult[]): string {
  if (tasks.length === 0) {
    return '✅ Discussion processed (no tasks created)'
  }

  if (tasks.length === 1) {
    return `✅ Task created in Notion\n🔗 ${tasks[0].url}`
  }

  const taskList = tasks.map((t, i) => `${i + 1}. ${t.url}`).join('\n')
  return `✅ Created ${tasks.length} tasks in Notion:\n${taskList}`
}

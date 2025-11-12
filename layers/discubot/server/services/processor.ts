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
 * This is a placeholder for Phase 2. In Phase 3+, this will query
 * the configs collection by teamId and sourceType.
 */
async function loadSourceConfig(
  teamId: string,
  sourceType: string,
): Promise<SourceConfig> {
  // TODO Phase 3: Query configs collection
  // For now, throw error with helpful message
  throw new ProcessingError(
    'Config loading not yet implemented. This will be added in Phase 3.',
    'config_loading',
    { teamId, sourceType },
    false,
  )

  // Future implementation:
  // const config = await useDB()
  //   .select()
  //   .from(configs)
  //   .where(and(
  //     eq(configs.teamId, teamId),
  //     eq(configs.sourceType, sourceType),
  //     eq(configs.active, true)
  //   ))
  //   .limit(1)
  //
  // if (!config) {
  //   throw new ProcessingError(
  //     `No active config found for team ${teamId} and source ${sourceType}`,
  //     'config_loading',
  //     { teamId, sourceType },
  //     false
  //   )
  // }
  //
  // return config
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
 * For Phase 2, we accept thread directly as input.
 * In Phase 3+, this will use the adapter to fetch from source.
 */
async function buildThread(
  parsed: ParsedDiscussion,
  config: SourceConfig,
  threadInput?: DiscussionThread,
): Promise<DiscussionThread> {
  // If thread provided directly, use it (for testing in Phase 2)
  if (threadInput) {
    console.log('[Processor] Using provided thread input')
    return threadInput
  }

  // Future Phase 3+ implementation with adapter:
  // const adapter = getAdapter(parsed.sourceType)
  // const thread = await adapter.fetchThread(parsed.sourceThreadId, config)
  // return thread

  throw new ProcessingError(
    'Thread building requires either direct thread input or adapter (Phase 3+)',
    'thread_building',
    { sourceType: parsed.sourceType },
    false,
  )
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

    // Future: Send notification back to source
    // await adapter.postReply(thread.id, buildConfirmationMessage(notionTasks), config)
    // await adapter.updateStatus(thread.id, 'completed', config)

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

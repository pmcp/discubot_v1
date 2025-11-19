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
} from '#layers/discubot/types'
import { analyzeDiscussion } from './ai'
import { createNotionTask, createNotionTasks } from './notion'
import { retryWithBackoff } from '../utils/retry'
import { SYSTEM_USER_ID } from '../utils/constants'
import { eq, and } from 'drizzle-orm'

/**
 * Module-level teamId storage for database updates
 * Set during saveDiscussion(), used by update functions
 */
let currentTeamId: string | undefined

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
  metadata?: Record<string, any>,
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

    // For Figma, match by emailSlug
    if (sourceType === 'figma' && metadata?.emailSlug) {
      // Try to match by emailSlug first
      if (config.emailSlug === metadata.emailSlug) {
        return true
      }
    }

    // Fallback: match by teamId directly
    return config.teamId === teamId
  })

  if (!matchingConfig) {
    throw new ProcessingError(
      `No active config found for team ${teamId} and source ${sourceType}`,
      'config_loading',
      { teamId, sourceType, emailSlug: metadata?.emailSlug, availableConfigs: configs.length },
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
 * Creates a new discussion record with initial status using Crouton queries.
 */
async function saveDiscussion(
  parsed: ParsedDiscussion,
  configId: string,
  status: DiscussionStatus = 'pending',
): Promise<string> {
  console.log('[Processor] Saving discussion to database:', {
    sourceType: parsed.sourceType,
    sourceThreadId: parsed.sourceThreadId,
    status,
  })

  // Store teamId for use in update functions
  currentTeamId = parsed.teamId

  // Import Crouton query
  const { createDiscubotDiscussion } = await import(
    '#layers/discubot/collections/discussions/server/database/queries'
  )

  // Create discussion record
  const discussion = await createDiscubotDiscussion({
    teamId: parsed.teamId,
    owner: SYSTEM_USER_ID,
    sourceType: parsed.sourceType,
    sourceThreadId: parsed.sourceThreadId,
    sourceUrl: parsed.sourceUrl,
    sourceConfigId: configId,
    title: parsed.title,
    content: parsed.content,
    authorHandle: parsed.authorHandle,
    participants: parsed.participants,
    status,
    rawPayload: parsed.metadata,
    metadata: {},
    threadData: {},
    createdBy: SYSTEM_USER_ID,
    updatedBy: SYSTEM_USER_ID,
  })

  if (!discussion) {
    throw new ProcessingError(
      'Failed to create discussion record',
      'save_discussion',
      { sourceType: parsed.sourceType, sourceThreadId: parsed.sourceThreadId },
      false,
    )
  }

  console.log('[Processor] Discussion saved with ID:', discussion.id)

  return discussion.id
}

/**
 * Update discussion status in database using Crouton queries
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

  // Verify teamId is available
  if (!currentTeamId) {
    throw new ProcessingError(
      'TeamId not available for discussion update',
      'update_status',
      { discussionId },
      false,
    )
  }

  // Import Crouton query
  const { updateDiscubotDiscussion } = await import(
    '#layers/discubot/collections/discussions/server/database/queries'
  )

  // Update discussion with new status
  await updateDiscubotDiscussion(
    discussionId,
    currentTeamId,
    SYSTEM_USER_ID,
    {
      status,
      ...(error && { metadata: { error } }),
    },
  )

  console.log('[Processor] Discussion status updated')
}

/**
 * Update discussion with processing results using Crouton queries
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

  // Verify teamId is available
  if (!currentTeamId) {
    throw new ProcessingError(
      'TeamId not available for discussion update',
      'update_results',
      { discussionId },
      false,
    )
  }

  // Import Crouton query
  const { updateDiscubotDiscussion } = await import(
    '#layers/discubot/collections/discussions/server/database/queries'
  )

  // Update discussion with all processing results
  await updateDiscubotDiscussion(
    discussionId,
    currentTeamId,
    SYSTEM_USER_ID,
    {
      status: 'completed',
      threadData: thread,
      totalMessages: thread.replies.length + 1,
      aiSummary: aiAnalysis.summary.summary,
      aiKeyPoints: aiAnalysis.summary.keyPoints,
      aiTasks: aiAnalysis.taskDetection,
      isMultiTask: aiAnalysis.taskDetection.isMultiTask,
      // notionTaskIds will be set by saveTaskRecords() after task records are created
      processedAt: new Date(),
    },
  )

  console.log('[Processor] Discussion results saved')
}

/**
 * Save task records to database after Notion task creation
 */
async function saveTaskRecords(
  notionTasks: NotionTaskResult[],
  aiTasks: any[],
  discussionId: string,
  jobId: string,
  parsed: ParsedDiscussion,
): Promise<string[]> {
  console.log('[Processor] Saving task records:', {
    count: notionTasks.length,
    discussionId,
    jobId,
  })

  // Verify teamId is available
  if (!currentTeamId) {
    console.error('[Processor] TeamId not available for task creation')
    return []
  }

  try {
    // Import Crouton query for task creation
    const { createDiscubotTask } = await import(
      '#layers/discubot/collections/tasks/server/database/queries'
    )

    const taskIds: string[] = []

    // Create task records for each Notion task
    for (let i = 0; i < notionTasks.length; i++) {
      const notionTask = notionTasks[i]
      const aiTask = aiTasks[i] || aiTasks[0] // Fallback to first task if index mismatch

      // Skip if notionTask is undefined
      if (!notionTask) {
        console.warn('[Processor] Skipping undefined notionTask at index:', i)
        continue
      }

      try {
        const task = await createDiscubotTask({
          teamId: currentTeamId,
          owner: SYSTEM_USER_ID,
          discussionId,
          syncJobId: jobId,
          notionPageId: notionTask.id,
          notionPageUrl: notionTask.url,
          title: aiTask?.title || parsed.title,
          description: aiTask?.description || undefined,
          status: 'todo',
          priority: aiTask?.priority || undefined,
          assignee: aiTask?.assignee || undefined,
          summary: aiTask?.description || undefined,
          sourceUrl: parsed.sourceUrl,
          isMultiTaskChild: notionTasks.length > 1,
          taskIndex: notionTasks.length > 1 ? i : undefined,
          metadata: {
            createdAt: notionTask.createdAt.toISOString(),
            sourceType: parsed.sourceType,
            sourceThreadId: parsed.sourceThreadId,
          },
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        })

        if (task?.id) {
          taskIds.push(task.id)
          console.log('[Processor] Task record created:', {
            taskId: task.id,
            notionPageId: notionTask.id,
            title: aiTask?.title || parsed.title,
          })
        }
      } catch (error) {
        console.error('[Processor] Failed to create task record:', {
          notionPageId: notionTask.id,
          error,
        })
        // Continue processing other tasks even if one fails
      }
    }

    // Update discussion with task IDs
    if (taskIds.length > 0) {
      const { updateDiscubotDiscussion } = await import(
        '#layers/discubot/collections/discussions/server/database/queries'
      )

      await updateDiscubotDiscussion(
        discussionId,
        currentTeamId,
        SYSTEM_USER_ID,
        {
          notionTaskIds: taskIds,
        },
      )

      console.log('[Processor] Discussion updated with task IDs:', taskIds)
    }

    return taskIds
  } catch (error) {
    console.error('[Processor] Failed to save task records:', error)
    // Don't fail processing if task record creation fails
    return []
  }
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
  teamId?: string,
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

  // Load user mappings to convert user IDs to names + Notion IDs for AI
  let userIdToMentionMap = new Map<string, { name: string; notionId: string }>()
  let handleToMentionMap = new Map<string, { name: string; notionId: string }>() // For Figma @handle mentions

  if (teamId) {
    try {
      const { getAllDiscubotUserMappings } = await import('#layers/discubot/collections/usermappings/server/database/queries')
      const allUserMappings = await getAllDiscubotUserMappings(teamId)

      // Build map of sourceUserId -> { name, notionId }
      for (const mapping of allUserMappings) {
        if (mapping.sourceType === parsed.sourceType && mapping.active) {
          const displayName = mapping.notionUserName || mapping.sourceUserName || mapping.sourceUserId
          const mentionData = {
            name: String(displayName),
            notionId: String(mapping.notionUserId)
          }

          userIdToMentionMap.set(String(mapping.sourceUserId), mentionData)

          // For Figma: also map by source user name (handle) for @mention matching
          if (parsed.sourceType === 'figma' && mapping.sourceUserName) {
            handleToMentionMap.set(String(mapping.sourceUserName), mentionData)
          }
        }
      }

      console.log(`[Processor] 👤 Loaded ${userIdToMentionMap.size} user mappings for mention conversion`)
      if (handleToMentionMap.size > 0) {
        console.log(`[Processor] 👤 Loaded ${handleToMentionMap.size} handle-based mappings for Figma @mentions`)
      }
    } catch (error) {
      console.warn('[Processor] Failed to load user mappings for mention conversion:', error)
    }
  }

  // Convert user ID mentions to readable names with Notion IDs and filter out bot
  const botUserId = config.sourceMetadata?.botUserId

  const convertMentions = (content: string): string => {
    let converted = content

    if (parsed.sourceType === 'slack') {
      // Slack format: <@U123ABC456>

      // First, remove bot mentions entirely
      if (botUserId) {
        converted = converted.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim()
      }

      // Then convert remaining user IDs to @Name (NotionID)
      userIdToMentionMap.forEach((mention, userId) => {
        converted = converted.replace(
          new RegExp(`<@${userId}>`, 'g'),
          `@${mention.name} (${mention.notionId})`
        )
      })
    } else if (parsed.sourceType === 'figma') {
      // Figma format: @handle (e.g., @Maarten)

      console.log(`[Processor] 🔍 DEBUG: Starting Figma mention conversion`)
      console.log(`[Processor] 🔍 DEBUG: Original content: "${content}"`)
      console.log(`[Processor] 🔍 DEBUG: handleToMentionMap has ${handleToMentionMap.size} entries`)

      // Convert @handle mentions to @Name (NotionID)
      handleToMentionMap.forEach((mention, handle) => {
        console.log(`[Processor] 🔍 DEBUG: Trying to convert handle: "${handle}" to ${mention.name} (${mention.notionId})`)

        // Escape special regex characters in handle
        const escapedHandle = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = `@${escapedHandle}(?!\\S)` // Case-insensitive, not followed by non-whitespace

        console.log(`[Processor] 🔍 DEBUG: Regex pattern: "${pattern}"`)

        const regex = new RegExp(pattern, 'gi')
        const beforeConvert = converted
        converted = converted.replace(
          regex,
          `@${mention.name} (${mention.notionId})`
        )

        if (beforeConvert !== converted) {
          console.log(`[Processor] 🔍 DEBUG: ✅ Converted! Before: "${beforeConvert}"`)
          console.log(`[Processor] 🔍 DEBUG: ✅ Converted! After: "${converted}"`)
        } else {
          console.log(`[Processor] 🔍 DEBUG: ❌ No match found for pattern "${pattern}" in content "${beforeConvert}"`)
        }
      })

      console.log(`[Processor] 🔍 DEBUG: Final converted content: "${converted}"`)
    }

    return converted
  }

  if (botUserId || userIdToMentionMap.size > 0 || handleToMentionMap.size > 0) {
    console.log(`[Processor] 🤖 Converting ${parsed.sourceType} user mentions for AI analysis`)
    if (botUserId) {
      console.log(`[Processor] 🤖 Filtering bot mentions: ${botUserId}`)
    }

    // Convert root message
    const originalContent = thread.rootMessage.content
    thread.rootMessage.content = convertMentions(thread.rootMessage.content)

    if (originalContent !== thread.rootMessage.content) {
      console.log(`[Processor] 🔄 Root message before: "${originalContent.substring(0, 100)}..."`)
      console.log(`[Processor] 🔄 Root message after: "${thread.rootMessage.content.substring(0, 100)}..."`)
    }

    // Convert all replies
    thread.replies = thread.replies.map((reply: any) => ({
      ...reply,
      content: convertMentions(reply.content)
    }))

    console.log('[Processor] ✅ User mentions converted to @Name (NotionID) format for AI')
  }

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
  let jobId: string | undefined
  let actualTeamId: string = parsed.teamId // Will be updated to config.teamId after config loads

  console.log('[Processor] Starting discussion processing:', {
    sourceType: parsed.sourceType,
    sourceThreadId: parsed.sourceThreadId,
    title: parsed.title,
  })

  // Note: Job creation moved to after config loading to get correct teamId

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
      const tempConfig = options.config || await loadSourceConfig(parsed.teamId, parsed.sourceType, parsed.metadata)

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
      config = await loadSourceConfig(parsed.teamId, parsed.sourceType, parsed.metadata)
    }

    // Update actualTeamId to use the correct team ID from config
    actualTeamId = config.teamId
    console.log('[Processor] Resolved team IDs:', {
      sourceIdentifier: parsed.teamId, // Slack workspace ID or Figma email slug
      actualTeamId: config.teamId, // Actual Discubot team ID from database
    })

    // ============================================================================
    // CREATE JOB RECORD (After config loaded to get correct teamId)
    // ============================================================================
    try {
      const { createDiscubotJob } = await import(
        '#layers/discubot/collections/jobs/server/database/queries'
      )

      const job = await createDiscubotJob({
        teamId: actualTeamId, // Use actual team ID from config, not source identifier
        owner: SYSTEM_USER_ID,
        discussionId: '', // Will update after discussion is created
        sourceConfigId: config.id,
        status: 'processing',
        stage: 'thread_building',
        attempts: 0,
        maxAttempts: 3,
        error: null,
        errorStack: null,
        startedAt: new Date(),
        completedAt: null,
        processingTime: null,
        taskIds: [],
        metadata: {
          sourceType: parsed.sourceType,
          sourceThreadId: parsed.sourceThreadId,
          emailSlug: parsed.teamId, // Store original email slug for reference
          startTimestamp: Date.now(),
        },
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })

      jobId = job?.id
      console.log('[Processor] Job created with correct teamId:', {
        jobId,
        teamId: config.teamId,
        emailSlug: parsed.teamId,
      })
    } catch (error) {
      console.error('[Processor] Failed to create job record:', error)
      // Don't fail processing if job creation fails
    }

    // Save discussion record
    discussionId = await saveDiscussion(parsed, config.id, 'processing')

    // Update job with discussion ID (sourceConfigId already set during creation)
    if (jobId && discussionId) {
      try {
        const { updateDiscubotJob } = await import(
          '#layers/discubot/collections/jobs/server/database/queries'
        )

        await updateDiscubotJob(jobId, actualTeamId, SYSTEM_USER_ID, {
          discussionId,
        })

        // Link discussion to job
        const { updateDiscubotDiscussion } = await import(
          '#layers/discubot/collections/discussions/server/database/queries'
        )

        await updateDiscubotDiscussion(
          discussionId,
          currentTeamId!,
          SYSTEM_USER_ID,
          {
            syncJobId: jobId,
          },
        )

        console.log('[Processor] Linked discussion to job:', {
          discussionId,
          jobId,
        })
      } catch (error) {
        console.error('[Processor] Failed to link discussion to job:', error)
        // Don't fail processing if linking fails
      }
    }

    // ============================================================================
    // STAGE 3: Thread Building
    // ============================================================================
    console.log('[Processor] Stage 3: Thread Building')
    await updateDiscussionStatus(discussionId, 'processing')
    await updateJobStatus(jobId, actualTeamId, {
      stage: 'thread_building',
    })

    const thread = await buildThread(parsed, config, options.thread, actualTeamId)
    console.log('[Processor] Thread built:', {
      id: thread.id,
      messages: thread.replies.length + 1,
      participants: thread.participants.length,
    })

    // Update sourceUrl and sourceThreadId with comment ID for Figma
    if (parsed.sourceType === 'figma' && thread.id && parsed.metadata?.fileKey) {
      const fileKey = parsed.metadata.fileKey
      parsed.sourceUrl = `https://www.figma.com/file/${fileKey}#${thread.id}`
      // Update sourceThreadId to include comment ID (format: fileKey:commentId)
      parsed.sourceThreadId = `${fileKey}:${thread.id}`

      console.log('[Processor] Updated Figma URLs:', {
        sourceUrl: parsed.sourceUrl,
        sourceThreadId: parsed.sourceThreadId,
      })

      // Update the discussion record with the correct URL and threadId using Crouton query
      const { updateDiscubotDiscussion } = await import(
        '#layers/discubot/collections/discussions/server/database/queries'
      )
      await updateDiscubotDiscussion(
        discussionId,
        currentTeamId!,
        SYSTEM_USER_ID,
        {
          sourceUrl: parsed.sourceUrl,
          sourceThreadId: parsed.sourceThreadId,
        },
      )

      // Now that we have the comment ID, add the "eyes" emoji reaction
      try {
        const { getAdapter } = await import('../adapters')
        const adapter = getAdapter(parsed.sourceType)
        await adapter.updateStatus(parsed.sourceThreadId, 'pending', config)
        console.log('[Processor] Added eyes emoji to Figma comment:', thread.id)
      } catch (error) {
        console.error('[Processor] Failed to add eyes emoji to Figma comment:', error)
        // Don't fail the whole process for emoji failures
      }
    }

    // ============================================================================
    // STAGE 4: AI Analysis
    // ============================================================================
    console.log('[Processor] Stage 4: AI Analysis')
    await updateJobStatus(jobId, actualTeamId, {
      stage: 'ai_analysis',
    })

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
      const customSummaryPrompt = config.aiSummaryPrompt || undefined
      const customTaskPrompt = config.aiTaskPrompt || undefined

      console.log('[Processor] Using custom prompts:', {
        hasSummaryPrompt: !!customSummaryPrompt,
        hasTaskPrompt: !!customTaskPrompt,
        summaryPromptLength: customSummaryPrompt?.length,
        taskPromptLength: customTaskPrompt?.length,
      })

      aiAnalysis = await analyzeDiscussion(thread, {
        sourceType: parsed.sourceType,
        customSummaryPrompt,
        customTaskPrompt,
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
    await updateJobStatus(jobId, actualTeamId, {
      stage: 'task_creation',
    })

    let notionTasks: NotionTaskResult[] = []

    if (!options.skipNotion && config.aiEnabled) {
      const notionConfig: NotionTaskConfig = {
        databaseId: config.notionDatabaseId,
        apiKey: config.notionToken,
        sourceType: parsed.sourceType,
        sourceUrl: parsed.sourceUrl,
      }

      // Load user mappings for assignee field resolution
      // IMPORTANT: Use actualTeamId (internal app team ID), not parsed.teamId (source identifier)
      const { getAllDiscubotUserMappings } = await import('#layers/discubot/collections/usermappings/server/database/queries')
      const allUserMappings = await getAllDiscubotUserMappings(actualTeamId)

      console.log(`[Processor] 🔍 User Mapping Debug - Total mappings in DB: ${allUserMappings.length}`)
      console.log(`[Processor] 🔍 User Mapping Debug - Using actualTeamId (internal): ${actualTeamId}`)
      console.log(`[Processor] 🔍 User Mapping Debug - Source Type: ${parsed.sourceType}`)
      console.log(`[Processor] 🔍 User Mapping Debug - FYI: parsed.teamId (source identifier): ${parsed.teamId}`)

      // Filter by sourceType and active status, then build Map for efficient lookup
      const userMappings = new Map<string, string>()
      for (const mapping of allUserMappings) {
        console.log(`[Processor] 🔍 Checking mapping: sourceType="${mapping.sourceType}", active=${mapping.active}, sourceUserId="${mapping.sourceUserId}"`)

        if (mapping.sourceType === parsed.sourceType && mapping.active) {
          userMappings.set(String(mapping.sourceUserId), String(mapping.notionUserId))
          console.log(`[Processor] ✅ Added mapping: ${mapping.sourceUserId} → ${mapping.notionUserId}`)
        } else {
          const reasons = []
          if (mapping.sourceType !== parsed.sourceType) reasons.push(`sourceType mismatch (got "${mapping.sourceType}", need "${parsed.sourceType}")`)
          if (!mapping.active) reasons.push('inactive')
          console.log(`[Processor] ❌ Skipped mapping: ${reasons.join(', ')}`)
        }
      }

      console.log(`[Processor] 📊 Final user mappings loaded: ${userMappings.size} active mappings for ${parsed.sourceType}`)
      if (userMappings.size > 0) {
        console.log(`[Processor] 📋 Mapping keys: ${Array.from(userMappings.keys()).join(', ')}`)
      }

      // Get field mapping configuration
      const fieldMapping = config.notionFieldMapping || {}

      const tasks = aiAnalysis.taskDetection.tasks

      if (tasks.length === 0) {
        console.log('[Processor] No tasks detected, skipping Notion creation')
      }
      else if (tasks.length === 1) {
        // Single task
        const task = tasks[0]
        if (!task) {
          console.log('[Processor] Task is undefined, skipping')
        }
        else {
          console.log('[Processor] Creating single Notion task')
          console.log('[Processor] 💬 Passing user mappings for @mentions in task content')

          const result = await createNotionTask(
            task,
            thread,
            aiAnalysis.summary,
            notionConfig,
            userMappings, // userMentions (for @mentions in content) - use same mappings as assignee
            fieldMapping,
            userMappings,
          )

          notionTasks.push(result)
        }
      }
      else {
        // Multiple tasks
        console.log(`[Processor] Creating ${tasks.length} Notion tasks`)
        console.log('[Processor] 💬 Passing user mappings for @mentions in task content')

        notionTasks = await createNotionTasks(
          tasks,
          thread,
          aiAnalysis.summary,
          notionConfig,
          userMappings, // userMentions (for @mentions in content) - use same mappings as assignee
          fieldMapping,
          userMappings,
        )
      }

      console.log('[Processor] Notion tasks created:', {
        count: notionTasks.length,
        ids: notionTasks.map(t => t.id),
      })

      // Save task records to database
      if (notionTasks.length > 0 && discussionId && jobId) {
        await saveTaskRecords(
          notionTasks,
          aiAnalysis.taskDetection.tasks,
          discussionId,
          jobId,
          parsed,
        )
      }
    }
    else {
      console.log('[Processor] Skipping Notion task creation')
    }

    // ============================================================================
    // STAGE 6: Finalization
    // ============================================================================
    console.log('[Processor] Stage 6: Finalization')
    await updateJobStatus(jobId, actualTeamId, {
      stage: 'notification',
    })

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

    // ============================================================================
    // FINALIZE JOB (Success)
    // ============================================================================
    if (jobId) {
      try {
        const { updateDiscubotJob } = await import(
          '#layers/discubot/collections/jobs/server/database/queries'
        )

        await updateDiscubotJob(jobId, actualTeamId, SYSTEM_USER_ID, {
          status: 'completed',
          completedAt: new Date(),
          processingTime,
          taskIds: notionTasks.map(t => t.id),
        })

        console.log('[Processor] Job finalized:', {
          jobId,
          processingTime: `${processingTime}ms`,
        })
      } catch (error) {
        console.error('[Processor] Failed to finalize job:', error)
        // Don't fail processing if job finalization fails
      }
    }

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

    // ============================================================================
    // FINALIZE JOB (Failure)
    // ============================================================================
    if (jobId) {
      try {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorStack = error instanceof Error ? error.stack : undefined
        const processingTime = Date.now() - startTime

        const { updateDiscubotJob } = await import(
          '#layers/discubot/collections/jobs/server/database/queries'
        )

        await updateDiscubotJob(jobId, actualTeamId, SYSTEM_USER_ID, {
          status: 'failed',
          completedAt: new Date(),
          processingTime,
          error: errorMessage,
          errorStack: errorStack || null,
        })

        console.log('[Processor] Job marked as failed:', {
          jobId,
          error: errorMessage,
        })
      } catch (updateError) {
        console.error('[Processor] Failed to update job with error:', updateError)
        // Don't fail processing if job update fails
      }
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

/**
 * Update job record with new status/stage/metadata
 *
 * Best-effort updates - logs warnings but doesn't fail processing.
 */
async function updateJobStatus(
  jobId: string | undefined,
  teamId: string,
  updates: {
    status?: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
    stage?: 'ingestion' | 'thread_building' | 'ai_analysis' | 'task_creation' | 'notification'
    error?: string
    errorStack?: string
    metadata?: Record<string, any>
  },
): Promise<void> {
  if (!jobId) {
    console.warn('[Processor] Cannot update job: jobId is undefined')
    return
  }

  try {
    const { updateDiscubotJob } = await import(
      '#layers/discubot/collections/jobs/server/database/queries'
    )

    await updateDiscubotJob(jobId, teamId, SYSTEM_USER_ID, updates)

    console.log('[Processor] Job updated:', {
      jobId,
      status: updates.status,
      stage: updates.stage,
    })
  } catch (error) {
    console.error('[Processor] Failed to update job:', error)
    // Don't fail processing if job update fails
  }
}

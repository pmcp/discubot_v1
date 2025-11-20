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
  Flow,
  FlowInput,
  FlowOutput,
} from '#layers/discubot/types'
import { analyzeDiscussion } from './ai'
import { createNotionTask, createNotionTasks, createNotionConfigFromOutput } from './notion'
import { retryWithBackoff } from '../utils/retry'
import { SYSTEM_USER_ID } from '../utils/constants'
import { logger } from '../utils/logger'
import { eq, and } from 'drizzle-orm'
import { routeTaskToOutputs } from '../utils/domain-routing'

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
 * Complete flow with inputs and outputs
 */
export interface FlowWithRelations {
  flow: Flow
  inputs: FlowInput[]
  outputs: FlowOutput[]
  /** The specific input that matched this request */
  matchedInput: FlowInput
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
 * Load flow with inputs and outputs by input identifier
 *
 * Queries flowinputs by slackTeamId (from sourceMetadata) or emailSlug,
 * then loads the associated flow and all its outputs.
 *
 * @param identifier - Slack team ID or email slug used to find the input
 * @param sourceType - Source type ('slack' or 'figma')
 * @param metadata - Additional metadata (e.g., emailSlug for Figma)
 * @returns Complete flow with inputs, outputs, and matched input
 */
async function loadFlow(
  identifier: string,
  sourceType: string,
  metadata?: Record<string, any>,
): Promise<FlowWithRelations> {
  const db = useDB()

  // Import schemas
  const { discubotFlowinputs } = await import(
    '#layers/discubot/collections/flowinputs/server/database/schema'
  )
  const { discubotFlows } = await import(
    '#layers/discubot/collections/flows/server/database/schema'
  )
  const { discubotFlowoutputs } = await import(
    '#layers/discubot/collections/flowoutputs/server/database/schema'
  )

  // Query all active inputs of this source type
  const inputs = await db
    .select()
    .from(discubotFlowinputs)
    .where(and(
      eq(discubotFlowinputs.sourceType, sourceType),
      eq(discubotFlowinputs.active, true),
    ))
    .all()

  // Find matching input
  let matchedInput: any

  if (sourceType === 'slack') {
    // Match by slackTeamId in sourceMetadata
    matchedInput = inputs.find(input => {
      return input.sourceMetadata?.slackTeamId === identifier
    })
  } else if (sourceType === 'figma') {
    // Match by emailSlug
    const emailSlug = metadata?.emailSlug
    matchedInput = inputs.find(input => {
      return input.emailSlug === emailSlug
    })
  }

  if (!matchedInput) {
    throw new ProcessingError(
      `No active flow input found for ${sourceType} identifier: ${identifier}`,
      'flow_loading',
      { identifier, sourceType, emailSlug: metadata?.emailSlug, availableInputs: inputs.length },
      false,
    )
  }

  // Load the flow
  const [flow] = await db
    .select()
    .from(discubotFlows)
    .where(and(
      eq(discubotFlows.id, matchedInput.flowId),
      eq(discubotFlows.active, true),
    ))
    .limit(1)

  if (!flow) {
    throw new ProcessingError(
      `Flow not found or inactive for input ${matchedInput.id}`,
      'flow_loading',
      { flowId: matchedInput.flowId, inputId: matchedInput.id },
      false,
    )
  }

  // Load all inputs for this flow
  const allInputs = await db
    .select()
    .from(discubotFlowinputs)
    .where(and(
      eq(discubotFlowinputs.flowId, flow.id),
      eq(discubotFlowinputs.active, true),
    ))
    .all()

  // Load all outputs for this flow
  const outputs = await db
    .select()
    .from(discubotFlowoutputs)
    .where(and(
      eq(discubotFlowoutputs.flowId, flow.id),
      eq(discubotFlowoutputs.active, true),
    ))
    .all()

  logger.info('Flow loaded', {
    flowId: flow.id,
    flowName: flow.name,
    inputCount: allInputs.length,
    outputCount: outputs.length,
    matchedInputId: matchedInput.id,
  })

  return {
    flow: flow as Flow,
    inputs: allInputs as FlowInput[],
    outputs: outputs as FlowOutput[],
    matchedInput: matchedInput as FlowInput,
  }
}

/**
 * Load source configuration from database (LEGACY - for backward compatibility)
 *
 * Queries the configs collection by teamId and sourceType.
 * Returns the first active config found.
 *
 * @deprecated Use loadFlow() instead
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
    if (sourceType === 'figma') {
      // Match by emailSlug (required for Figma)
      if (metadata?.emailSlug && config.emailSlug === metadata.emailSlug) {
        return true
      }
    }

    // No fallback - we require explicit matching by source identifiers
    // to prevent accidentally using wrong configs
    return false
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
    name: config.name || '',
    apiToken: config.apiToken || '',
    notionToken: config.notionToken,
    notionDatabaseId: config.notionDatabaseId,
    anthropicApiKey: config.anthropicApiKey || undefined,
    aiEnabled: config.aiEnabled || false,
    autoSync: config.autoSync || false,
    settings: {}, // Empty settings object for backward compatibility
    sourceMetadata: (config.sourceMetadata as Record<string, any>) || undefined,
    aiSummaryPrompt: config.aiSummaryPrompt || undefined,
    aiTaskPrompt: config.aiTaskPrompt || undefined,
    notionFieldMapping: config.notionFieldMapping || {},
    webhookUrl: config.webhookUrl || '',
    active: config.active,
  }
}

/**
 * Save discussion to database
 *
 * Creates a new discussion record with initial status using Crouton queries.
 * Note: authorHandle and participants may be placeholder values at this point
 * (e.g., from Figma webhook email addresses). They will be updated after
 * thread building with correct values via updateDiscussionMetadata().
 */
async function saveDiscussion(
  parsed: ParsedDiscussion,
  configId: string,
  actualTeamId: string,
  status: DiscussionStatus = 'pending',
): Promise<string> {
  logger.debug('Saving discussion to database', {
    sourceType: parsed.sourceType,
    sourceThreadId: parsed.sourceThreadId,
    status,
    actualTeamId,
  })

  // Store teamId for use in update functions
  currentTeamId = actualTeamId

  // Import Crouton query
  const { createDiscubotDiscussion } = await import(
    '#layers/discubot/collections/discussions/server/database/queries'
  )

  // Create discussion record
  // NOTE: For Figma, authorHandle and participants contain email addresses at this point
  // They will be updated after thread building with actual user names
  const discussion = await createDiscubotDiscussion({
    teamId: actualTeamId, // Use actual team ID from config, not source identifier
    owner: SYSTEM_USER_ID,
    sourceType: parsed.sourceType,
    sourceThreadId: parsed.sourceThreadId,
    sourceUrl: parsed.sourceUrl,
    sourceConfigId: configId,
    title: parsed.title,
    content: parsed.content,
    authorHandle: parsed.authorHandle, // Placeholder - will be updated after thread building
    participants: parsed.participants, // Placeholder - will be updated after thread building
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

  logger.info('Discussion saved', { discussionId: discussion.id })

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
  logger.debug('Updating discussion status', {
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

  logger.debug('Discussion status updated', { discussionId, status })
}

/**
 * Update discussion metadata after thread building
 *
 * Updates authorHandle and participants with correct values from the built thread.
 * This fixes the issue where Figma discussions initially have email addresses instead
 * of actual user names.
 */
async function updateDiscussionMetadata(
  discussionId: string,
  thread: DiscussionThread,
): Promise<void> {
  logger.debug('Updating discussion metadata', {
    discussionId,
    authorHandle: thread.rootMessage.authorHandle,
    participantCount: thread.participants.length,
  })

  // Verify teamId is available
  if (!currentTeamId) {
    throw new ProcessingError(
      'TeamId not available for discussion update',
      'update_metadata',
      { discussionId },
      false,
    )
  }

  // Import Crouton query
  const { updateDiscubotDiscussion } = await import(
    '#layers/discubot/collections/discussions/server/database/queries'
  )

  // Update discussion with correct authorHandle and participants from thread
  await updateDiscubotDiscussion(
    discussionId,
    currentTeamId,
    SYSTEM_USER_ID,
    {
      authorHandle: thread.rootMessage.authorHandle,
      participants: thread.participants,
    },
  )

  logger.debug('Discussion metadata updated')
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
  logger.debug('Updating discussion with results', {
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

  logger.debug('Discussion results saved')
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
  logger.debug('Saving task records', {
    count: notionTasks.length,
    discussionId,
    jobId,
  })

  // Verify teamId is available
  if (!currentTeamId) {
    logger.error('TeamId not available for task creation')
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
        logger.warn('Skipping undefined notionTask', { index: i })
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
          logger.debug('Task record created', {
            taskId: task.id,
            notionPageId: notionTask.id,
            title: aiTask?.title || parsed.title,
          })
        }
      } catch (error) {
        logger.error('Failed to create task record', error, {
          notionPageId: notionTask.id,
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

      logger.debug('Discussion updated with task IDs', { taskIds })
    }

    return taskIds
  } catch (error) {
    logger.error('Failed to save task records', error)
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
  userMappings?: Map<string, { name: string; notionId: string }>,
): Promise<DiscussionThread> {
  // If thread provided directly, use it (for testing)
  if (threadInput) {
    logger.debug('Using provided thread input')
    return threadInput
  }

  // Fetch thread from source using adapter
  const { getAdapter } = await import('../adapters')
  const adapter = getAdapter(parsed.sourceType)
  const thread = await adapter.fetchThread(parsed.sourceThreadId, config)

  // Use user mappings passed from Stage 2.5 (already loaded once)
  const userIdToMentionMap = userMappings || new Map<string, { name: string; notionId: string }>()
  const handleToMentionMap = new Map<string, { name: string; notionId: string }>() // For Figma @handle mentions

  // Build handle map for Figma (only if we have user mappings)
  if (userMappings && parsed.sourceType === 'figma' && teamId) {
    try {
      const { getAllDiscubotUserMappings } = await import('#layers/discubot/collections/usermappings/server/database/queries')
      const allUserMappings = await getAllDiscubotUserMappings(teamId)

      for (const mapping of allUserMappings) {
        if (mapping.sourceType === 'figma' && mapping.active && mapping.sourceUserName) {
          const displayName = mapping.notionUserName || mapping.sourceUserName || mapping.sourceUserId
          const mentionData = {
            name: String(displayName),
            notionId: String(mapping.notionUserId)
          }
          handleToMentionMap.set(String(mapping.sourceUserName), mentionData)
        }
      }
    } catch (error) {
      logger.warn('Failed to load Figma handle mappings', error)
    }
  }

  logger.debug('User mappings available for mention conversion', {
    userIdMappings: userIdToMentionMap.size,
    handleMappings: handleToMentionMap.size,
  })

  // Convert user ID mentions to readable names with Notion IDs and filter out bot
  const botUserId = config.sourceMetadata?.botUserId

  const convertMentions = (content: string): string => {
    let converted = content

    if (parsed.sourceType === 'slack') {
      // Slack format: <@U123ABC456>

      // First, remove bot mentions entirely
      if (botUserId) {
        converted = converted.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim()
        // Clean up multiple spaces
        converted = converted.replace(/\s+/g, ' ').trim()
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

      // First, remove bot mentions entirely (before converting user mentions)
      const botHandle = config.sourceMetadata?.botHandle
      if (botHandle) {
        // Escape special regex characters in handle
        const escapedBotHandle = botHandle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Match @bothandle with word boundary (case-insensitive)
        const botPattern = new RegExp(`@${escapedBotHandle}(?!\\S)`, 'gi')
        converted = converted.replace(botPattern, '').trim()
        // Clean up multiple spaces
        converted = converted.replace(/\s+/g, ' ').trim()
      }

      // Convert @handle mentions to @Name (NotionID)
      handleToMentionMap.forEach((mention, handle) => {
        // Escape special regex characters in handle
        const escapedHandle = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = `@${escapedHandle}(?!\\S)` // Case-insensitive, not followed by non-whitespace

        const regex = new RegExp(pattern, 'gi')
        converted = converted.replace(
          regex,
          `@${mention.name} (${mention.notionId})`
        )
      })
    }

    return converted
  }

  if (botUserId || userIdToMentionMap.size > 0 || handleToMentionMap.size > 0) {
    logger.debug('Converting user mentions for AI', {
      sourceType: parsed.sourceType,
      hasBot: !!botUserId,
      mappingCount: userIdToMentionMap.size + handleToMentionMap.size
    })

    // Convert root message
    thread.rootMessage.content = convertMentions(thread.rootMessage.content)

    // Convert all replies
    thread.replies = thread.replies.map((reply: any) => ({
      ...reply,
      content: convertMentions(reply.content)
    }))
  }

  // Resolve author IDs to names for display in Notion
  if (userIdToMentionMap.size > 0) {
    // Resolve root message author
    const rootAuthorData = userIdToMentionMap.get(thread.rootMessage.authorHandle)
    if (rootAuthorData) {
      thread.rootMessage.authorName = rootAuthorData.name
      logger.debug('Resolved root author', {
        from: thread.rootMessage.authorHandle,
        to: rootAuthorData.name,
      })
    }

    // Resolve reply authors
    thread.replies = thread.replies.map((reply: any) => {
      const replyAuthorData = userIdToMentionMap.get(reply.authorHandle)
      return {
        ...reply,
        authorName: replyAuthorData?.name,
      }
    })

    logger.debug('Resolved author IDs to names', {
      totalAuthors: new Set([
        thread.rootMessage.authorHandle,
        ...thread.replies.map((r: any) => r.authorHandle)
      ]).size,
    })
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

  logger.info('Processing discussion', {
    sourceType: parsed.sourceType,
    sourceThreadId: parsed.sourceThreadId,
    title: parsed.title,
  })

  // Note: Job creation moved to after config loading to get correct teamId

  try {
    // ============================================================================
    // STAGE 1: Validation
    // ============================================================================

    validateParsedDiscussion(parsed)

    // Add initial "eyes" reaction to show bot is processing
    try {
      const { getAdapter } = await import('../adapters')
      const adapter = getAdapter(parsed.sourceType)

      // Get a minimal config for the initial reaction (we'll load full config next)
      // For now, we need to load config first to get the API token
      const tempConfig = options.config || await loadSourceConfig(parsed.teamId, parsed.sourceType, parsed.metadata)

      await adapter.updateStatus(parsed.sourceThreadId, 'pending', tempConfig)

      logger.debug('Initial status reaction added')
    } catch (error) {
      // Don't fail if initial reaction fails
      logger.warn('Failed to add initial status reaction', error)
    }

    // ============================================================================
    // STAGE 2: Flow/Config Loading
    // ============================================================================
    let config: SourceConfig | undefined
    let flowData: FlowWithRelations | undefined

    if (options.config) {
      // Use provided config (for testing)
      config = options.config
      logger.debug('Using provided config')
    }
    else {
      // Try to load flow first (flows architecture v2)
      try {
        flowData = await loadFlow(parsed.teamId, parsed.sourceType, parsed.metadata)
        actualTeamId = flowData.flow.teamId
        logger.info('Loaded flow for processing', {
          flowId: flowData.flow.id,
          flowName: flowData.flow.name,
          inputCount: flowData.inputs.length,
          outputCount: flowData.outputs.length,
        })
      }
      catch (error) {
        // Fall back to legacy config loading
        logger.info('No flow found, falling back to legacy config', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        config = await loadSourceConfig(parsed.teamId, parsed.sourceType, parsed.metadata)
        actualTeamId = config.teamId
      }
    }

    // Update actualTeamId
    if (config && !flowData) {
      actualTeamId = config.teamId
      logger.debug('Resolved team IDs from config', {
        sourceIdentifier: parsed.teamId,
        actualTeamId: config.teamId,
      })
    }
    else if (flowData) {
      actualTeamId = flowData.flow.teamId
      logger.debug('Resolved team IDs from flow', {
        sourceIdentifier: parsed.teamId,
        actualTeamId: flowData.flow.teamId,
      })
    }

    // ============================================================================
    // STAGE 2.5: Load User Mappings (Once, used throughout pipeline)
    // ============================================================================
    logger.info('Stage 2.5: Loading User Mappings')
    let userMappings: Map<string, { name: string; notionId: string }> | undefined

    // Determine source workspace ID for filtering user mappings
    let sourceWorkspaceId: string | undefined
    if (flowData) {
      // Extract from flow input's sourceMetadata
      sourceWorkspaceId = flowData.matchedInput.sourceMetadata?.slackTeamId ||
                          flowData.matchedInput.sourceMetadata?.figmaOrgId ||
                          parsed.teamId
    } else if (config) {
      // Extract from legacy config's sourceMetadata
      sourceWorkspaceId = config.sourceMetadata?.slackTeamId ||
                          config.sourceMetadata?.figmaOrgId ||
                          parsed.teamId
    }

    try {
      const { getAllDiscubotUserMappings } = await import(
        '#layers/discubot/collections/usermappings/server/database/queries'
      )
      const allUserMappings = await getAllDiscubotUserMappings(actualTeamId)

      const userIdToMentionMap = new Map<string, { name: string; notionId: string }>()

      for (const mapping of allUserMappings) {
        // Filter by sourceType, active status, and sourceWorkspaceId
        const matchesWorkspace = !sourceWorkspaceId || mapping.sourceWorkspaceId === sourceWorkspaceId
        if (mapping.sourceType === parsed.sourceType && mapping.active && matchesWorkspace) {
          const displayName = mapping.notionUserName || mapping.sourceUserName || mapping.sourceUserId
          const mentionData = {
            name: String(displayName),
            notionId: String(mapping.notionUserId),
          }
          userIdToMentionMap.set(String(mapping.sourceUserId), mentionData)
        }
      }

      userMappings = userIdToMentionMap
      logger.info(`Loaded ${userMappings.size} user mappings for ${parsed.sourceType}`, {
        sourceWorkspaceId,
        filtered: !!sourceWorkspaceId,
      })
    }
    catch (error) {
      logger.warn('Failed to load user mappings', { error })
      // Continue without mappings - operations will fallback to IDs
    }

    // ============================================================================
    // CREATE JOB RECORD (After config loaded to get correct teamId)
    // ============================================================================
    try {
      const { createDiscubotJob } = await import(
        '#layers/discubot/collections/jobs/server/database/queries'
      )

      const job = await createDiscubotJob({
        teamId: actualTeamId,
        owner: SYSTEM_USER_ID,
        discussionId: '', // Will update after discussion is created
        sourceConfigId: flowData ? flowData.matchedInput.id : (config?.id || ''), // Use input ID for flows, config ID for legacy
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
          flowId: flowData?.flow.id, // Include flow ID if using flows
          inputId: flowData?.matchedInput.id, // Include matched input ID
        },
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })

      jobId = job?.id
      logger.debug('Job created', {
        jobId,
        teamId: config.teamId,
      })
    } catch (error) {
      logger.error('Failed to create job record', error)
      // Don't fail processing if job creation fails
    }

    // Save discussion record with actual team ID
    const sourceConfigOrInputId = flowData ? flowData.matchedInput.id : (config?.id || '')
    discussionId = await saveDiscussion(parsed, sourceConfigOrInputId, actualTeamId, 'processing')

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

        logger.debug('Linked discussion to job', {
          discussionId,
          jobId,
        })
      } catch (error) {
        logger.error('Failed to link discussion to job', error)
        // Don't fail processing if linking fails
      }
    }

    // ============================================================================
    // STAGE 3: Thread Building
    // ============================================================================
    await updateDiscussionStatus(discussionId, 'processing')
    await updateJobStatus(jobId, actualTeamId, {
      stage: 'thread_building',
    })

    // Build thread with either flow input config or legacy config
    const threadBuildConfig = flowData
      ? {
          id: flowData.matchedInput.id,
          teamId: flowData.flow.teamId,
          sourceType: flowData.matchedInput.sourceType,
          apiToken: flowData.matchedInput.apiToken || '',
          sourceMetadata: flowData.matchedInput.sourceMetadata,
        } as SourceConfig
      : config!

    const thread = await buildThread(parsed, threadBuildConfig, options.thread, actualTeamId, userMappings)
    logger.info('Thread built', {
      id: thread.id,
      messages: thread.replies.length + 1,
      participants: thread.participants.length,
    })

    // Update discussion metadata with correct values from thread
    // This fixes the issue where initial save had placeholder email addresses
    await updateDiscussionMetadata(discussionId, thread)

    // Update sourceUrl and sourceThreadId with comment ID for Figma
    if (parsed.sourceType === 'figma' && thread.id && parsed.metadata?.fileKey) {
      const fileKey = parsed.metadata.fileKey
      parsed.sourceUrl = `https://www.figma.com/file/${fileKey}#${thread.id}`
      // Update sourceThreadId to include comment ID (format: fileKey:commentId)
      parsed.sourceThreadId = `${fileKey}:${thread.id}`

      logger.debug('Updated Figma URLs', {
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
        logger.debug('Added eyes emoji to Figma comment', { commentId: thread.id })
      } catch (error) {
        logger.warn('Failed to add eyes emoji to Figma comment', error)
        // Don't fail the whole process for emoji failures
      }
    }

    // ============================================================================
    // STAGE 4: AI Analysis
    // ============================================================================
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
      // Get AI settings from flow or config
      const customSummaryPrompt = flowData?.flow.aiSummaryPrompt || config?.aiSummaryPrompt || undefined
      const customTaskPrompt = flowData?.flow.aiTaskPrompt || config?.aiTaskPrompt || undefined
      const availableDomains = flowData?.flow.availableDomains || undefined

      logger.debug('Using AI settings', {
        hasSummaryPrompt: !!customSummaryPrompt,
        hasTaskPrompt: !!customTaskPrompt,
        availableDomains,
      })

      aiAnalysis = await analyzeDiscussion(thread, {
        sourceType: parsed.sourceType,
        customSummaryPrompt,
        customTaskPrompt,
        availableDomains, // Pass available domains for domain detection
      })

      logger.info('AI analysis complete', {
        taskCount: aiAnalysis.taskDetection.tasks.length,
        isMultiTask: aiAnalysis.taskDetection.isMultiTask,
        cached: aiAnalysis.cached,
      })
    }

    // ============================================================================
    // STAGE 5: Task Creation
    // ============================================================================
    await updateDiscussionStatus(discussionId, 'analyzed')
    await updateJobStatus(jobId, actualTeamId, {
      stage: 'task_creation',
    })

    let notionTasks: NotionTaskResult[] = []

    const aiEnabled = flowData?.flow.aiEnabled ?? config?.aiEnabled ?? false

    if (!options.skipNotion && aiEnabled) {
      // Use user mappings from Stage 2.5 (already loaded once)
      // Convert to simple userId -> notionId map for Notion API
      const notionUserMappings = new Map<string, string>()
      if (userMappings) {
        for (const [userId, data] of userMappings.entries()) {
          notionUserMappings.set(userId, data.notionId)
        }
      }

      logger.debug('User mappings available for Notion tasks', {
        active: notionUserMappings.size,
        sourceType: parsed.sourceType
      })

      const tasks = aiAnalysis.taskDetection.tasks

      if (tasks.length === 0) {
        logger.info('No tasks detected, skipping Notion creation')
      }
      else if (flowData) {
        // ============================================================================
        // FLOWS ARCHITECTURE: Route tasks to multiple outputs based on domain
        // ============================================================================
        logger.info('Processing with flows architecture', {
          flowId: flowData.flow.id,
          taskCount: tasks.length,
          outputCount: flowData.outputs.length,
        })

        // Process each task
        for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
          const task = tasks[taskIndex]
          if (!task) {
            logger.warn('Task is undefined, skipping', { taskIndex })
            continue
          }

          // Route task to matching outputs based on domain
          const matchedOutputs = routeTaskToOutputs(task, flowData.outputs)

          logger.info('Task routed to outputs', {
            taskIndex,
            taskDomain: task.domain,
            matchedOutputCount: matchedOutputs.length,
            outputNames: matchedOutputs.map(o => o.name),
          })

          // Create task in all matched outputs
          for (const output of matchedOutputs) {
            if (output.outputType !== 'notion') {
              logger.warn('Non-Notion output types not yet supported', {
                outputType: output.outputType,
                outputId: output.id,
              })
              continue
            }

            try {
              // Extract Notion config from output
              const { config: notionConfig, fieldMapping } = createNotionConfigFromOutput(
                output,
                parsed.sourceType,
                parsed.sourceUrl,
              )

              logger.info('Creating task in output', {
                outputId: output.id,
                outputName: output.name,
                taskTitle: task.title,
              })

              const result = await createNotionTask(
                task,
                thread,
                aiAnalysis.summary,
                notionConfig,
                notionUserMappings,
                fieldMapping,
                notionUserMappings,
              )

              notionTasks.push(result)

              logger.info('Task created successfully in output', {
                outputId: output.id,
                outputName: output.name,
                notionTaskId: result.id,
              })
            }
            catch (error) {
              logger.error('Failed to create task in output', error, {
                outputId: output.id,
                outputName: output.name,
                taskTitle: task.title,
              })
              // Continue with other outputs even if one fails
            }
          }
        }

        logger.info('All tasks processed with flows', {
          totalTasksCreated: notionTasks.length,
          taskIds: notionTasks.map(t => t.id),
        })
      }
      else if (config) {
        // ============================================================================
        // LEGACY CONFIG: Single output (backward compatibility)
        // ============================================================================
        const notionConfig: NotionTaskConfig = {
          databaseId: config.notionDatabaseId,
          apiKey: config.notionToken,
          sourceType: parsed.sourceType,
          sourceUrl: parsed.sourceUrl,
        }

        const fieldMapping = config.notionFieldMapping || {}

        if (tasks.length === 1) {
          // Single task
          const task = tasks[0]
          if (!task) {
            logger.warn('Task is undefined, skipping')
          }
          else {
            logger.info('Creating single Notion task (legacy config)')

            const result = await createNotionTask(
              task,
              thread,
              aiAnalysis.summary,
              notionConfig,
              notionUserMappings,
              fieldMapping,
              notionUserMappings,
            )

            notionTasks.push(result)
          }
        }
        else {
          // Multiple tasks
          logger.info('Creating multiple Notion tasks (legacy config)', { count: tasks.length })

          notionTasks = await createNotionTasks(
            tasks,
            thread,
            aiAnalysis.summary,
            notionConfig,
            notionUserMappings,
            fieldMapping,
            notionUserMappings,
          )
        }

        logger.info('Notion tasks created (legacy)', {
          count: notionTasks.length,
          ids: notionTasks.map(t => t.id),
        })
      }

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
      logger.info('Skipping Notion task creation')
    }

    // ============================================================================
    // STAGE 6: Finalization
    // ============================================================================
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

      logger.info('Notification sent to source', {
        sourceType: parsed.sourceType,
        taskCount: notionTasks.length,
      })
    } catch (error) {
      // Don't fail the entire process if notification fails
      logger.error('Failed to send notification to source', error)
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

        logger.debug('Job finalized', {
          jobId,
          processingTime,
        })
      } catch (error) {
        logger.error('Failed to finalize job', error)
        // Don't fail processing if job finalization fails
      }
    }

    logger.info('Processing complete', {
      discussionId,
      processingTime,
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
    logger.error('Processing failed', error)

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

        logger.warn('Job marked as failed', {
          jobId,
          error: errorMessage,
        })
      } catch (updateError) {
        logger.error('Failed to update job with error', updateError)
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
  logger.info('Processing discussion by ID', { discussionId })

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
  logger.info('Retrying failed discussion', { discussionId })

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

  if (tasks.length === 1 && tasks[0]) {
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
    logger.warn('Cannot update job: jobId is undefined')
    return
  }

  try {
    const { updateDiscubotJob } = await import(
      '#layers/discubot/collections/jobs/server/database/queries'
    )

    await updateDiscubotJob(jobId, teamId, SYSTEM_USER_ID, updates)

    logger.debug('Job updated', {
      jobId,
      status: updates.status,
      stage: updates.stage,
    })
  } catch (error) {
    logger.error('Failed to update job', error)
    // Don't fail processing if job update fails
  }
}

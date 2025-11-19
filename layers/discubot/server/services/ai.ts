/**
 * AI Service - Claude AI Integration with Map-based Caching
 *
 * Provides:
 * - Discussion summarization
 * - Multi-task detection
 * - In-memory caching (Map-based for MVP)
 * - Retry logic with exponential backoff
 *
 * For MVP we use Map-based caching (single-server deployment).
 * In Phase 6, this can be upgraded to KV caching for multi-region deployment.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  AIAnalysisOptions,
  AIAnalysisResult,
  AISummary,
  CacheEntry,
  DiscussionThread,
  TaskDetectionResult,
} from '#layers/discubot/types'
import { retryWithBackoff } from '../utils/retry'

/**
 * In-memory cache for AI responses
 * Key: Hash of thread content
 * Value: Cached analysis with timestamp
 */
const analysisCache = new Map<string, CacheEntry<AIAnalysisResult>>()

/**
 * Default cache TTL: 1 hour (3600000ms)
 * Balances API cost savings with data freshness
 */
const DEFAULT_CACHE_TTL = 3600000

/**
 * Generate a simple hash key from thread content
 * Used for cache lookups
 */
function generateCacheKey(thread: DiscussionThread): string {
  const content = [
    thread.rootMessage.content,
    ...thread.replies.map(r => r.content),
  ].join('|')

  // Simple hash for cache key
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return `thread_${thread.id}_${hash.toString(36)}`
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T>): boolean {
  return Date.now() < entry.expiresAt
}

/**
 * Get cached analysis if available and valid
 */
function getCachedAnalysis(
  cacheKey: string,
): AIAnalysisResult | null {
  const cached = analysisCache.get(cacheKey)

  if (cached && isCacheValid(cached)) {
    return {
      ...cached.data,
      cached: true,
    }
  }

  // Remove expired entry
  if (cached) {
    analysisCache.delete(cacheKey)
  }

  return null
}

/**
 * Store analysis in cache
 */
function setCachedAnalysis(
  cacheKey: string,
  analysis: AIAnalysisResult,
  ttl = DEFAULT_CACHE_TTL,
): void {
  const now = Date.now()
  analysisCache.set(cacheKey, {
    data: analysis,
    timestamp: now,
    expiresAt: now + ttl,
  })
}

/**
 * Initialize Anthropic client
 * Uses API key from runtime config or environment variable
 *
 * Checks environment variable first for standalone testing,
 * then falls back to Nuxt runtime config.
 */
function getAnthropicClient(): Anthropic {
  let apiKey = process.env.ANTHROPIC_API_KEY

  // Try Nuxt runtime config if not in env (and if available)
  if (!apiKey) {
    try {
      const config = useRuntimeConfig()
      apiKey = config.anthropicApiKey
    }
    catch {
      // useRuntimeConfig not available (standalone testing)
    }
  }

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  return new Anthropic({ apiKey })
}

/**
 * Build the summary prompt with optional custom prompt
 * Similar to Figno prototype's buildPrompt() function
 */
function buildSummaryPrompt(
  thread: DiscussionThread,
  sourceType?: string,
  customPrompt?: string,
): string {
  // Build conversation history
  const messages = [
    `Root message by ${thread.rootMessage.authorHandle}:`,
    thread.rootMessage.content,
    '',
    ...thread.replies.map(
      reply =>
        `Reply by ${reply.authorHandle}:\n${reply.content}`,
    ),
  ].join('\n')

  const sourceContext = sourceType ? ` from ${sourceType}` : ''

  let prompt = ''

  // If custom prompt is provided, use it with context
  if (customPrompt) {
    console.log('[AI Service] Using custom prompt template:', customPrompt)

    // First, provide the custom instructions
    prompt = `${customPrompt}\n\n`

    // Add context about the source
    if (sourceContext) {
      prompt += `Context: This discussion is${sourceContext}.\n\n`
    }

    // Add the thread content
    prompt += `Discussion:\n${messages}\n\n`

    // Request JSON format for parsing
    prompt += `Please respond in JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "...", "..."],
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0
}`
  }
  else {
    // Default prompt structure
    prompt = `Analyze this discussion thread${sourceContext} and provide:

1. A concise summary (2-3 sentences)
2. 3-5 key points or decisions
3. Overall sentiment (positive, neutral, or negative)

Discussion:
${messages}

Respond in JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "...", "..."],
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0
}`
  }

  return prompt
}

/**
 * Generate a summary of a discussion thread
 *
 * Model: claude-sonnet-4-5-20250929 (active until at least Sept 29, 2026)
 * See: https://docs.anthropic.com/en/docs/resources/model-deprecations
 */
async function generateSummary(
  thread: DiscussionThread,
  options: AIAnalysisOptions = {},
): Promise<AISummary> {
  const client = getAnthropicClient()

  const { sourceType, customSummaryPrompt, customPrompt } = options

  // Use customSummaryPrompt if available, fallback to customPrompt for backward compatibility
  const summaryPrompt = customSummaryPrompt || customPrompt

  // Build prompt with optional custom prompt (similar to Figno prototype)
  const prompt = buildSummaryPrompt(thread, sourceType, summaryPrompt)

  console.log('[AI Service] Built summary prompt:', {
    hasCustomPrompt: !!summaryPrompt,
    customPromptLength: summaryPrompt?.length,
    promptLength: prompt.length,
  })

  const startTime = Date.now()

  const response = await retryWithBackoff(
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      timeout: 30000, // 30 second timeout to prevent hanging
    },
  )

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Parse JSON response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON from Claude response')
  }

  const result = JSON.parse(jsonMatch[0])

  console.log(
    `[AI Service] Generated summary in ${Date.now() - startTime}ms`,
  )

  return {
    summary: result.summary,
    keyPoints: result.keyPoints,
    sentiment: result.sentiment,
    confidence: result.confidence,
  }
}

/**
 * Detect actionable tasks from a discussion thread
 *
 * Model: claude-sonnet-4-5-20250929 (active until at least Sept 29, 2026)
 * See: https://docs.anthropic.com/en/docs/resources/model-deprecations
 */
async function detectTasks(
  thread: DiscussionThread,
  options: AIAnalysisOptions = {},
): Promise<TaskDetectionResult> {
  const client = getAnthropicClient()

  // Build conversation history
  const messages = [
    `Root message by ${thread.rootMessage.authorHandle}:`,
    thread.rootMessage.content,
    '',
    ...thread.replies.map(
      reply =>
        `Reply by ${reply.authorHandle}:\n${reply.content}`,
    ),
  ].join('\n')

  const maxTasks = options.maxTasks || 5

  // Use customTaskPrompt if available, fallback to customPrompt for backward compatibility
  const taskPrompt = options.customTaskPrompt || options.customPrompt

  const prompt = `<task>
Analyze this discussion and identify actionable tasks. Extract task-specific action items for each task.
</task>

<discussion>
${messages}
</discussion>

${taskPrompt ? `<custom_instructions>\n${taskPrompt}\n</custom_instructions>` : ''}

<instructions>

## Task Detection Guidelines

1. **Identify Distinct Tasks**: Look for specific, actionable work items mentioned or implied
2. **Maximum Tasks**: Extract up to ${maxTasks} tasks
3. **Empty Array**: If no clear tasks exist, return empty array
4. **Multi-Task Detection**: Set isMultiTask=true if 2+ distinct tasks exist

## Action Items Extraction (CRITICAL)

For each task, extract **task-specific action items** - concrete steps needed to complete ONLY this task.

<action_items_rules>
- Action items must be SPECIFIC to the individual task, not global discussion insights
- Each task should have 2-6 actionable checklist items
- Focus on WHAT needs to be done for THIS task, not WHY decisions were made
- Avoid duplicating the same action items across multiple tasks
- If task is simple, fewer items are okay (even 1-2)
- If no clear action items exist for a task, return null or empty array

GOOD task-specific action items:
✅ "Create collapsible nav component with 48px/240px states"
✅ "Add aria-label attributes to all navigation items"
✅ "Test responsive behavior on mobile devices"

BAD action items (too generic/global):
❌ "Analytics showed Dashboard is used 68% of the time" (this is context, not an action)
❌ "Rejected bottom nav pattern in favor of side nav" (this is a decision, not a task step)
❌ "Team decided to use Lucide icons" (this is background, not what to do)
</action_items_rules>

<examples>
Example 1 - Single task:
Discussion: "The login button needs to be bigger and have better contrast for accessibility."
Result:
{
  "isMultiTask": false,
  "tasks": [{
    "title": "Improve login button accessibility",
    "description": "Increase size and contrast of login button to meet WCAG standards",
    "actionItems": [
      "Increase button size to minimum 44x44px touch target",
      "Update button colors to meet WCAG AA contrast ratio (4.5:1)",
      "Test with screen reader to verify button announcement"
    ],
    "priority": "medium",
    "type": "improvement"
  }]
}

Example 2 - Multiple related tasks:
Discussion: "We need to redesign the navigation. Build a collapsible side nav, add accessibility features, and test it on mobile."
Result:
{
  "isMultiTask": true,
  "tasks": [
    {
      "title": "Build collapsible side navigation component",
      "description": "Create a responsive side nav that collapses on mobile",
      "actionItems": [
        "Create nav component with collapsed (48px) and expanded (240px) states",
        "Add smooth 200ms transitions between states",
        "Implement localStorage to save user preference",
        "Add 6 primary navigation items with icons"
      ],
      "priority": "high",
      "type": "feature"
    },
    {
      "title": "Add accessibility features to navigation",
      "description": "Ensure navigation meets WCAG standards",
      "actionItems": [
        "Add aria-label attributes with full text for each nav item",
        "Implement aria-current for active navigation state",
        "Add 2px focus ring with high contrast colors",
        "Test tooltip accessibility with screen readers"
      ],
      "priority": "high",
      "type": "improvement"
    },
    {
      "title": "Test navigation on mobile devices",
      "description": "Verify responsive behavior and usability across breakpoints",
      "actionItems": [
        "Test collapsed state on mobile (<768px)",
        "Verify transitions and animations are smooth",
        "Test touch interactions and gestures",
        "Validate localStorage persistence across sessions"
      ],
      "priority": "medium",
      "type": "improvement"
    }
  ]
}
</examples>

## Field Standardization

<field_rules>
### Confidence Rules (CRITICAL)
- ONLY fill fields if you are confident in the value
- If uncertain about priority, type, assignee, or other fields, return null
- Better to return null than guess incorrectly
- This maintains data quality and prevents incorrect field mappings

### Priority
Use ONLY: "low" | "medium" | "high" | "urgent" | null
- "urgent": Blocking issue, must be done immediately
- "high": Important work, should be done soon
- "medium": Normal priority work
- "low": Nice to have, can wait
- null: If uncertain

### Type
Use ONLY: "bug" | "feature" | "question" | "improvement" | null
- "bug": Something is broken and needs fixing
- "feature": New functionality or capability
- "question": Needs clarification or investigation
- "improvement": Enhancement to existing functionality
- null: If uncertain

### Assignee
Extract the Notion user ID from mentions in format "@Name (notion-uuid)"
- Return ONLY the UUID part (e.g., from "@John Doe (abc-123-def)" return "abc-123-def")
- If multiple people mentioned, pick the most relevant person for the task
- If no clear assignee or no UUID available, return null

### Tags
Extract relevant technical or categorical tags if mentioned (e.g., ["navigation", "accessibility", "mobile"])
Return null if no clear tags

### Due Date
Extract only if explicitly mentioned (format: "YYYY-MM-DD")
Return null if not mentioned or unclear
</field_rules>

</instructions>

<response_format>
Respond with ONLY valid JSON in this exact format:
{
  "isMultiTask": true|false,
  "tasks": [
    {
      "title": "Concise task title (5-10 words)",
      "description": "Clear description of what needs to be done (1-2 sentences)",
      "actionItems": ["Step 1", "Step 2", "Step 3"] or null,
      "priority": "low"|"medium"|"high"|"urgent"|null,
      "type": "bug"|"feature"|"question"|"improvement"|null,
      "assignee": "uuid-string"|null,
      "dueDate": "YYYY-MM-DD"|null,
      "tags": ["tag1", "tag2"]|null
    }
  ],
  "confidence": 0.0-1.0
}
</response_format>`

  const startTime = Date.now()

  const response = await retryWithBackoff(
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      timeout: 30000, // 30 second timeout to prevent hanging
    },
  )

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Parse JSON response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON from Claude response')
  }

  const result = JSON.parse(jsonMatch[0])

  console.log(
    `[AI Service] Detected ${result.tasks.length} task(s) in ${Date.now() - startTime}ms`,
  )

  // Log detailed task information for debugging user mappings
  console.log(`[AI Service] 🔍 Task Detection Debug - Full result:`)
  for (let i = 0; i < result.tasks.length; i++) {
    const task = result.tasks[i]
    console.log(`[AI Service] 🔍 Task ${i + 1}:`, {
      title: task.title,
      actionItems: task.actionItems?.length || 0,
      assignee: task.assignee,
      priority: task.priority,
      type: task.type,
      tags: task.tags,
      dueDate: task.dueDate,
    })

    if (task.assignee) {
      console.log(`[AI Service] ✅ AI extracted assignee: "${task.assignee}" (this will be looked up in user mappings)`)
    } else {
      console.log(`[AI Service] ⚠️  AI did not extract an assignee - returned null`)
      console.log(`[AI Service] 💡 Tip: Ensure discussion clearly mentions user with Slack ID (U...) or email`)
    }

    if (task.actionItems && task.actionItems.length > 0) {
      console.log(`[AI Service] ✅ AI extracted ${task.actionItems.length} action items for this task`)
    } else {
      console.log(`[AI Service] ⚠️  No action items extracted for this task`)
    }
  }

  return {
    isMultiTask: result.isMultiTask || result.tasks.length > 1,
    tasks: result.tasks,
    confidence: result.confidence,
  }
}

/**
 * Perform complete AI analysis of a discussion thread
 *
 * Combines summarization and task detection with intelligent caching.
 */
export async function analyzeDiscussion(
  thread: DiscussionThread,
  options: AIAnalysisOptions = {},
): Promise<AIAnalysisResult> {
  const startTime = Date.now()

  // Check cache first (unless skipCache is true)
  if (!options.skipCache) {
    const cacheKey = generateCacheKey(thread)
    const cached = getCachedAnalysis(cacheKey)

    if (cached) {
      console.log(`[AI Service] Cache hit for thread ${thread.id}`)
      return cached
    }

    console.log(`[AI Service] Cache miss for thread ${thread.id}`)
  }

  // Perform AI analysis
  console.log(`[AI Service] Analyzing thread ${thread.id}...`)

  const [summary, taskDetection] = await Promise.all([
    generateSummary(thread, options),
    detectTasks(thread, options),
  ])

  const processingTime = Date.now() - startTime

  const result: AIAnalysisResult = {
    summary,
    taskDetection,
    processingTime,
    cached: false,
  }

  // Cache the result
  if (!options.skipCache) {
    const cacheKey = generateCacheKey(thread)
    setCachedAnalysis(cacheKey, result)
    console.log(
      `[AI Service] Cached analysis for thread ${thread.id}`,
    )
  }

  console.log(
    `[AI Service] Completed analysis in ${processingTime}ms`,
  )

  return result
}

/**
 * Clear all cached analyses
 * Useful for testing or when cache needs to be invalidated
 */
export function clearAnalysisCache(): void {
  const size = analysisCache.size
  analysisCache.clear()
  console.log(`[AI Service] Cleared ${size} cached analyses`)
}

/**
 * Get cache statistics
 * Useful for monitoring and debugging
 */
export function getCacheStats() {
  const now = Date.now()
  let validEntries = 0
  let expiredEntries = 0

  for (const entry of analysisCache.values()) {
    if (isCacheValid(entry)) {
      validEntries++
    }
    else {
      expiredEntries++
    }
  }

  return {
    totalEntries: analysisCache.size,
    validEntries,
    expiredEntries,
    timestamp: now,
  }
}

/**
 * Clean up expired cache entries
 * Should be called periodically (e.g., every hour)
 */
export function cleanupExpiredCache(): void {
  const before = analysisCache.size

  for (const [key, entry] of analysisCache.entries()) {
    if (!isCacheValid(entry)) {
      analysisCache.delete(key)
    }
  }

  const removed = before - analysisCache.size

  if (removed > 0) {
    console.log(
      `[AI Service] Cleaned up ${removed} expired cache entries`,
    )
  }
}

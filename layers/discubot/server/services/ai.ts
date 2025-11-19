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

  const prompt = `Analyze this discussion and identify actionable tasks.

Discussion:
${messages}

${taskPrompt || ''}

Instructions:
- Identify specific, actionable tasks mentioned or implied
- Extract title, description, and metadata for each task
- Determine if there are multiple distinct tasks (isMultiTask: true/false)
- Maximum ${maxTasks} tasks
- If no clear tasks, return empty array

CRITICAL - Confidence Rules:
- ONLY fill fields if you are confident in the value
- If uncertain about priority, type, assignee, or other fields, return null
- Better to return null than guess incorrectly
- This maintains data quality and prevents incorrect field mappings

Field Standardization:
- priority: Use ONLY "low", "medium", "high", "urgent", or null (if uncertain)
- type: Use ONLY "bug", "feature", "question", "improvement", or null (if uncertain)
- assignee: Extract the Notion user ID from mentions in format "@Name (notion-uuid)"
  - Return ONLY the UUID part (e.g., from "@John Doe (abc-123-def)" return "abc-123-def")
  - If multiple people mentioned, pick the most relevant person for the task
  - If no clear assignee or no UUID available, return null
- tags: Extract relevant tags if mentioned, otherwise null
- dueDate: Extract if explicitly mentioned, otherwise null

Respond in JSON format:
{
  "isMultiTask": true|false,
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "priority": "low"|"medium"|"high"|"urgent"|null,
      "type": "bug"|"feature"|"question"|"improvement"|null,
      "assignee": "U123ABC"|"user@example.com"|null,
      "dueDate": "2024-01-15"|null,
      "tags": ["tag1", "tag2"]|null
    }
  ],
  "confidence": 0.0-1.0
}`

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

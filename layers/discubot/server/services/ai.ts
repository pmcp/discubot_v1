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
} from '../../types'
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
 * Generate a summary of a discussion thread
 *
 * Model: claude-sonnet-4-5-20250929 (active until at least Sept 29, 2026)
 * See: https://docs.anthropic.com/en/docs/resources/model-deprecations
 */
async function generateSummary(
  thread: DiscussionThread,
  sourceType?: string,
): Promise<AISummary> {
  const client = getAnthropicClient()

  // Build conversation history for Claude
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

  const prompt = `Analyze this discussion thread${sourceContext} and provide:

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

  const prompt = `Analyze this discussion and identify actionable tasks.

Discussion:
${messages}

${options.customPrompt || ''}

Instructions:
- Identify specific, actionable tasks mentioned or implied
- Extract title, description, and priority for each task
- Determine if there are multiple distinct tasks (isMultiTask: true/false)
- Maximum ${maxTasks} tasks
- If no clear tasks, return empty array

Respond in JSON format:
{
  "isMultiTask": true|false,
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "priority": "low|medium|high|urgent",
      "assignee": "...",
      "tags": ["..."]
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
    generateSummary(thread, options.sourceType),
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

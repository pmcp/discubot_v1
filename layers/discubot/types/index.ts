/**
 * Shared TypeScript types for Discubot
 *
 * These types are used across services, adapters, and the processor pipeline.
 */

/**
 * A single message in a discussion thread
 */
export interface ThreadMessage {
  id: string
  authorHandle: string
  content: string
  timestamp: Date
  attachments?: Attachment[]
}

/**
 * File attachment metadata
 */
export interface Attachment {
  url: string
  fileName: string
  mimeType?: string
  size?: number
}

/**
 * Complete discussion thread with all messages
 * This is stored as JSON in discussions.threadData
 */
export interface DiscussionThread {
  id: string
  rootMessage: ThreadMessage
  replies: ThreadMessage[]
  participants: string[]
  metadata: Record<string, any>
}

/**
 * AI-generated summary of a discussion
 */
export interface AISummary {
  summary: string
  keyPoints: string[]
  sentiment?: 'positive' | 'neutral' | 'negative'
  confidence?: number
}

/**
 * A single detected task from AI analysis
 *
 * Note: Fields use optional (?) syntax which allows null/undefined.
 * AI should return null when uncertain to maintain data quality.
 */
export interface DetectedTask {
  title: string
  description: string
  /** Task-specific action items (concrete steps for THIS task only) */
  actionItems?: string[] | null
  /** Priority level - AI returns null if uncertain */
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null
  /** Task type - AI returns null if uncertain */
  type?: 'bug' | 'feature' | 'question' | 'improvement' | null
  /** Assignee as Slack/Figma user ID or email - AI returns null if uncertain */
  assignee?: string | null
  dueDate?: Date | null
  tags?: string[] | null
}

/**
 * Result of AI task detection
 */
export interface TaskDetectionResult {
  isMultiTask: boolean
  tasks: DetectedTask[]
  confidence?: number
}

/**
 * Complete AI analysis result
 */
export interface AIAnalysisResult {
  summary: AISummary
  taskDetection: TaskDetectionResult
  processingTime: number
  cached: boolean
}

/**
 * Discussion status values
 */
export type DiscussionStatus =
  | 'pending'
  | 'processing'
  | 'analyzed'
  | 'completed'
  | 'failed'
  | 'retrying'

/**
 * Options for AI analysis
 */
export interface AIAnalysisOptions {
  /** Skip cache and force fresh analysis */
  skipCache?: boolean
  /** Custom prompt additions (legacy - use customSummaryPrompt/customTaskPrompt) */
  customPrompt?: string
  /** Custom summary prompt template */
  customSummaryPrompt?: string
  /** Custom task detection prompt */
  customTaskPrompt?: string
  /** Source type for context-aware prompts */
  sourceType?: string
  /** Maximum number of tasks to detect */
  maxTasks?: number
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

/**
 * Service error with retry metadata
 */
export interface ServiceError extends Error {
  code?: string
  statusCode?: number
  retryable?: boolean
  retryAfter?: number
}

/**
 * Configuration for Notion task creation
 */
export interface NotionTaskConfig {
  /** Notion database ID (without dashes) */
  databaseId: string
  /** Optional API key override (uses runtime config if not provided) */
  apiKey?: string
  /** Source type for metadata (e.g., 'Figma', 'Slack') */
  sourceType: string
  /** Deep link URL back to source discussion */
  sourceUrl: string
}

/**
 * Result of Notion task creation
 */
export interface NotionTaskResult {
  /** Notion page ID */
  id: string
  /** Public URL to the Notion page */
  url: string
  /** Creation timestamp */
  createdAt: Date
}

// ============================================================================
// ADAPTER TYPES
// ============================================================================

/**
 * Parsed discussion from incoming webhook/email
 * This is the standardized format that all adapters output
 */
export interface ParsedDiscussion {
  /** Source type (e.g., 'figma', 'slack', 'linear') */
  sourceType: string
  /** Unique thread ID in source system */
  sourceThreadId: string
  /** Deep link URL to discussion in source */
  sourceUrl: string
  /** Resolved team ID */
  teamId: string
  /** User handle who created the discussion */
  authorHandle: string
  /** Discussion title or subject */
  title: string
  /** Main content/body */
  content: string
  /** List of participant handles */
  participants: string[]
  /** Creation timestamp */
  timestamp: Date
  /** Source-specific metadata */
  metadata: Record<string, any>
}

/**
 * Source configuration from the configs collection
 * Contains API keys and settings for a specific source
 */
export interface SourceConfig {
  /** Config record ID */
  id: string
  /** Team ID this config belongs to */
  teamId: string
  /** Source type (e.g., 'figma', 'slack') */
  sourceType: string
  /** Display name for this configuration */
  name: string
  /** Source API token/key */
  apiToken: string
  /** Notion API token */
  notionToken: string
  /** Notion database ID (without dashes) */
  notionDatabaseId: string
  /** Optional Anthropic API key override */
  anthropicApiKey?: string
  /** Whether AI analysis is enabled */
  aiEnabled: boolean
  /** Whether auto-sync is enabled */
  autoSync: boolean
  /** Source-specific settings (e.g., Slack workspace ID) */
  settings: Record<string, any>
  /** Source-specific metadata (e.g., Slack bot user ID, team IDs) */
  sourceMetadata?: Record<string, any>
  /** AI summary prompt override */
  aiSummaryPrompt?: string
  /** AI task detection prompt override */
  aiTaskPrompt?: string
  /** Notion field mapping configuration */
  notionFieldMapping?: Record<string, any>
  /** Webhook URL for receiving events */
  webhookUrl?: string
  /** Whether this config is active */
  active: boolean
}

/**
 * Result of configuration validation
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Validation errors (if any) */
  errors: string[]
  /** Validation warnings (if any) */
  warnings: string[]
}

/**
 * Retry options for operations
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number
  /** Initial delay in milliseconds */
  initialDelay?: number
  /** Maximum delay in milliseconds */
  maxDelay?: number
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number
}

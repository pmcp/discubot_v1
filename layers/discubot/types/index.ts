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
 */
export interface DetectedTask {
  title: string
  description: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignee?: string
  dueDate?: Date
  tags?: string[]
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
  /** Custom prompt additions */
  customPrompt?: string
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

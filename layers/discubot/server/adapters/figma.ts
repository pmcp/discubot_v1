/**
 * Figma Discussion Source Adapter
 *
 * Implements the DiscussionSourceAdapter interface for Figma comments.
 * Handles:
 * - Email-based webhook parsing (via Mailgun)
 * - Fetching comment threads from Figma API
 * - Posting replies to Figma comments
 * - Adding reaction status indicators
 * - Configuration validation and testing
 *
 * @see https://developers.figma.com/docs/rest-api/comments-endpoints/
 */

import type {
  DiscussionSourceAdapter,
  ParsedDiscussion,
  DiscussionThread,
  DiscussionStatus,
  SourceConfig,
  ValidationResult,
  ThreadMessage,
} from '~/layers/discubot/types'
import { AdapterError } from './base'
import {
  parseFigmaEmail,
  extractFileKeyFromUrl,
} from '../utils/emailParser'

/**
 * Figma API base URL
 */
const FIGMA_API_BASE = 'https://api.figma.com/v1'

/**
 * Figma API comment object structure
 */
interface FigmaComment {
  id: string
  file_key: string
  parent_id: string
  user: {
    id: string
    handle: string
    img_url?: string
  }
  created_at: string
  resolved_at: string | null
  message: string
  client_meta?: {
    x?: number
    y?: number
    node_id?: string[]
  }
  order_id: number
}

/**
 * Figma API comments response
 */
interface FigmaCommentsResponse {
  comments: FigmaComment[]
}

/**
 * Figma API error response
 */
interface FigmaErrorResponse {
  status: number
  err?: string
  message?: string
}

/**
 * Figma Adapter Implementation
 */
export class FigmaAdapter implements DiscussionSourceAdapter {
  readonly sourceType = 'figma'

  /**
   * Parse incoming Mailgun webhook containing a Figma email
   *
   * The email should contain:
   * - Figma comment notification
   * - File URL with file key
   * - Sender information
   * - Recipient (used for team resolution)
   *
   * @throws AdapterError if email cannot be parsed or team cannot be resolved
   */
  async parseIncoming(payload: any): Promise<ParsedDiscussion> {
    try {
      // Parse the Mailgun email payload
      const parsed = parseFigmaEmail(payload)

      // Validate required fields
      if (!parsed.fileKey) {
        throw new AdapterError('No Figma file key found in email', {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      if (!parsed.text || parsed.text.trim() === '') {
        throw new AdapterError('No comment text found in email', {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      // Resolve team ID from recipient email
      // Format expected: <team-slug>@discubot.yourdomain.com
      const teamId = this.extractTeamIdFromRecipient(payload.recipient)

      // Extract email slug for config matching (the part before @)
      const emailSlug = this.extractTeamIdFromRecipient(payload.recipient)

      // Build source thread ID (format: fileKey:commentId)
      // Note: commentId might not be available from email, will be resolved during fetchThread
      const sourceThreadId = parsed.fileKey

      // Build source URL
      const sourceUrl = parsed.fileUrl || `https://www.figma.com/file/${parsed.fileKey}`

      // Extract participants from email
      const participants = this.extractParticipants(parsed)

      return {
        sourceType: this.sourceType,
        sourceThreadId,
        sourceUrl,
        teamId,
        authorHandle: parsed.author || 'unknown',
        title: parsed.subject || 'Figma Comment',
        content: parsed.text,
        participants,
        timestamp: parsed.timestamp || new Date(),
        metadata: {
          fileKey: parsed.fileKey,
          emailType: parsed.emailType,
          fileName: parsed.fileName,
          links: parsed.links,
          emailSlug,  // Add email slug for config matching
          recipientEmail: payload.recipient,  // Store full recipient email
        },
      }
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error
      }
      throw new AdapterError(`Failed to parse Figma email: ${(error as Error).message}`, {
        sourceType: this.sourceType,
        retryable: false,
      })
    }
  }

  /**
   * Fetch complete comment thread from Figma API
   *
   * Uses GET /v1/files/:key/comments endpoint to retrieve all comments
   * on a file, then builds a thread structure with root comment and replies.
   *
   * @param threadId - Figma file key or "fileKey:commentId" format
   * @param config - Source configuration with API token
   */
  async fetchThread(
    threadId: string,
    config: SourceConfig,
  ): Promise<DiscussionThread> {
    try {
      // Extract file key from threadId (format: "fileKey" or "fileKey:commentId")
      const [fileKey, targetCommentId] = threadId.split(':')

      // Fetch all comments from the file
      const url = `${FIGMA_API_BASE}/files/${fileKey}/comments`
      const response = await fetch(url, {
        headers: {
          'X-Figma-Token': config.apiToken,
        },
      })

      if (!response.ok) {
        const error = await this.handleApiError(response)
        throw error
      }

      const data = await response.json() as FigmaCommentsResponse

      // If targetCommentId is provided, find that specific comment thread
      // Otherwise, use the most recent root comment
      const rootComment = targetCommentId
        ? data.comments.find(c => c.id === targetCommentId)
        : this.findMostRecentRootComment(data.comments)

      if (!rootComment) {
        throw new AdapterError('Comment not found in file', {
          sourceType: this.sourceType,
          threadId,
          statusCode: 404,
          retryable: false,
        })
      }

      // Build thread structure
      const rootMessage = this.convertToThreadMessage(rootComment)
      const replies = data.comments
        .filter(c => c.parent_id === rootComment.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(c => this.convertToThreadMessage(c))

      // Extract participants
      const participantHandles = new Set<string>()
      participantHandles.add(rootComment.user.handle)
      replies.forEach(r => participantHandles.add(r.authorHandle))

      return {
        id: rootComment.id,
        rootMessage,
        replies,
        participants: Array.from(participantHandles),
        metadata: {
          fileKey,
          fileName: '', // Not available from API
          resolved: rootComment.resolved_at !== null,
          createdAt: rootComment.created_at,
        },
      }
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error
      }
      throw new AdapterError(`Failed to fetch Figma thread: ${(error as Error).message}`, {
        sourceType: this.sourceType,
        threadId,
        retryable: true,
      })
    }
  }

  /**
   * Post a reply to a Figma comment thread
   *
   * Uses POST /v1/files/:file_key/comments endpoint with comment_id
   * to create a threaded reply.
   *
   * @param threadId - Format: "fileKey:commentId"
   * @param message - Reply message (plain text or markdown)
   * @param config - Source configuration with API token
   */
  async postReply(
    threadId: string,
    message: string,
    config: SourceConfig,
  ): Promise<boolean> {
    try {
      const [fileKey, commentId] = threadId.split(':')

      if (!commentId) {
        console.warn('No commentId provided, cannot post reply')
        return false
      }

      const url = `${FIGMA_API_BASE}/files/${fileKey}/comments`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Figma-Token': config.apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          comment_id: commentId, // Makes this a threaded reply
        }),
      })

      if (!response.ok) {
        const error = await this.handleApiError(response)
        console.error('Failed to post Figma reply:', error.message)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to post Figma reply:', error)
      return false
    }
  }

  /**
   * Update status by adding a reaction emoji to the comment
   *
   * Uses POST /v1/files/:file_key/comments/:comment_id/reactions
   * to add emoji reactions as status indicators.
   *
   * Status → Emoji mapping:
   * - pending → 👀 (:eyes:)
   * - processing → ⏳ (:hourglass:)
   * - analyzed → 🤖 (:robot:)
   * - completed → ✅ (:white_check_mark:)
   * - failed → ❌ (:x:)
   * - retrying → 🔄 (:arrows_counterclockwise:)
   */
  async updateStatus(
    threadId: string,
    status: DiscussionStatus,
    config: SourceConfig,
  ): Promise<boolean> {
    try {
      const [fileKey, commentId] = threadId.split(':')

      if (!commentId) {
        console.warn('No commentId provided, cannot update status')
        return false
      }

      // Map status to emoji
      const emojiMap: Record<DiscussionStatus, string> = {
        pending: ':eyes:',
        processing: ':hourglass:',
        analyzed: ':robot:',
        completed: ':white_check_mark:',
        failed: ':x:',
        retrying: ':arrows_counterclockwise:',
      }

      const emoji = emojiMap[status]

      const url = `${FIGMA_API_BASE}/files/${fileKey}/comments/${commentId}/reactions`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Figma-Token': config.apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      })

      if (!response.ok) {
        const error = await this.handleApiError(response)
        console.error('Failed to update Figma status:', error.message)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to update Figma status:', error)
      return false
    }
  }

  /**
   * Remove a reaction emoji from a Figma comment
   *
   * Uses DELETE /v1/files/:file_key/comments/:comment_id/reactions
   * to remove emoji reactions.
   *
   * @param threadId - Format: "fileKey:commentId"
   * @param emoji - Emoji to remove (e.g., "eyes", without colons)
   * @param config - Source configuration with API token
   */
  async removeReaction(
    threadId: string,
    emoji: string,
    config: SourceConfig,
  ): Promise<boolean> {
    try {
      const [fileKey, commentId] = threadId.split(':')

      if (!commentId) {
        console.warn('No commentId provided, cannot remove reaction')
        return false
      }

      // Map common emoji names to Figma format (with colons)
      const emojiMap: Record<string, string> = {
        'eyes': ':eyes:',
        'hourglass': ':hourglass:',
        'robot': ':robot:',
        'white_check_mark': ':white_check_mark:',
        'x': ':x:',
        'arrows_counterclockwise': ':arrows_counterclockwise:',
      }

      const figmaEmoji = emojiMap[emoji] || (emoji.startsWith(':') ? emoji : `:${emoji}:`)

      const url = `${FIGMA_API_BASE}/files/${fileKey}/comments/${commentId}/reactions?emoji=${encodeURIComponent(figmaEmoji)}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-Figma-Token': config.apiToken,
        },
      })

      if (!response.ok) {
        // Don't treat 404 as an error (reaction might not exist)
        if (response.status === 404) {
          console.log('Reaction not found (already removed or never added)')
          return true
        }
        const error = await this.handleApiError(response)
        console.error('Failed to remove Figma reaction:', error.message)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to remove Figma reaction:', error)
      return false
    }
  }

  /**
   * Validate Figma source configuration
   *
   * Checks:
   * - API token is present and properly formatted
   * - Notion token is present
   * - Notion database ID is present
   * - Settings are valid
   */
  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check API token
    if (!config.apiToken || config.apiToken.trim() === '') {
      errors.push('Figma API token is required')
    } else if (config.apiToken.length < 20) {
      warnings.push('Figma API token appears to be too short')
    }

    // Check Notion configuration
    if (!config.notionToken || config.notionToken.trim() === '') {
      errors.push('Notion API token is required')
    }

    if (!config.notionDatabaseId || config.notionDatabaseId.trim() === '') {
      errors.push('Notion database ID is required')
    }

    // Check source type matches
    if (config.sourceType !== this.sourceType) {
      errors.push(`Source type mismatch: expected '${this.sourceType}', got '${config.sourceType}'`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Test connection to Figma API
   *
   * Makes a simple API call to verify the token is valid and API is reachable.
   * Uses the /v1/me endpoint to check authentication.
   */
  async testConnection(config: SourceConfig): Promise<boolean> {
    try {
      const url = `${FIGMA_API_BASE}/me`
      const response = await fetch(url, {
        headers: {
          'X-Figma-Token': config.apiToken,
        },
      })

      return response.ok
    } catch (error) {
      console.error('Failed to test Figma connection:', error)
      return false
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Extract team ID from recipient email address
   *
   * Expected format: <team-slug>@discubot.yourdomain.com
   * Falls back to 'default' if parsing fails
   */
  private extractTeamIdFromRecipient(recipient: string): string {
    if (!recipient) {
      return 'default'
    }

    // Extract the local part before @
    const match = recipient.match(/^([^@]+)@/)
    if (!match) {
      return 'default'
    }

    return match[1]
  }

  /**
   * Extract participant handles from parsed email
   */
  private extractParticipants(parsed: any): string[] {
    const participants = new Set<string>()

    // Add author
    if (parsed.author) {
      participants.add(parsed.author)
    }

    // Could parse mentions from content in the future
    // For now, just return the author

    return Array.from(participants)
  }

  /**
   * Find the most recent root comment (comment without parent)
   * Used when no specific comment ID is provided
   */
  private findMostRecentRootComment(comments: FigmaComment[]): FigmaComment | undefined {
    const rootComments = comments.filter(c => !c.parent_id)
    if (rootComments.length === 0) {
      return undefined
    }

    return rootComments.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
  }

  /**
   * Convert Figma comment to ThreadMessage format
   */
  private convertToThreadMessage(comment: FigmaComment): ThreadMessage {
    return {
      id: comment.id,
      authorHandle: comment.user.handle,
      content: comment.message,
      timestamp: new Date(comment.created_at),
    }
  }

  /**
   * Handle Figma API errors and convert to AdapterError
   */
  private async handleApiError(response: Response): Promise<AdapterError> {
    let errorMessage = `Figma API error: ${response.status} ${response.statusText}`
    let retryable = false

    try {
      const errorData = await response.json() as FigmaErrorResponse
      if (errorData.err || errorData.message) {
        errorMessage = errorData.err || errorData.message || errorMessage
      }
    } catch {
      // Unable to parse error response, use default message
    }

    // Determine if error is retryable
    if (response.status >= 500 || response.status === 429) {
      retryable = true
    }

    return new AdapterError(errorMessage, {
      sourceType: this.sourceType,
      statusCode: response.status,
      retryable,
    })
  }
}

/**
 * Create a new Figma adapter instance
 */
export function createFigmaAdapter(): DiscussionSourceAdapter {
  return new FigmaAdapter()
}

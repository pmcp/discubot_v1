/**
 * Slack Discussion Source Adapter
 *
 * Implements the DiscussionSourceAdapter interface for Slack messages.
 * Handles:
 * - Event-based webhook parsing (Slack Events API)
 * - Fetching message threads from Slack API
 * - Posting threaded replies to Slack channels
 * - Adding reaction status indicators
 * - Configuration validation and testing
 *
 * @see https://api.slack.com/events
 * @see https://api.slack.com/methods
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

/**
 * Slack API base URL
 */
const SLACK_API_BASE = 'https://slack.com/api'

/**
 * Slack message event structure
 */
interface SlackMessage {
  type: string
  user: string
  text: string
  ts: string // Timestamp (unique message ID)
  thread_ts?: string // Parent message timestamp (if threaded)
  channel?: string
  team?: string
  attachments?: Array<{
    fallback: string
    text?: string
    id: number
  }>
}

/**
 * Slack event payload structure
 */
interface SlackEventPayload {
  token?: string
  team_id: string
  api_app_id?: string
  event: {
    type: string
    channel: string
    user: string
    text: string
    ts: string
    thread_ts?: string
    channel_type?: string
  }
  type: string
  event_id?: string
  event_time?: number
}

/**
 * Slack conversations.replies response
 */
interface SlackThreadResponse {
  ok: boolean
  messages: SlackMessage[]
  has_more: boolean
  error?: string
}

/**
 * Slack chat.postMessage response
 */
interface SlackPostMessageResponse {
  ok: boolean
  channel?: string
  ts?: string
  message?: SlackMessage
  error?: string
}

/**
 * Slack reactions.add response
 */
interface SlackReactionResponse {
  ok: boolean
  error?: string
}

/**
 * Slack auth.test response (for connection testing)
 */
interface SlackAuthTestResponse {
  ok: boolean
  url?: string
  team?: string
  user?: string
  team_id?: string
  user_id?: string
  error?: string
}

/**
 * Slack Adapter Implementation
 */
export class SlackAdapter implements DiscussionSourceAdapter {
  readonly sourceType = 'slack'

  /**
   * Parse incoming Slack event webhook
   *
   * The event should contain:
   * - Message event from Slack Events API
   * - Channel ID
   * - User ID
   * - Message text and timestamp
   * - Optional thread_ts for threaded messages
   *
   * @throws AdapterError if event cannot be parsed or team cannot be resolved
   */
  async parseIncoming(payload: any): Promise<ParsedDiscussion> {
    try {
      // Handle Slack URL verification challenge
      if (payload.type === 'url_verification') {
        throw new AdapterError('URL verification challenge received - handle separately', {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      // Validate event structure
      if (!payload.event) {
        throw new AdapterError('No event found in Slack payload', {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      const event = payload.event

      // Only process message and app_mention events
      if (event.type !== 'message' && event.type !== 'app_mention') {
        throw new AdapterError(`Unsupported event type: ${event.type}`, {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      // Ignore message subtypes (edits, deletes, etc.)
      // Note: app_mention events never have subtypes
      if (event.type === 'message' && event.subtype) {
        throw new AdapterError(`Message subtype not supported: ${event.subtype}`, {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      // Validate required fields
      if (!event.text || event.text.trim() === '') {
        throw new AdapterError('No message text found in event', {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      if (!event.channel) {
        throw new AdapterError('No channel ID found in event', {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      if (!event.user) {
        throw new AdapterError('No user ID found in event', {
          sourceType: this.sourceType,
          retryable: false,
        })
      }

      // Extract Slack workspace team ID from payload
      const slackTeamId = payload.team_id || 'default'

      // Build source thread ID (format: channel:thread_ts or channel:ts)
      // If this is a threaded reply, use thread_ts; otherwise use ts (this is the root)
      const threadTimestamp = event.thread_ts || event.ts
      const sourceThreadId = `${event.channel}:${threadTimestamp}`

      // Build source URL (HTTPS link to Slack message for web access)
      // Format: https://[workspace].slack.com/archives/[channel]/p[timestamp_without_dot]
      // Note: We use a generic slack.com link since we don't know the workspace subdomain
      // The team parameter allows Slack to redirect to the correct workspace
      const messageTs = event.ts.replace('.', '')
      const sourceUrl = `https://slack.com/app_redirect?team=${slackTeamId}&channel=${event.channel}&message_ts=${event.ts}`

      // Extract participants (for now, just the message author)
      // Will be enriched when we fetch the full thread
      const participants = [event.user]

      return {
        sourceType: this.sourceType,
        sourceThreadId,
        sourceUrl,
        teamId: slackTeamId, // For now, use Slack team ID (will be mapped to internal team in processor)
        authorHandle: event.user,
        title: this.extractTitle(event.text),
        content: event.text,
        participants,
        timestamp: new Date(parseFloat(event.ts) * 1000),
        metadata: {
          slackTeamId, // Store Slack workspace team ID for config lookup
          channelId: event.channel,
          messageTs: event.ts,
          threadTs: event.thread_ts,
          channelType: event.channel_type,
        },
      }
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error
      }
      throw new AdapterError(`Failed to parse Slack event: ${(error as Error).message}`, {
        sourceType: this.sourceType,
        retryable: false,
      })
    }
  }

  /**
   * Fetch complete message thread from Slack API
   *
   * Uses conversations.replies endpoint to retrieve all messages in a thread.
   *
   * @param threadId - Format: "channel:thread_ts"
   * @param config - Source configuration with API token
   */
  async fetchThread(
    threadId: string,
    config: SourceConfig,
  ): Promise<DiscussionThread> {
    try {
      // Extract channel and thread timestamp from threadId
      const [channelId, threadTs] = threadId.split(':')

      if (!channelId || !threadTs) {
        throw new AdapterError('Invalid thread ID format, expected "channel:thread_ts"', {
          sourceType: this.sourceType,
          threadId,
          retryable: false,
        })
      }

      // Fetch thread messages using conversations.replies
      const url = `${SLACK_API_BASE}/conversations.replies`
      const params = new URLSearchParams({
        channel: channelId,
        ts: threadTs,
        limit: '100', // Get up to 100 messages
      })

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new AdapterError(`Slack API error: ${response.status} ${response.statusText}`, {
          sourceType: this.sourceType,
          threadId,
          statusCode: response.status,
          retryable: response.status >= 500 || response.status === 429,
        })
      }

      const data = await response.json() as SlackThreadResponse

      if (!data.ok) {
        throw new AdapterError(`Slack API error: ${data.error || 'Unknown error'}`, {
          sourceType: this.sourceType,
          threadId,
          retryable: data.error === 'rate_limited',
        })
      }

      if (!data.messages || data.messages.length === 0) {
        throw new AdapterError('No messages found in thread', {
          sourceType: this.sourceType,
          threadId,
          statusCode: 404,
          retryable: false,
        })
      }

      // First message is the root (parent)
      const rootMessage = data.messages[0]
      const replies = data.messages.slice(1)

      // Extract participants
      const participantSet = new Set<string>()
      participantSet.add(rootMessage.user)
      replies.forEach(msg => {
        if (msg.user) {
          participantSet.add(msg.user)
        }
      })

      return {
        id: threadTs,
        rootMessage: this.convertToThreadMessage(rootMessage),
        replies: replies.map(msg => this.convertToThreadMessage(msg)),
        participants: Array.from(participantSet),
        metadata: {
          channelId,
          threadTs,
          messageCount: data.messages.length,
          hasMore: data.has_more,
        },
      }
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error
      }
      throw new AdapterError(`Failed to fetch Slack thread: ${(error as Error).message}`, {
        sourceType: this.sourceType,
        threadId,
        retryable: true,
      })
    }
  }

  /**
   * Post a threaded reply to a Slack message
   *
   * Uses chat.postMessage endpoint with thread_ts to create a threaded reply.
   *
   * @param threadId - Format: "channel:thread_ts"
   * @param message - Reply message (supports Slack markdown)
   * @param config - Source configuration with API token
   */
  async postReply(
    threadId: string,
    message: string,
    config: SourceConfig,
  ): Promise<boolean> {
    try {
      const [channelId, threadTs] = threadId.split(':')

      if (!channelId || !threadTs) {
        console.warn('Invalid thread ID format, cannot post reply')
        return false
      }

      const url = `${SLACK_API_BASE}/chat.postMessage`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          text: message,
          thread_ts: threadTs, // Makes this a threaded reply
        }),
      })

      if (!response.ok) {
        console.error(`Failed to post Slack reply: ${response.status} ${response.statusText}`)
        return false
      }

      const data = await response.json() as SlackPostMessageResponse

      if (!data.ok) {
        console.error(`Failed to post Slack reply: ${data.error || 'Unknown error'}`)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to post Slack reply:', error)
      return false
    }
  }

  /**
   * Update status by adding a reaction emoji to the message
   *
   * Uses reactions.add endpoint to add emoji reactions as status indicators.
   *
   * Status → Emoji mapping:
   * - pending → eyes
   * - processing → hourglass_flowing_sand
   * - analyzed → robot_face
   * - completed → white_check_mark
   * - failed → x
   * - retrying → arrows_counterclockwise
   */
  async updateStatus(
    threadId: string,
    status: DiscussionStatus,
    config: SourceConfig,
  ): Promise<boolean> {
    try {
      const [channelId, threadTs] = threadId.split(':')

      if (!channelId || !threadTs) {
        console.warn('Invalid thread ID format, cannot update status')
        return false
      }

      // Map status to Slack emoji name (without colons)
      const emojiMap: Record<DiscussionStatus, string> = {
        pending: 'eyes',
        processing: 'hourglass_flowing_sand',
        analyzed: 'robot_face',
        completed: 'white_check_mark',
        failed: 'x',
        retrying: 'arrows_counterclockwise',
      }

      const emoji = emojiMap[status]

      const url = `${SLACK_API_BASE}/reactions.add`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          timestamp: threadTs,
          name: emoji,
        }),
      })

      if (!response.ok) {
        console.error(`Failed to update Slack status: ${response.status} ${response.statusText}`)
        return false
      }

      const data = await response.json() as SlackReactionResponse

      if (!data.ok) {
        // Don't log error if reaction already exists
        if (data.error !== 'already_reacted') {
          console.error(`Failed to update Slack status: ${data.error || 'Unknown error'}`)
        }
        return data.error === 'already_reacted' // Consider already_reacted as success
      }

      return true
    } catch (error) {
      console.error('Failed to update Slack status:', error)
      return false
    }
  }

  /**
   * Validate Slack source configuration
   *
   * Checks:
   * - API token is present and properly formatted
   * - Notion token is present
   * - Notion database ID is present
   * - Workspace ID is present in settings
   * - Settings are valid
   */
  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check API token
    if (!config.apiToken || config.apiToken.trim() === '') {
      errors.push('Slack API token is required')
    } else if (!config.apiToken.startsWith('xoxb-') && !config.apiToken.startsWith('xoxp-')) {
      warnings.push('Slack API token should start with "xoxb-" (bot token) or "xoxp-" (user token)')
    }

    // Check Notion configuration
    if (!config.notionToken || config.notionToken.trim() === '') {
      errors.push('Notion API token is required')
    }

    if (!config.notionDatabaseId || config.notionDatabaseId.trim() === '') {
      errors.push('Notion database ID is required')
    }

    // Check Slack workspace ID in settings
    if (!config.settings?.workspaceId) {
      warnings.push('Slack workspace ID not found in settings - deep links may not work correctly')
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
   * Test connection to Slack API
   *
   * Makes a simple API call to verify the token is valid and API is reachable.
   * Uses the auth.test endpoint to check authentication.
   */
  async testConnection(config: SourceConfig): Promise<boolean> {
    try {
      const url = `${SLACK_API_BASE}/auth.test`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json() as SlackAuthTestResponse
      return data.ok
    } catch (error) {
      console.error('Failed to test Slack connection:', error)
      return false
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Extract a title from message text
   * Uses first line or first 50 characters
   */
  private extractTitle(text: string): string {
    if (!text) {
      return 'Slack Message'
    }

    // Get first line
    const firstLine = text.split('\n')[0].trim()

    // Truncate to 50 chars if needed
    if (firstLine.length > 50) {
      return firstLine.substring(0, 47) + '...'
    }

    return firstLine || 'Slack Message'
  }

  /**
   * Convert Slack message to ThreadMessage format
   */
  private convertToThreadMessage(message: SlackMessage): ThreadMessage {
    return {
      id: message.ts,
      authorHandle: message.user,
      content: message.text,
      timestamp: new Date(parseFloat(message.ts) * 1000),
    }
  }
}

/**
 * Create a new Slack adapter instance
 */
export function createSlackAdapter(): DiscussionSourceAdapter {
  return new SlackAdapter()
}

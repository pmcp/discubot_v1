/**
 * Slack Webhook Endpoint - Events API Handler
 *
 * Receives POST requests from Slack Events API containing message events.
 * Processes the message and creates a discussion with AI analysis and Notion tasks.
 *
 * **Flow:**
 * 1. Handle URL verification challenge (one-time setup)
 * 2. Receive Slack event webhook payload
 * 3. Parse event using Slack adapter
 * 4. Process discussion through pipeline
 * 5. Return success/error response
 *
 * **Slack Events API Payload Structure:**
 * ```json
 * {
 *   "token": "verification_token",
 *   "team_id": "T123ABC456",
 *   "api_app_id": "A123ABC456",
 *   "event": {
 *     "type": "message",
 *     "channel": "C123ABC456",
 *     "user": "U123ABC456",
 *     "text": "Hello, world!",
 *     "ts": "1234567890.123456",
 *     "thread_ts": "1234567890.123456"
 *   },
 *   "type": "event_callback",
 *   "event_id": "Ev123ABC456",
 *   "event_time": 1234567890
 * }
 * ```
 *
 * **URL Verification Challenge:**
 * When first configuring the webhook URL in Slack, Slack sends a challenge:
 * ```json
 * {
 *   "type": "url_verification",
 *   "challenge": "random_challenge_string"
 * }
 * ```
 * Respond with: `{ "challenge": "random_challenge_string" }`
 *
 * **Endpoint:** POST /api/webhooks/slack
 * **Auth:** None (public webhook - signature verification deferred to Phase 6)
 *
 * @see https://api.slack.com/events-api
 * @see https://api.slack.com/events/url_verification
 */

import type { ParsedDiscussion } from '~/layers/discubot/types'
import { getAdapter } from '../../adapters'
import { processDiscussion } from '../../services/processor'

/**
 * Slack webhook payload structure (event_callback type)
 */
interface SlackEventPayload {
  token?: string
  team_id: string
  api_app_id?: string
  event: {
    type: string
    channel?: string
    user?: string
    text?: string
    ts?: string
    thread_ts?: string
    channel_type?: string
    subtype?: string
  }
  type: string
  event_id?: string
  event_time?: number
  [key: string]: any
}

/**
 * Slack URL verification challenge payload
 */
interface SlackUrlVerificationPayload {
  type: 'url_verification'
  challenge: string
  token?: string
}

/**
 * Validate required Slack event fields are present
 */
function validateSlackEvent(payload: SlackEventPayload): void {
  const errors: string[] = []

  // Check payload type
  if (payload.type !== 'event_callback') {
    errors.push(`Invalid payload type: ${payload.type} (expected "event_callback")`)
  }

  // Check for event object
  if (!payload.event) {
    errors.push('Missing required field: event')
  } else {
    // Check event type
    if (payload.event.type !== 'message') {
      errors.push(`Unsupported event type: ${payload.event.type} (only "message" is supported)`)
    }

    // Ignore bot messages and message subtypes (edits, deletes, etc.)
    if (payload.event.subtype) {
      errors.push(`Message subtype not supported: ${payload.event.subtype}`)
    }

    // Check essential message fields
    if (!payload.event.text || payload.event.text.trim() === '') {
      errors.push('Missing or empty message text')
    }

    if (!payload.event.channel) {
      errors.push('Missing required field: event.channel')
    }

    if (!payload.event.user) {
      errors.push('Missing required field: event.user')
    }

    if (!payload.event.ts) {
      errors.push('Missing required field: event.ts')
    }
  }

  if (errors.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Slack event payload',
      data: { errors },
    })
  }
}

export default defineEventHandler(async (event) => {
  const startTime = Date.now()

  try {
    // 1. Read incoming payload
    const payload = await readBody<SlackEventPayload | SlackUrlVerificationPayload>(event)

    // 2. Handle URL verification challenge (one-time setup)
    if (payload.type === 'url_verification') {
      const challenge = (payload as SlackUrlVerificationPayload).challenge
      console.log('[Slack Webhook] URL verification challenge received')

      return {
        challenge,
      }
    }

    // 3. Validate event payload
    const eventPayload = payload as SlackEventPayload

    console.log('[Slack Webhook] Received event webhook', {
      teamId: eventPayload.team_id,
      eventType: eventPayload.event?.type,
      channel: eventPayload.event?.channel,
      user: eventPayload.event?.user,
    })

    // Validate required fields
    validateSlackEvent(eventPayload)

    // 4. Get Slack adapter and parse incoming event
    const adapter = getAdapter('slack')

    let parsed: ParsedDiscussion
    try {
      parsed = await adapter.parseIncoming(eventPayload)
      console.log('[Slack Webhook] Successfully parsed event', {
        teamId: parsed.teamId,
        sourceThreadId: parsed.sourceThreadId,
        authorHandle: parsed.authorHandle,
      })
    } catch (error) {
      console.error('[Slack Webhook] Failed to parse event:', error)
      throw createError({
        statusCode: 422,
        statusMessage: 'Failed to parse Slack event',
        data: {
          error: (error as Error).message,
        },
      })
    }

    // 5. Process the discussion through the pipeline
    try {
      const result = await processDiscussion(parsed)

      const processingTime = Date.now() - startTime

      console.log('[Slack Webhook] Successfully processed discussion', {
        discussionId: result.discussionId,
        notionTaskCount: result.notionTasks.length,
        isMultiTask: result.isMultiTask,
        processingTime: `${processingTime}ms`,
      })

      // 6. Return success response
      return {
        success: true,
        data: {
          discussionId: result.discussionId,
          notionTasks: result.notionTasks.map(task => ({
            taskId: task.taskId,
            url: task.url,
          })),
          isMultiTask: result.isMultiTask,
          processingTime,
        },
      }
    } catch (error) {
      console.error('[Slack Webhook] Failed to process discussion:', error)

      // Determine if error is retryable (for webhook retry logic)
      const isRetryable = (error as any).retryable === true

      // Return 5xx for retryable errors (Slack will retry)
      // Return 4xx for non-retryable errors (Slack won't retry)
      const statusCode = isRetryable ? 503 : 422

      throw createError({
        statusCode,
        statusMessage: 'Failed to process discussion',
        data: {
          error: (error as Error).message,
          retryable: isRetryable,
        },
      })
    }
  } catch (error) {
    // Handle all other unexpected errors
    console.error('[Slack Webhook] Unexpected error:', error)

    // If this is already a H3Error from createError(), re-throw it
    if ((error as any).statusCode) {
      throw error
    }

    // Otherwise, wrap in a generic error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
      data: {
        error: (error as Error).message,
      },
    })
  }
})

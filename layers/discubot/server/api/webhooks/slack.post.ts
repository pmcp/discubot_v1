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
import { verifySlackSignature } from '../../utils/webhookSecurity'
import { rateLimit, RateLimitPresets } from '../../utils/rateLimit'

/**
 * In-memory cache to deduplicate events
 * Slack sends both 'message' and 'app_mention' for @mentions
 * We process only one per unique sourceThreadId
 */
const processedThreads = new Map<string, number>()
const DEDUP_WINDOW_MS = 10000 // 10 seconds

/**
 * Check if a thread was recently processed
 */
function isDuplicate(sourceThreadId: string): boolean {
  const now = Date.now()
  const lastProcessed = processedThreads.get(sourceThreadId)

  if (lastProcessed && (now - lastProcessed) < DEDUP_WINDOW_MS) {
    return true
  }

  // Mark as processed
  processedThreads.set(sourceThreadId, now)

  // Clean up old entries
  for (const [threadId, timestamp] of processedThreads.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedThreads.delete(threadId)
    }
  }

  return false
}

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
    // ONLY process app_mention events (when bot is explicitly @mentioned)
    // Regular message events would trigger for ALL messages in channels, which we don't want
    if (payload.event.type !== 'app_mention') {
      errors.push(`Unsupported event type: ${payload.event.type} (only "app_mention" is supported - bot must be @mentioned)`)
    }

    // app_mention events don't have subtypes, so no need to check for them

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
  // DEBUG: Log immediately to see if request reaches handler
  console.log('[Slack Webhook] ===== REQUEST RECEIVED =====', {
    method: event.method,
    path: event.path,
    headers: Object.fromEntries(Object.entries(getHeaders(event))),
  })

  const startTime = Date.now()

  try {
    // 0. Apply rate limiting (100 requests per minute)
    console.log('[Slack Webhook] Step 0: Applying rate limiting...')
    await rateLimit(event, RateLimitPresets.WEBHOOK)
    console.log('[Slack Webhook] Step 0: Rate limit check passed')

    // 1. Read incoming payload FIRST to check if it's URL verification
    console.log('[Slack Webhook] Step 1: Reading request body...')
    const payload = await readBody<SlackEventPayload | SlackUrlVerificationPayload>(event)
    console.log('[Slack Webhook] Step 1: Body read successfully', {
      type: payload.type,
      hasEvent: 'event' in payload,
      hasChallenge: 'challenge' in payload,
    })

    // 2. Handle URL verification challenge (one-time setup) - NO signature verification needed
    // Slack's URL verification challenges don't include signatures
    if (payload.type === 'url_verification') {
      const challenge = (payload as SlackUrlVerificationPayload).challenge
      console.log('[Slack Webhook] URL verification challenge received')

      return {
        challenge,
      }
    }

    // 3. For all other requests (event_callback), verify webhook signature
    const config = useRuntimeConfig()
    const signingSecret = config.slackSigningSecret as string | undefined

    // Only verify signature if signing secret is configured
    if (signingSecret) {
      const rawBody = await readRawBody(event)
      const headers = getHeaders(event)

      if (!rawBody) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Missing request body',
        })
      }

      if (!verifySlackSignature(rawBody, headers, signingSecret)) {
        console.warn('[Slack Webhook] Invalid signature detected')
        throw createError({
          statusCode: 401,
          statusMessage: 'Invalid webhook signature',
        })
      }

      console.log('[Slack Webhook] Signature verified successfully')
    }
    else {
      console.warn('[Slack Webhook] Signature verification skipped - SLACK_SIGNING_SECRET not configured')
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

    // 4.5. Check for duplicates (Slack sends both message and app_mention for @mentions)
    if (isDuplicate(parsed.sourceThreadId)) {
      console.log('[Slack Webhook] Duplicate event detected, skipping:', {
        sourceThreadId: parsed.sourceThreadId,
      })

      // Return success to acknowledge receipt (prevent Slack retries)
      return {
        success: true,
        data: {
          skipped: true,
          reason: 'duplicate_event',
        },
      }
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
    console.error('[Slack Webhook] ===== ERROR CAUGHT =====')
    console.error('[Slack Webhook] Error:', error)
    console.error('[Slack Webhook] Error stack:', (error as Error).stack)

    // If this is already a H3Error from createError(), re-throw it
    if ((error as any).statusCode) {
      console.error('[Slack Webhook] Re-throwing H3Error with status:', (error as any).statusCode)
      throw error
    }

    // Otherwise, wrap in a generic error
    console.error('[Slack Webhook] Wrapping in 500 error')
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
      data: {
        error: (error as Error).message,
      },
    })
  }
})

/**
 * Resend Webhook Endpoint - Figma Email Handler
 *
 * Receives POST requests from Resend containing Figma comment email webhooks.
 * Unlike Mailgun, Resend webhooks do NOT include the email body - we must fetch it separately.
 *
 * **Flow:**
 * 1. Receive Resend `email.received` webhook
 * 2. Fetch email content from Resend API
 * 3. Transform to Mailgun-compatible format
 * 4. Process using existing Figma adapter (no changes needed!)
 *
 * **Resend Webhook Payload Structure:**
 * ```json
 * {
 *   "type": "email.received",
 *   "created_at": "2025-01-15T12:00:00.000Z",
 *   "data": {
 *     "id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
 *     "from": "comments-abc123@email.figma.com",
 *     "to": ["team-slug@yourdomain.com"],
 *     "subject": "Jane commented on Design File"
 *   }
 * }
 * ```
 *
 * **Endpoint:** POST /api/webhooks/resend
 * **Auth:** Webhook signature verification (Svix-based signing)
 *
 * @see https://resend.com/docs/dashboard/receiving/forward-emails
 * @see https://resend.com/docs/dashboard/webhooks/introduction
 */

import type { ParsedDiscussion } from '~/layers/discubot/types'
import { getAdapter } from '../../adapters'
import { processDiscussion } from '../../services/processor'
import { fetchResendEmail, transformToMailgunFormat } from '../../utils/resendEmail'
import { rateLimit, RateLimitPresets } from '../../utils/rateLimit'

/**
 * Resend webhook payload structure
 * @see https://resend.com/docs/api-reference/webhooks/webhook-events
 */
interface ResendWebhookPayload {
  type: 'email.sent' | 'email.delivered' | 'email.received' | 'email.bounced' | 'email.complained' | 'email.opened' | 'email.clicked'
  created_at: string
  data: {
    id: string
    from?: string
    to?: string[]
    subject?: string
    created_at?: string
    [key: string]: any
  }
}

/**
 * Validate that this is an email.received event
 */
function validateResendWebhook(payload: ResendWebhookPayload): void {
  const errors: string[] = []

  // Check event type
  if (!payload.type) {
    errors.push('Missing required field: type')
  } else if (payload.type !== 'email.received') {
    errors.push(`Invalid event type: ${payload.type}. Expected: email.received`)
  }

  // Check data object
  if (!payload.data || typeof payload.data !== 'object') {
    errors.push('Missing or invalid data object')
  } else {
    // Check email ID
    if (!payload.data.id) {
      errors.push('Missing required field: data.id')
    }
  }

  if (errors.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Resend webhook payload',
      data: { errors },
    })
  }
}

/**
 * Verify Resend webhook signature (Svix-based)
 *
 * Resend uses Svix for webhook signing. Signature verification headers:
 * - svix-id: Unique message ID
 * - svix-timestamp: Unix timestamp when message was sent
 * - svix-signature: HMAC signature(s) of the payload
 *
 * @see https://docs.svix.com/receiving/verifying-payloads/how
 */
async function verifyResendWebhookSignature(
  event: any,
  payload: ResendWebhookPayload,
  signingSecret: string
): Promise<boolean> {
  const svixId = getHeader(event, 'svix-id')
  const svixTimestamp = getHeader(event, 'svix-timestamp')
  const svixSignature = getHeader(event, 'svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[Resend Webhook] Missing Svix signature headers')
    return false
  }

  try {
    // Construct the signed content (Svix format)
    // Format: "{svix-id}.{svix-timestamp}.{payload}"
    const signedContent = `${svixId}.${svixTimestamp}.${JSON.stringify(payload)}`

    // Svix uses base64-encoded HMAC-SHA256
    const encoder = new TextEncoder()
    const data = encoder.encode(signedContent)
    const keyData = encoder.encode(signingSecret)

    // Import signing key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Generate signature
    const signature = await crypto.subtle.sign('HMAC', key, data)
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))

    // Extract signatures from header (format: "v1,signature1 v1,signature2")
    const signatures = svixSignature.split(' ').map(s => s.split(',')[1])

    // Check if our signature matches any of the provided signatures (constant-time comparison)
    for (const sig of signatures) {
      if (sig === base64Signature) {
        return true
      }
    }

    console.warn('[Resend Webhook] Signature mismatch')
    return false
  } catch (error) {
    console.error('[Resend Webhook] Signature verification error:', error)
    return false
  }
}

export default defineEventHandler(async (event) => {
  const startTime = Date.now()

  try {
    // 0. Apply rate limiting (100 requests per minute)
    await rateLimit(event, RateLimitPresets.WEBHOOK)

    // 1. Read and validate incoming webhook payload
    const payload = await readBody<ResendWebhookPayload>(event)

    console.log('[Resend Webhook] Received webhook', {
      type: payload.type,
      emailId: payload.data?.id,
      from: payload.data?.from,
      to: payload.data?.to,
    })

    // Validate webhook event type
    validateResendWebhook(payload)

    // 2. Verify webhook signature (if configured)
    const config = useRuntimeConfig()
    const signingSecret = config.resendWebhookSigningSecret as string | undefined

    if (signingSecret) {
      const isValid = await verifyResendWebhookSignature(event, payload, signingSecret)

      if (!isValid) {
        console.warn('[Resend Webhook] Invalid signature detected')
        throw createError({
          statusCode: 401,
          statusMessage: 'Invalid webhook signature',
        })
      }

      console.log('[Resend Webhook] Signature verified successfully')
    } else {
      console.warn('[Resend Webhook] Signature verification skipped - RESEND_WEBHOOK_SIGNING_SECRET not configured')
    }

    // 3. Fetch email content from Resend API
    // (Resend webhooks don't include body content for serverless optimization)
    const resendApiToken = config.resendApiToken as string

    if (!resendApiToken) {
      throw createError({
        statusCode: 500,
        statusMessage: 'RESEND_API_TOKEN not configured',
      })
    }

    let resendEmail
    try {
      resendEmail = await fetchResendEmail(payload.data.id, resendApiToken)
      console.log('[Resend Webhook] Fetched email content', {
        emailId: resendEmail.id,
        hasHtml: !!resendEmail.html,
        hasText: !!resendEmail.text,
      })
    } catch (error) {
      console.error('[Resend Webhook] Failed to fetch email content:', error)
      throw createError({
        statusCode: 422,
        statusMessage: 'Failed to fetch email from Resend API',
        data: {
          error: (error as Error).message,
        },
      })
    }

    // 4. Transform to Mailgun-compatible format
    // This allows us to reuse the existing Figma adapter without any changes!
    const mailgunFormat = transformToMailgunFormat(resendEmail)

    console.log('[Resend Webhook] Transformed to Mailgun format', {
      recipient: mailgunFormat.recipient,
      from: mailgunFormat.from,
      subject: mailgunFormat.subject,
    })

    // 5. Get Figma adapter and parse incoming email
    // Note: Currently hardcoded to 'figma' - could be made dynamic based on
    // recipient domain or other routing logic in the future
    const adapter = getAdapter('figma')

    let parsed: ParsedDiscussion
    try {
      parsed = await adapter.parseIncoming(mailgunFormat)
      console.log('[Resend Webhook] Successfully parsed email', {
        teamId: parsed.teamId,
        sourceThreadId: parsed.sourceThreadId,
        authorHandle: parsed.authorHandle,
      })
    } catch (error) {
      console.error('[Resend Webhook] Failed to parse email:', error)
      throw createError({
        statusCode: 422,
        statusMessage: 'Failed to parse email',
        data: {
          error: (error as Error).message,
        },
      })
    }

    // 6. Process the discussion through the pipeline
    try {
      const result = await processDiscussion(parsed)

      const processingTime = Date.now() - startTime

      console.log('[Resend Webhook] Successfully processed discussion', {
        discussionId: result.discussionId,
        notionTaskCount: result.notionTasks.length,
        isMultiTask: result.isMultiTask,
        processingTime: `${processingTime}ms`,
      })

      // 7. Return success response
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
      console.error('[Resend Webhook] Failed to process discussion:', error)

      // Determine if error is retryable (for webhook retry logic)
      const isRetryable = (error as any).retryable === true

      // Return 5xx for retryable errors (Resend will retry)
      // Return 4xx for non-retryable errors (Resend won't retry)
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
    console.error('[Resend Webhook] Unexpected error:', error)

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

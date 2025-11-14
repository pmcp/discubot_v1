/**
 * Slack Webhook Endpoint - SIMPLIFIED FOR DEBUGGING
 *
 * This is a minimal version to get the endpoint working.
 * Once this works, we'll add back the full functionality.
 */

export default defineEventHandler(async (event) => {
  console.log('[Slack Webhook] ===== REQUEST RECEIVED =====')
  console.log('[Slack Webhook] Method:', event.method)
  console.log('[Slack Webhook] Path:', event.path)

  try {
    // Read body
    const body = await readBody(event)
    console.log('[Slack Webhook] Payload type:', body?.type)

    // Handle URL verification
    if (body && body.type === 'url_verification') {
      console.log('[Slack Webhook] URL verification, returning challenge')
      return { challenge: body.challenge }
    }

    // Handle actual events
    console.log('[Slack Webhook] Event received:', JSON.stringify(body, null, 2))

    // For now, just acknowledge receipt
    return {
      success: true,
      message: 'Event received (processing not yet implemented)',
      event_type: body?.event?.type,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    console.error('[Slack Webhook] ERROR:', error)
    console.error('[Slack Webhook] Stack:', (error as Error).stack)

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal error',
      data: { error: (error as Error).message }
    })
  }
})
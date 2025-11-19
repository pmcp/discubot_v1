/**
 * Slack OAuth Callback Endpoint
 *
 * Handles the OAuth 2.0 callback from Slack after user authorization.
 * Exchanges the temporary authorization code for an access token.
 *
 * Flow:
 * 1. Verify state parameter (CSRF protection)
 * 2. Extract authorization code from query params
 * 3. Exchange code for access token via oauth.v2.access
 * 4. Store access token in sourceConfigs (team-scoped)
 * 5. Clean up state token
 * 6. Redirect to success page
 *
 * Required Environment Variables:
 * - SLACK_CLIENT_ID: Your Slack app's client ID
 * - SLACK_CLIENT_SECRET: Your Slack app's client secret
 * - BASE_URL: Your application's base URL
 *
 * @see https://api.slack.com/methods/oauth.v2.access
 */

/**
 * Slack oauth.v2.access response structure
 */
interface SlackOAuthResponse {
  ok: boolean
  access_token?: string
  token_type?: string
  scope?: string
  bot_user_id?: string
  app_id?: string
  team?: {
    id: string
    name: string
  }
  enterprise?: {
    id: string
    name: string
  }
  authed_user?: {
    id: string
  }
  error?: string
}

export default defineEventHandler(async (event) => {
  try {
    // Get query parameters
    const query = getQuery(event)
    const code = query.code as string
    const state = query.state as string
    const error = query.error as string

    // Handle authorization denial
    if (error) {
      logger.error('[OAuth] User denied authorization:', error)
      throw createError({
        statusCode: 403,
        statusMessage: `Slack authorization denied: ${error}`,
      })
    }

    // Validate required parameters
    if (!code) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing authorization code',
      })
    }

    if (!state) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing state parameter',
      })
    }

    // Verify state token (CSRF protection) using NuxtHub KV
    const stateData = await hubKV().get<{ teamId: string; createdAt: number }>(`oauth:state:${state}`)

    if (!stateData) {
      logger.error('[OAuth] Invalid or expired state token')
      throw createError({
        statusCode: 403,
        statusMessage: 'Invalid or expired authorization request',
      })
    }

    // Extract team ID from state
    const { teamId } = stateData

    // Delete state token (single use) from KV
    await hubKV().del(`oauth:state:${state}`)

    // Get environment variables
    const config = useRuntimeConfig(event)
    const clientId = config.slackClientId || process.env.SLACK_CLIENT_ID
    const clientSecret = config.slackClientSecret || process.env.SLACK_CLIENT_SECRET
    const baseUrl = config.public.baseUrl || process.env.BASE_URL || 'http://localhost:3000'

    // Validate required configuration
    if (!clientId || !clientSecret) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Slack OAuth not configured: Missing client credentials',
      })
    }

    // Build redirect URI (must match install.get.ts)
    const redirectUri = `${baseUrl}/api/oauth/slack/callback`

    logger.debug('[OAuth] Exchanging code for access token', {
      teamId,
      codePrefix: code.substring(0, 10) + '...',
    })

    // Exchange authorization code for access token
    // Use POST with form-encoded body as per Slack API requirements
    const tokenUrl = 'https://slack.com/api/oauth.v2.access'
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      logger.error('[OAuth] Token exchange failed:', tokenResponse.status, tokenResponse.statusText)
      throw createError({
        statusCode: 502,
        statusMessage: 'Failed to exchange authorization code',
      })
    }

    const tokenData = await tokenResponse.json() as SlackOAuthResponse

    if (!tokenData.ok || !tokenData.access_token) {
      logger.error('[OAuth] Token exchange error:', tokenData.error)
      throw createError({
        statusCode: 502,
        statusMessage: `Slack OAuth error: ${tokenData.error || 'Unknown error'}`,
      })
    }

    logger.debug('[OAuth] Successfully obtained access token', {
      teamId,
      slackTeamId: tokenData.team?.id,
      slackTeamName: tokenData.team?.name,
      botUserId: tokenData.bot_user_id,
      scopes: tokenData.scope,
    })

    // Pass OAuth credentials via redirect URL (no database creation)
    // User will complete the form and save everything together
    const successUrl = new URL('/oauth/success', baseUrl)
    successUrl.searchParams.set('provider', 'slack')
    successUrl.searchParams.set('access_token', tokenData.access_token)
    successUrl.searchParams.set('team_id', tokenData.team?.id || '')
    successUrl.searchParams.set('team_name', tokenData.team?.name || '')
    successUrl.searchParams.set('bot_user_id', tokenData.bot_user_id || '')
    successUrl.searchParams.set('scopes', tokenData.scope || '')

    return sendRedirect(event, successUrl.toString(), 302)
  }
  catch (error) {
    logger.error('[OAuth] Callback handler failed:', error)

    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    // Otherwise, return generic error
    throw createError({
      statusCode: 500,
      statusMessage: 'OAuth callback failed',
    })
  }
})

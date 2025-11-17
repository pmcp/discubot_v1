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
      console.error('[OAuth] User denied authorization:', error)
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
      console.error('[OAuth] Invalid or expired state token')
      throw createError({
        statusCode: 403,
        statusMessage: 'Invalid or expired authorization request',
      })
    }

    // Extract team ID from state
    const { teamId } = stateData

    // Delete state token (single use) from KV
    await hubKV().delete(`oauth:state:${state}`)

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

    console.log('[OAuth] Exchanging code for access token', {
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
      console.error('[OAuth] Token exchange failed:', tokenResponse.status, tokenResponse.statusText)
      throw createError({
        statusCode: 502,
        statusMessage: 'Failed to exchange authorization code',
      })
    }

    const tokenData = await tokenResponse.json() as SlackOAuthResponse

    if (!tokenData.ok || !tokenData.access_token) {
      console.error('[OAuth] Token exchange error:', tokenData.error)
      throw createError({
        statusCode: 502,
        statusMessage: `Slack OAuth error: ${tokenData.error || 'Unknown error'}`,
      })
    }

    console.log('[OAuth] Successfully obtained access token', {
      teamId,
      slackTeamId: tokenData.team?.id,
      slackTeamName: tokenData.team?.name,
      botUserId: tokenData.bot_user_id,
      scopes: tokenData.scope,
    })

    // Store access token in database
    // Create config with incomplete setup - user must complete in admin UI
    try {
      const { createDiscubotConfig } = await import(
        '#layers/discubot/collections/configs/server/database/queries'
      )
      const { SYSTEM_USER_ID } = await import('../../../utils/constants')

      // Check if config already exists for this Slack workspace
      const db = useDB()
      const { discubotConfigs } = await import('#layers/discubot-configs/server/database/schema')
      const { eq, and } = await import('drizzle-orm')

      const existingConfigs = await db
        .select()
        .from(discubotConfigs)
        .where(and(
          eq(discubotConfigs.teamId, teamId),
          eq(discubotConfigs.sourceType, 'slack'),
        ))
        .all()

      // Check if this Slack workspace is already connected
      const existingConfig = existingConfigs.find(config => {
        return config.sourceMetadata && (config.sourceMetadata as any).slackTeamId === tokenData.team?.id
      })

      if (existingConfig) {
        console.log('[OAuth] Config already exists for this Slack workspace, updating token:', existingConfig.id)
        const { updateDiscubotConfig } = await import(
          '#layers/discubot/collections/configs/server/database/queries'
        )

        // Update existing config with new token
        await updateDiscubotConfig(
          existingConfig.id,
          teamId,
          existingConfig.owner,
          {
            apiToken: tokenData.access_token,
            sourceMetadata: {
              slackTeamId: tokenData.team?.id,
              slackTeamName: tokenData.team?.name,
              botUserId: tokenData.bot_user_id,
              scopes: tokenData.scope,
            },
          },
        )
      }
      else {
        console.log('[OAuth] Creating new config for Slack workspace:', tokenData.team?.name)

        // Create new config with placeholder Notion values
        // User must complete setup in admin UI before config becomes active
        await createDiscubotConfig({
          teamId,
          owner: SYSTEM_USER_ID,
          sourceType: 'slack',
          name: tokenData.team?.name || 'Slack Workspace',
          apiToken: tokenData.access_token,
          sourceMetadata: {
            slackTeamId: tokenData.team?.id,
            slackTeamName: tokenData.team?.name,
            botUserId: tokenData.bot_user_id,
            scopes: tokenData.scope,
          },
          notionToken: '', // User will configure in admin UI
          notionDatabaseId: '', // User will configure in admin UI
          aiEnabled: false,
          autoSync: false,
          postConfirmation: true,
          enableEmailForwarding: false,
          active: false, // Requires completion of Notion setup
          onboardingComplete: false, // User must complete setup
        })

        console.log('[OAuth] Config created successfully')
      }
    }
    catch (error) {
      console.error('[OAuth] Failed to save config:', error)
      // Don't fail the OAuth flow if config creation fails
      // User can try reconnecting or manually create config
    }

    // For now, redirect to a success page with instructions
    // In Phase 5 (Admin UI), this will redirect to the config form
    const successUrl = `/oauth/success?provider=slack&team=${encodeURIComponent(tokenData.team?.name || 'Unknown')}`

    return sendRedirect(event, successUrl, 302)
  }
  catch (error) {
    console.error('[OAuth] Callback handler failed:', error)

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

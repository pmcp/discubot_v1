/**
 * Slack OAuth Install Endpoint
 *
 * Initiates the Slack OAuth 2.0 authorization flow.
 * Redirects users to Slack's authorization page where they can install the app.
 *
 * Flow:
 * 1. Generate secure random state token (CSRF protection)
 * 2. Store state token with expiration (5 minutes)
 * 3. Build Slack authorization URL with required scopes
 * 4. Redirect user to Slack for authorization
 *
 * Required Environment Variables:
 * - SLACK_CLIENT_ID: Your Slack app's client ID
 * - SLACK_CLIENT_SECRET: Your Slack app's client secret
 * - BASE_URL: Your application's base URL (for redirect_uri)
 *
 * @see https://api.slack.com/authentication/oauth-v2
 */

import { randomBytes } from 'node:crypto'

/**
 * In-memory state storage for OAuth CSRF protection
 * In production, this should be replaced with database or KV storage
 *
 * Structure: Map<stateToken, { teamId: string, createdAt: number }>
 */
const oauthStates = new Map<string, { teamId: string; createdAt: number }>()

/**
 * Clean up expired state tokens (older than 5 minutes)
 */
function cleanupExpiredStates() {
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > fiveMinutes) {
      oauthStates.delete(state)
    }
  }
}

/**
 * Required Slack OAuth scopes for the bot
 *
 * Scopes needed:
 * - channels:history: Read messages in public channels
 * - channels:read: View basic channel info
 * - chat:write: Post messages as the bot
 * - reactions:write: Add emoji reactions to messages
 * - app_mentions:read: Receive @mentions of the bot
 * - im:history: Read direct messages
 * - im:read: View direct message info
 * - im:write: Send direct messages
 * - mpim:history: Read group direct messages
 * - mpim:read: View group direct message info
 * - mpim:write: Send group direct messages
 */
const SLACK_SCOPES = [
  'channels:history',
  'channels:read',
  'chat:write',
  'reactions:write',
  'app_mentions:read',
  'im:history',
  'im:read',
  'im:write',
  'mpim:history',
  'mpim:read',
  'mpim:write',
].join(',')

export default defineEventHandler(async (event) => {
  try {
    // Clean up expired states periodically
    cleanupExpiredStates()

    // Get environment variables
    const config = useRuntimeConfig(event)
    const clientId = config.slackClientId || process.env.SLACK_CLIENT_ID
    const baseUrl = config.public.baseUrl || process.env.BASE_URL || 'http://localhost:3000'

    // Validate required configuration
    if (!clientId) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Slack OAuth not configured: Missing SLACK_CLIENT_ID',
      })
    }

    // Get team ID from query params or session (for multi-tenant setup)
    // For MVP, we can use a default team or require it in query params
    const query = getQuery(event)
    const teamId = (query.team_id as string) || 'default'

    // Generate secure random state token (32 bytes = 256 bits)
    const state = randomBytes(32).toString('hex')

    // Store state token with team ID and timestamp
    oauthStates.set(state, {
      teamId,
      createdAt: Date.now(),
    })

    // Build redirect URI (must match what's configured in Slack app settings)
    const redirectUri = `${baseUrl}/api/oauth/slack/callback`

    // Build Slack authorization URL
    const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize')
    slackAuthUrl.searchParams.set('client_id', clientId)
    slackAuthUrl.searchParams.set('scope', SLACK_SCOPES)
    slackAuthUrl.searchParams.set('state', state)
    slackAuthUrl.searchParams.set('redirect_uri', redirectUri)

    // Optional: Add user scopes if needed (for actions on behalf of users)
    // slackAuthUrl.searchParams.set('user_scope', 'users:read')

    console.log('[OAuth] Initiating Slack OAuth flow', {
      teamId,
      state: state.substring(0, 8) + '...',
      redirectUri,
    })

    // Redirect to Slack authorization page
    return sendRedirect(event, slackAuthUrl.toString(), 302)
  }
  catch (error) {
    console.error('[OAuth] Failed to initiate Slack OAuth flow:', error)

    // Return user-friendly error
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to initiate Slack authorization',
    })
  }
})

/**
 * Export state management functions for testing
 */
export const __testing__ = {
  oauthStates,
  cleanupExpiredStates,
}

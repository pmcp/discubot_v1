/**
 * Fetch Notion users from workspace
 *
 * GET /api/notion/users?notionToken=secret_xxx&teamId=xxx
 *
 * Returns list of users from a Notion workspace for use in user mapping dropdowns.
 * Requires a Notion integration token with access to the workspace.
 */

import { Client } from '@notionhq/client'

export default defineEventHandler(async (event) => {
  try {
    // Get parameters from query
    const query = getQuery(event)
    const notionToken = query.notionToken as string
    const teamId = query.teamId as string

    // Validate required parameters
    if (!notionToken) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Missing required parameter: notionToken'
      })
    }

    if (!teamId) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Missing required parameter: teamId'
      })
    }

    // Validate token format (Notion tokens start with 'secret_')
    if (!notionToken.startsWith('secret_')) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Invalid Notion token format. Token must start with "secret_"'
      })
    }

    // Initialize Notion client
    const notion = new Client({ auth: notionToken })

    // Fetch all users from workspace
    const response = await notion.users.list({})

    // Transform to simpler format for frontend
    const users = response.results.map((user: any) => ({
      id: user.id,
      name: user.name || 'Unknown',
      email: user.person?.email || user.bot?.owner?.user?.person?.email || null,
      type: user.type, // 'person' or 'bot'
      avatarUrl: user.avatar_url || null
    }))

    // Filter out bots if requested
    const includeBots = query.includeBots === 'true'
    const filteredUsers = includeBots
      ? users
      : users.filter((u: any) => u.type === 'person')

    console.log(`[Notion Users] Fetched ${filteredUsers.length} users for team ${teamId}`)

    return {
      success: true,
      users: filteredUsers,
      total: filteredUsers.length
    }
  } catch (error: any) {
    console.error('[Notion Users] Error:', error)

    // Handle Notion API errors
    if (error.code === 'unauthorized') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid Notion token or insufficient permissions'
      })
    }

    if (error.code === 'rate_limited') {
      throw createError({
        statusCode: 429,
        statusMessage: 'Notion API rate limit exceeded. Please try again later.'
      })
    }

    // Pass through already formatted errors
    if (error.statusCode) {
      throw error
    }

    // Generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch Notion users'
    })
  }
})

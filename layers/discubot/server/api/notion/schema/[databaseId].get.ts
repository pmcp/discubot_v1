/**
 * Fetch Notion database schema
 *
 * GET /api/notion/schema/:databaseId?notionToken=secret_xxx
 *
 * Returns the schema (properties) of a Notion database for field mapping configuration.
 * Parses property types and options (for select/multi-select fields).
 */

import { Client } from '@notionhq/client'

export default defineEventHandler(async (event) => {
  try {
    // Get database ID from route params
    const databaseId = getRouterParam(event, 'databaseId')

    // Get Notion token from query
    const query = getQuery(event)
    const notionToken = query.notionToken as string

    // Validate required parameters
    if (!databaseId) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Missing required parameter: databaseId'
      })
    }

    if (!notionToken) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Missing required parameter: notionToken'
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

    // Fetch database schema
    console.log(`[Notion Schema] Fetching schema for database ${databaseId}`)
    const database = await notion.databases.retrieve({
      database_id: databaseId
    })

    // Parse properties into a simpler format
    const properties: Record<string, any> = {}

    for (const [name, prop] of Object.entries(database.properties as Record<string, any>)) {
      // Extract property type
      const propertyType = prop.type

      // Base property info
      const propertyInfo: any = {
        type: propertyType,
        id: prop.id
      }

      // Extract select/multi-select options
      if (propertyType === 'select' && prop.select?.options) {
        propertyInfo.options = prop.select.options.map((opt: any) => ({
          name: opt.name,
          color: opt.color,
          id: opt.id
        }))
      } else if (propertyType === 'multi_select' && prop.multi_select?.options) {
        propertyInfo.options = prop.multi_select.options.map((opt: any) => ({
          name: opt.name,
          color: opt.color,
          id: opt.id
        }))
      } else if (propertyType === 'status' && prop.status?.options) {
        // Status fields also have options
        propertyInfo.options = prop.status.options.map((opt: any) => ({
          name: opt.name,
          color: opt.color,
          id: opt.id
        }))
      }

      properties[name] = propertyInfo
    }

    console.log(`[Notion Schema] Parsed ${Object.keys(properties).length} properties`)

    return {
      success: true,
      databaseId,
      databaseTitle: (database as any).title?.[0]?.plain_text || 'Unknown Database',
      properties
    }
  } catch (error: any) {
    console.error('[Notion Schema] Error:', error)

    // Handle Notion API errors
    if (error.code === 'unauthorized') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid Notion token or insufficient permissions'
      })
    }

    if (error.code === 'object_not_found') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Notion database not found. Check database ID and integration access.'
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
      statusMessage: error.message || 'Failed to fetch Notion database schema'
    })
  }
})

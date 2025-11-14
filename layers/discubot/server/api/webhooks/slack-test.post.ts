/**
 * MINIMAL TEST ENDPOINT
 * No imports, just basic logging to test if route works
 */

export default defineEventHandler(async (event) => {
  console.log('========== SLACK TEST ENDPOINT HIT ==========')
  console.log('Method:', event.method)
  console.log('Path:', event.path)
  console.log('Headers:', getHeaders(event))

  const body = await readBody(event)
  console.log('Body:', JSON.stringify(body))

  // If it's URL verification, respond
  if (body && body.type === 'url_verification') {
    console.log('URL verification challenge received:', body.challenge)
    return { challenge: body.challenge }
  }

  return {
    success: true,
    message: 'Test endpoint reached!',
    timestamp: new Date().toISOString()
  }
})
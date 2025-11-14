/**
 * Security Check Plugin
 *
 * Runs security checks on application startup to ensure:
 * - Webhook signature verification is configured
 * - Secrets are properly set
 * - Production environment has all security features enabled
 *
 * This plugin logs warnings for missing security configurations
 * but doesn't block application startup (to allow development).
 */

import { logSecurityChecks } from '../../layers/discubot/server/utils/securityCheck'

export default defineNitroPlugin(async () => {
  console.log('[Security Check] Running startup security checks...')

  try {
    logSecurityChecks()
  }
  catch (error) {
    console.error('[Security Check] Error running security checks:', error)
  }
})

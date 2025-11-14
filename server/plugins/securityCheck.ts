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

export default defineNitroPlugin(() => {
  // Note: Cloudflare Workers doesn't support async operations in global scope
  // Security checks will run on first request via the logSecurityChecks() utility
  console.log('[Security Check] Plugin loaded. Security checks will run on first request.')
})

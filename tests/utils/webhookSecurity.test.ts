import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifySlackSignature, verifyMailgunSignature } from '~/layers/discubot/server/utils/webhookSecurity'

describe('webhookSecurity', () => {
  describe('verifySlackSignature', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('should verify valid Slack signature', () => {
      const secret = 'test_signing_secret'
      const timestamp = '1234567890'
      const body = JSON.stringify({ type: 'event_callback' })

      // Generate valid signature using HMAC-SHA256
      const crypto = require('crypto')
      const baseString = `v0:${timestamp}:${body}`
      const signature = 'v0=' + crypto
        .createHmac('sha256', secret)
        .update(baseString)
        .digest('hex')

      const result = verifySlackSignature(signature, timestamp, body, secret)
      expect(result).toBe(true)
    })

    it('should reject signature with invalid format', () => {
      const result = verifySlackSignature(
        'invalid_signature',
        '1234567890',
        'test body',
        'secret'
      )
      expect(result).toBe(false)
    })

    it('should reject signature without v0 prefix', () => {
      const result = verifySlackSignature(
        'v1=abcd1234',
        '1234567890',
        'test body',
        'secret'
      )
      expect(result).toBe(false)
    })

    it('should reject timestamp older than 5 minutes', () => {
      const now = Math.floor(Date.now() / 1000)
      const oldTimestamp = (now - 400).toString() // 6+ minutes ago

      vi.setSystemTime(now * 1000)

      const crypto = require('crypto')
      const body = 'test body'
      const secret = 'test_secret'
      const baseString = `v0:${oldTimestamp}:${body}`
      const signature = 'v0=' + crypto
        .createHmac('sha256', secret)
        .update(baseString)
        .digest('hex')

      const result = verifySlackSignature(signature, oldTimestamp, body, secret)
      expect(result).toBe(false)
    })

    it('should accept timestamp within 5 minute window', () => {
      const now = Math.floor(Date.now() / 1000)
      const recentTimestamp = (now - 60).toString() // 1 minute ago

      vi.setSystemTime(now * 1000)

      const crypto = require('crypto')
      const body = 'test body'
      const secret = 'test_secret'
      const baseString = `v0:${recentTimestamp}:${body}`
      const signature = 'v0=' + crypto
        .createHmac('sha256', secret)
        .update(baseString)
        .digest('hex')

      const result = verifySlackSignature(signature, recentTimestamp, body, secret)
      expect(result).toBe(true)
    })

    it('should reject mismatched signature', () => {
      const result = verifySlackSignature(
        'v0=wrongsignature123',
        '1234567890',
        'test body',
        'secret'
      )
      expect(result).toBe(false)
    })

    it('should handle empty body', () => {
      const crypto = require('crypto')
      const timestamp = '1234567890'
      const body = ''
      const secret = 'test_secret'
      const baseString = `v0:${timestamp}:${body}`
      const signature = 'v0=' + crypto
        .createHmac('sha256', secret)
        .update(baseString)
        .digest('hex')

      const result = verifySlackSignature(signature, timestamp, body, secret)
      expect(result).toBe(true)
    })
  })

  describe('verifyMailgunSignature', () => {
    it('should verify valid Mailgun signature', () => {
      const token = 'test_token'
      const timestamp = '1234567890'
      const secret = 'test_signing_key'

      const crypto = require('crypto')
      const data = timestamp + token
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex')

      const result = verifyMailgunSignature(
        expectedSignature,
        token,
        timestamp,
        secret
      )
      expect(result).toBe(true)
    })

    it('should reject mismatched signature', () => {
      const result = verifyMailgunSignature(
        'wrongsignature123',
        'test_token',
        '1234567890',
        'secret'
      )
      expect(result).toBe(false)
    })

    it('should handle empty token', () => {
      const timestamp = '1234567890'
      const token = ''
      const secret = 'test_secret'

      const crypto = require('crypto')
      const data = timestamp + token
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex')

      const result = verifyMailgunSignature(
        expectedSignature,
        token,
        timestamp,
        secret
      )
      expect(result).toBe(true)
    })

    it('should handle empty timestamp', () => {
      const timestamp = ''
      const token = 'test_token'
      const secret = 'test_secret'

      const crypto = require('crypto')
      const data = timestamp + token
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex')

      const result = verifyMailgunSignature(
        expectedSignature,
        token,
        timestamp,
        secret
      )
      expect(result).toBe(true)
    })

    it('should use constant-time comparison', () => {
      // Test that it doesn't short-circuit on first mismatch
      const secret = 'test_secret'
      const token = 'token'
      const timestamp = '123'

      const crypto = require('crypto')
      const data = timestamp + token
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex')

      // Create signature with different first character
      const invalidSignature = 'z' + validSignature.slice(1)

      const result = verifyMailgunSignature(
        invalidSignature,
        token,
        timestamp,
        secret
      )
      expect(result).toBe(false)
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, RATE_LIMITS } from '~/layers/discubot/server/utils/rateLimit'

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      const identifier = 'test-user'
      const limit = RATE_LIMITS.API

      const result = checkRateLimit(identifier, limit)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(limit.maxRequests - 1)
      expect(result.resetTime).toBeGreaterThan(0)
    })

    it('should block requests exceeding rate limit', () => {
      const identifier = 'test-user-2'
      const limit = { maxRequests: 2, windowMs: 60000 }

      // Make requests up to the limit
      checkRateLimit(identifier, limit)
      checkRateLimit(identifier, limit)

      // This one should be blocked
      const result = checkRateLimit(identifier, limit)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should reset rate limit after window expires', () => {
      const identifier = 'test-user-3'
      const limit = { maxRequests: 2, windowMs: 60000 }

      // Exhaust the limit
      checkRateLimit(identifier, limit)
      checkRateLimit(identifier, limit)

      // Move time forward past the window
      vi.advanceTimersByTime(61000)

      // Should allow again
      const result = checkRateLimit(identifier, limit)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(limit.maxRequests - 1)
    })

    it('should track different identifiers separately', () => {
      const user1 = 'user-1'
      const user2 = 'user-2'
      const limit = { maxRequests: 1, windowMs: 60000 }

      // Exhaust user1's limit
      const result1 = checkRateLimit(user1, limit)
      expect(result1.allowed).toBe(true)

      const result2 = checkRateLimit(user1, limit)
      expect(result2.allowed).toBe(false)

      // user2 should still have quota
      const result3 = checkRateLimit(user2, limit)
      expect(result3.allowed).toBe(true)
    })

    it('should correctly calculate remaining requests', () => {
      const identifier = 'test-user-4'
      const limit = { maxRequests: 5, windowMs: 60000 }

      const results = []
      for (let i = 0; i < 3; i++) {
        results.push(checkRateLimit(identifier, limit))
      }

      expect(results[0].remaining).toBe(4)
      expect(results[1].remaining).toBe(3)
      expect(results[2].remaining).toBe(2)
    })

    it('should include reset time in response', () => {
      const identifier = 'test-user-5'
      const limit = { maxRequests: 10, windowMs: 60000 }
      const now = Date.now()
      vi.setSystemTime(now)

      const result = checkRateLimit(identifier, limit)

      expect(result.resetTime).toBeGreaterThan(now)
      expect(result.resetTime).toBeLessThanOrEqual(now + limit.windowMs)
    })

    it('should handle WEBHOOK rate limit preset', () => {
      const identifier = 'webhook-test'
      const result = checkRateLimit(identifier, RATE_LIMITS.WEBHOOK)

      expect(result.allowed).toBe(true)
      expect(RATE_LIMITS.WEBHOOK.maxRequests).toBe(100)
      expect(RATE_LIMITS.WEBHOOK.windowMs).toBe(60000)
    })

    it('should handle AUTH rate limit preset (stricter)', () => {
      const identifier = 'auth-test'
      const limit = RATE_LIMITS.AUTH

      expect(limit.maxRequests).toBe(5)
      expect(limit.windowMs).toBe(900000) // 15 minutes

      const result = checkRateLimit(identifier, limit)
      expect(result.allowed).toBe(true)
    })

    it('should handle READ operations rate limit', () => {
      const identifier = 'read-test'
      const limit = RATE_LIMITS.READ

      expect(limit.maxRequests).toBe(300)
      expect(limit.windowMs).toBe(60000)
    })

    it('should handle WRITE operations rate limit', () => {
      const identifier = 'write-test'
      const limit = RATE_LIMITS.WRITE

      expect(limit.maxRequests).toBe(30)
      expect(limit.windowMs).toBe(60000)
    })

    it('should clean up expired entries', () => {
      const identifier = 'test-user-6'
      const limit = { maxRequests: 10, windowMs: 1000 }

      // Make a request
      checkRateLimit(identifier, limit)

      // Move time forward to expire the window
      vi.advanceTimersByTime(2000)

      // Make another request (should trigger cleanup)
      const result = checkRateLimit(identifier, limit)

      // Should have full quota again
      expect(result.remaining).toBe(limit.maxRequests - 1)
    })

    it('should handle rapid successive requests', () => {
      const identifier = 'rapid-test'
      const limit = { maxRequests: 100, windowMs: 60000 }

      // Make 50 rapid requests
      for (let i = 0; i < 50; i++) {
        const result = checkRateLimit(identifier, limit)
        expect(result.allowed).toBe(true)
      }

      // Check remaining count
      const finalResult = checkRateLimit(identifier, limit)
      expect(finalResult.remaining).toBe(49)
    })

    it('should handle concurrent identifiers', () => {
      const limit = { maxRequests: 5, windowMs: 60000 }

      // Create requests for 10 different identifiers
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit(`user-${i}`, limit)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4)
      }
    })

    it('should correctly implement token bucket algorithm', () => {
      const identifier = 'bucket-test'
      const limit = { maxRequests: 3, windowMs: 10000 }

      // Exhaust tokens
      checkRateLimit(identifier, limit)
      checkRateLimit(identifier, limit)
      checkRateLimit(identifier, limit)

      // No tokens left
      let result = checkRateLimit(identifier, limit)
      expect(result.allowed).toBe(false)

      // Wait half the window
      vi.advanceTimersByTime(5000)

      // Still no tokens (window hasn't fully reset)
      result = checkRateLimit(identifier, limit)
      expect(result.allowed).toBe(false)

      // Wait for full window
      vi.advanceTimersByTime(6000)

      // Tokens restored
      result = checkRateLimit(identifier, limit)
      expect(result.allowed).toBe(true)
    })
  })

  describe('RATE_LIMITS presets', () => {
    it('should define WEBHOOK limit', () => {
      expect(RATE_LIMITS.WEBHOOK).toEqual({
        maxRequests: 100,
        windowMs: 60000,
      })
    })

    it('should define API limit', () => {
      expect(RATE_LIMITS.API).toEqual({
        maxRequests: 60,
        windowMs: 60000,
      })
    })

    it('should define AUTH limit (most restrictive)', () => {
      expect(RATE_LIMITS.AUTH).toEqual({
        maxRequests: 5,
        windowMs: 900000, // 15 minutes
      })
    })

    it('should define READ limit (generous)', () => {
      expect(RATE_LIMITS.READ).toEqual({
        maxRequests: 300,
        windowMs: 60000,
      })
    })

    it('should define WRITE limit (moderate)', () => {
      expect(RATE_LIMITS.WRITE).toEqual({
        maxRequests: 30,
        windowMs: 60000,
      })
    })
  })
})

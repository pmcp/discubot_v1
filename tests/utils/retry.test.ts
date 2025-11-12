/**
 * Tests for retry utility
 *
 * Validates exponential backoff, retry attempts, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retryWithBackoff, retryWithFixedDelay } from '../../layers/discubot/server/utils/retry'

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const promise = retryWithBackoff(fn)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry up to maxAttempts times', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValueOnce('success')

    const promise = retryWithBackoff(fn, { maxAttempts: 3 })

    // Fast-forward through all timers
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw error after maxAttempts exhausted', async () => {
    const error = new Error('Persistent failure')
    const fn = vi.fn().mockRejectedValue(error)

    const promise = retryWithBackoff(fn, { maxAttempts: 3 })

    // Advance timers and catch the rejection
    const resultPromise = vi.runAllTimersAsync().then(() => promise)
    await expect(resultPromise).rejects.toThrow('Persistent failure')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should use exponential backoff delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1'))
      .mockRejectedValueOnce(new Error('Attempt 2'))
      .mockResolvedValueOnce('success')

    const promise = retryWithBackoff(fn, {
      maxAttempts: 3,
      baseDelay: 1000
    })

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)

    // Wait for 2^1 * 1000 = 2000ms
    await vi.advanceTimersByTimeAsync(2000)
    expect(fn).toHaveBeenCalledTimes(2)

    // Wait for 2^2 * 1000 = 4000ms
    await vi.advanceTimersByTimeAsync(4000)
    expect(fn).toHaveBeenCalledTimes(3)

    const result = await promise
    expect(result).toBe('success')
  })

  it('should call onRetry callback before each retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValueOnce('success')

    const onRetry = vi.fn()

    const promise = retryWithBackoff(fn, {
      maxAttempts: 3,
      onRetry
    })

    await vi.runAllTimersAsync()
    await promise

    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error))
  })

  it('should not call onRetry on final failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'))
    const onRetry = vi.fn()

    const promise = retryWithBackoff(fn, {
      maxAttempts: 3,
      onRetry
    })

    await vi.runAllTimersAsync()
    await expect(promise).rejects.toThrow()

    // onRetry called for attempts 1 and 2, but not 3 (final)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('should use default maxAttempts of 3', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fail'))

    const promise = retryWithBackoff(fn)
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should use default baseDelay of 1000ms', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce('success')

    const promise = retryWithBackoff(fn)

    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)

    // Should wait 2^1 * 1000 = 2000ms by default
    await vi.advanceTimersByTimeAsync(2000)
    expect(fn).toHaveBeenCalledTimes(2)

    const result = await promise
    expect(result).toBe('success')
  })

  it('should handle custom baseDelay', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce('success')

    const promise = retryWithBackoff(fn, {
      maxAttempts: 2,
      baseDelay: 500
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)

    // Should wait 2^1 * 500 = 1000ms
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)

    const result = await promise
    expect(result).toBe('success')
  })

  it('should handle maxAttempts of 1 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Immediate fail'))

    const promise = retryWithBackoff(fn, { maxAttempts: 1 })
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow('Immediate fail')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should preserve error types', async () => {
    class CustomError extends Error {
      code = 'CUSTOM_ERROR'
    }

    const error = new CustomError('Custom failure')
    const fn = vi.fn().mockRejectedValue(error)

    const promise = retryWithBackoff(fn, { maxAttempts: 2 })
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toMatchObject({
      message: 'Custom failure',
      code: 'CUSTOM_ERROR'
    })
  })
})

describe('retryWithFixedDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use fixed delay between retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValueOnce('success')

    const promise = retryWithFixedDelay(fn, {
      maxAttempts: 3,
      delayMs: 1000
    })

    // First attempt
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)

    // Wait 1000ms (fixed delay)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)

    // Wait another 1000ms (fixed delay)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(3)

    const result = await promise
    expect(result).toBe('success')
  })

  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('immediate success')

    const promise = retryWithFixedDelay(fn)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('immediate success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should call onRetry callback', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce('success')

    const onRetry = vi.fn()

    const promise = retryWithFixedDelay(fn, { onRetry })
    await vi.runAllTimersAsync()
    await promise

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
  })

  it('should use default delayMs of 1000ms', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce('success')

    const promise = retryWithFixedDelay(fn)

    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)

    // Default delay is 1000ms
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)

    const result = await promise
    expect(result).toBe('success')
  })
})

describe('Real-world usage scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle API rate limiting scenario', async () => {
    let callCount = 0
    const mockApiCall = vi.fn(async () => {
      callCount++
      if (callCount <= 2) {
        throw new Error('429 Too Many Requests')
      }
      return { data: 'API response' }
    })

    const promise = retryWithBackoff(mockApiCall, {
      maxAttempts: 3,
      onRetry: (attempt, error) => {
        console.log(`Rate limited, retry ${attempt}`)
      }
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ data: 'API response' })
    expect(mockApiCall).toHaveBeenCalledTimes(3)
  })

  it('should handle network timeout scenario', async () => {
    let attempts = 0
    const mockNetworkCall = vi.fn(async () => {
      attempts++
      if (attempts === 1) {
        throw new Error('ETIMEDOUT')
      }
      return 'Network data'
    })

    const promise = retryWithBackoff(mockNetworkCall, {
      maxAttempts: 3,
      baseDelay: 500
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('Network data')
    expect(attempts).toBe(2)
  })

  it('should handle service temporarily unavailable', async () => {
    const mockServiceCall = vi.fn()
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce({ status: 'ok' })

    const promise = retryWithBackoff(mockServiceCall)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ status: 'ok' })
    expect(mockServiceCall).toHaveBeenCalledTimes(3)
  })
})
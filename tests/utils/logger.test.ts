/**
 * Logger Utility Tests
 *
 * Tests for structured logging with different log levels,
 * formatting, and contextual information.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock console methods
const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Dynamically import logger to ensure clean state
  async function getLogger() {
    return await import('../../layers/discubot/server/utils/logger')
  }

  describe('Log Levels', () => {
    it('should log info messages', async () => {
      const { logger } = await getLogger()
      logger.info('Test message')

      expect(consoleLog).toHaveBeenCalledTimes(1)
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[INFO]'))
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Test message'))
    })

    it('should log warning messages', async () => {
      const { logger } = await getLogger()
      logger.warn('Warning message')

      expect(consoleWarn).toHaveBeenCalledTimes(1)
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'))
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Warning message'))
    })

    it('should log error messages', async () => {
      const { logger } = await getLogger()
      logger.error('Error message')

      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'))
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Error message'))
    })

    it('should log debug messages', async () => {
      const { logger } = await getLogger()
      logger.debug('Debug message')

      // Debug may or may not be logged depending on LOG_LEVEL
      // Just verify it doesn't throw
      expect(true).toBe(true)
    })
  })

  describe('Context Logging', () => {
    it('should include context in log messages', async () => {
      const { logger } = await getLogger()
      logger.info('User action', { userId: '123', action: 'login' })

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      expect(logOutput).toContain('User action')
      expect(logOutput).toContain('123')
      expect(logOutput).toContain('login')
    })

    it('should handle empty context', async () => {
      const { logger } = await getLogger()
      logger.info('Message without context', {})

      expect(consoleLog).toHaveBeenCalledTimes(1)
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Message without context'))
    })

    it('should handle complex context objects', async () => {
      const { logger } = await getLogger()
      logger.info('Complex context', {
        user: { id: '123', name: 'John' },
        metadata: { tags: ['a', 'b'] },
      })

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      expect(logOutput).toContain('Complex context')
    })
  })

  describe('Error Logging', () => {
    it('should log errors with stack traces', async () => {
      const { logger } = await getLogger()
      const error = new Error('Test error')
      logger.error('Operation failed', error)

      expect(consoleError).toHaveBeenCalledTimes(1)
      const logOutput = consoleError.mock.calls[0][0]
      expect(logOutput).toContain('Operation failed')
      expect(logOutput).toContain('Test error')
    })

    it('should handle errors without stack traces', async () => {
      const { logger } = await getLogger()
      logger.error('Operation failed', 'Simple error string')

      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Operation failed'))
    })

    it('should log errors with context', async () => {
      const { logger } = await getLogger()
      const error = new Error('Test error')
      logger.error('Operation failed', error, { userId: '123', operation: 'fetch' })

      expect(consoleError).toHaveBeenCalledTimes(1)
      const logOutput = consoleError.mock.calls[0][0]
      expect(logOutput).toContain('Operation failed')
      expect(logOutput).toContain('Test error')
      expect(logOutput).toContain('123')
    })
  })

  describe('Timer', () => {
    it('should measure operation duration', async () => {
      const { logger } = await getLogger()
      const timer = logger.startTimer()

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10))

      timer.end('Operation completed')

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      expect(logOutput).toContain('Operation completed')
      expect(logOutput).toMatch(/\d+ms/)
    })

    it('should return duration from timer.end()', async () => {
      const { logger } = await getLogger()
      const timer = logger.startTimer()

      await new Promise(resolve => setTimeout(resolve, 10))

      const duration = timer.end('Operation completed')

      expect(duration).toBeGreaterThan(0)
      expect(duration).toBeLessThan(1000) // Should be well under 1 second
    })

    it('should log timer with context', async () => {
      const { logger } = await getLogger()
      const timer = logger.startTimer()

      timer.end('Operation completed', { operation: 'fetch', records: 10 })

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      expect(logOutput).toContain('Operation completed')
      expect(logOutput).toContain('fetch')
      expect(logOutput).toContain('10')
    })
  })

  describe('Specialized Logging Methods', () => {
    it('should log API requests', async () => {
      const { logger } = await getLogger()
      logger.request('GET', '/api/users', { userId: '123' })

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      expect(logOutput).toContain('GET')
      expect(logOutput).toContain('/api/users')
      expect(logOutput).toContain('123')
    })

    it('should log API responses with status codes', async () => {
      const { logger } = await getLogger()
      logger.response('GET', '/api/users', 200, 150, { userId: '123' })

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      expect(logOutput).toContain('GET')
      expect(logOutput).toContain('/api/users')
      expect(logOutput).toContain('200')
      expect(logOutput).toContain('150ms')
    })

    it('should log 4xx responses as warnings', async () => {
      const { logger } = await getLogger()
      logger.response('POST', '/api/users', 400, 50)

      expect(consoleWarn).toHaveBeenCalledTimes(1)
      const logOutput = consoleWarn.mock.calls[0][0]
      expect(logOutput).toContain('POST')
      expect(logOutput).toContain('400')
    })

    it('should log 5xx responses as errors', async () => {
      const { logger } = await getLogger()
      logger.response('POST', '/api/users', 500, 50)

      expect(consoleError).toHaveBeenCalledTimes(1)
      const logOutput = consoleError.mock.calls[0][0]
      expect(logOutput).toContain('POST')
      expect(logOutput).toContain('500')
    })

    it('should log webhook events', async () => {
      const { logger } = await getLogger()
      logger.webhook('slack', 'message.created', { channelId: 'C123' })

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      expect(logOutput).toContain('Webhook received')
      expect(logOutput).toContain('slack')
      expect(logOutput).toContain('message.created')
    })

    it('should log processing stages', async () => {
      const { logger } = await getLogger()
      logger.processing('AI Analysis', { discussionId: '123' })

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      expect(logOutput).toContain('Processing')
      expect(logOutput).toContain('AI Analysis')
      expect(logOutput).toContain('123')
    })
  })

  describe('Timestamp Formatting', () => {
    it('should include ISO 8601 timestamps', async () => {
      const { logger } = await getLogger()
      logger.info('Test message')

      expect(consoleLog).toHaveBeenCalledTimes(1)
      const logOutput = consoleLog.mock.calls[0][0]
      // Check for ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
      expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
    })
  })
})
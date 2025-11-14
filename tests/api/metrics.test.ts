/**
 * Metrics Endpoint Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { H3Event } from 'h3'
import { metricsCollector, METRICS } from '../../layers/discubot/server/utils/metrics'

// Mock logger
vi.mock('../../layers/discubot/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}))

describe('Metrics Endpoint', () => {
  beforeEach(() => {
    // Clear metrics before each test
    metricsCollector.clearAll()
  })

  describe('GET /api/metrics', () => {
    it('should return metrics response', async () => {
      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      expect(response).toBeDefined()
      expect(response.timestamp).toBeDefined()
      expect(response.summary).toBeDefined()
      expect(response.operations).toBeDefined()
      expect(response.topSlowest).toBeDefined()
      expect(response.topErrors).toBeDefined()
    })

    it('should include summary statistics', async () => {
      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      expect(response.summary.totalOperations).toBeGreaterThanOrEqual(0)
      expect(response.summary.totalDataPoints).toBeGreaterThanOrEqual(0)
      expect(response.summary.averageSuccessRate).toBeGreaterThanOrEqual(0)
      expect(response.summary.averageSuccessRate).toBeLessThanOrEqual(100)
    })

    it('should return empty stats when no metrics collected', async () => {
      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      expect(response.summary.totalOperations).toBe(0)
      expect(response.summary.totalDataPoints).toBe(0)
      expect(response.operations).toEqual({})
      expect(response.topSlowest).toHaveLength(0)
      expect(response.topErrors).toHaveLength(0)
    })

    it('should include all operation metrics', async () => {
      // Add some metrics
      metricsCollector.record(METRICS.WEBHOOK_SLACK, 100, true)
      metricsCollector.record(METRICS.PROCESS_FULL, 2000, true)
      metricsCollector.record(METRICS.AI_GENERATE_SUMMARY, 1500, true)

      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      expect(response.operations[METRICS.WEBHOOK_SLACK]).toBeDefined()
      expect(response.operations[METRICS.PROCESS_FULL]).toBeDefined()
      expect(response.operations[METRICS.AI_GENERATE_SUMMARY]).toBeDefined()
    })

    it('should list top slowest operations', async () => {
      // Add operations with different durations
      metricsCollector.record('fast.operation', 10, true)
      metricsCollector.record('medium.operation', 100, true)
      metricsCollector.record('slow.operation', 5000, true)
      metricsCollector.record('very.slow.operation', 10000, true)

      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      expect(response.topSlowest.length).toBeGreaterThan(0)

      // Should be sorted by p95 duration (slowest first)
      if (response.topSlowest.length >= 2) {
        expect(response.topSlowest[0].p95Duration).toBeGreaterThanOrEqual(
          response.topSlowest[1].p95Duration
        )
      }
    })

    it('should list top operations with errors', async () => {
      // Add operations with different error rates
      metricsCollector.record('success.operation', 100, true)
      metricsCollector.record('sometimes.fails', 100, true)
      metricsCollector.record('sometimes.fails', 100, false)
      metricsCollector.record('always.fails', 100, false)
      metricsCollector.record('always.fails', 100, false)

      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      expect(response.topErrors.length).toBeGreaterThan(0)

      // Should include failure count
      response.topErrors.forEach(error => {
        expect(error.failureCount).toBeGreaterThan(0)
        expect(error.errorRate).toBeGreaterThan(0)
      })

      // Should be sorted by error rate (highest first)
      if (response.topErrors.length >= 2) {
        expect(response.topErrors[0].errorRate).toBeGreaterThanOrEqual(
          response.topErrors[1].errorRate
        )
      }
    })

    it('should limit top lists to 10 items', async () => {
      // Add 20 operations
      for (let i = 0; i < 20; i++) {
        metricsCollector.record(`operation.${i}`, i * 100, true)
      }

      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      expect(response.topSlowest.length).toBeLessThanOrEqual(10)
    })

    it('should include ISO timestamp', async () => {
      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      expect(response.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
    })

    it('should calculate average success rate correctly', async () => {
      // Add operations with known success rates
      // Operation A: 100% success (5 out of 5)
      for (let i = 0; i < 5; i++) {
        metricsCollector.record('operation.a', 100, true)
      }

      // Operation B: 50% success (5 out of 10)
      for (let i = 0; i < 5; i++) {
        metricsCollector.record('operation.b', 100, true)
        metricsCollector.record('operation.b', 100, false)
      }

      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      // Average of 100% and 50% = 75%
      expect(response.summary.averageSuccessRate).toBe(75)
    })
  })

  describe('Real-world Scenario', () => {
    it('should handle realistic metric data', async () => {
      // Simulate a day of webhook processing
      // 100 Slack webhooks, 95% success
      for (let i = 0; i < 95; i++) {
        metricsCollector.record(METRICS.WEBHOOK_SLACK, 50 + Math.random() * 100, true)
      }
      for (let i = 0; i < 5; i++) {
        metricsCollector.record(METRICS.WEBHOOK_SLACK, 50 + Math.random() * 100, false)
      }

      // 80 full processing runs, 90% success
      for (let i = 0; i < 72; i++) {
        metricsCollector.record(METRICS.PROCESS_FULL, 2000 + Math.random() * 1000, true)
      }
      for (let i = 0; i < 8; i++) {
        metricsCollector.record(METRICS.PROCESS_FULL, 2000 + Math.random() * 1000, false)
      }

      // 72 AI analysis runs (only successful processing)
      for (let i = 0; i < 72; i++) {
        metricsCollector.record(METRICS.AI_GENERATE_SUMMARY, 1500 + Math.random() * 500, true)
      }

      const { default: metricsHandler } = await import('../../layers/discubot/server/api/metrics.get')

      const mockEvent = {
        node: { req: {}, res: {} },
      } as any as H3Event

      const response = await metricsHandler(mockEvent)

      // Verify summary
      expect(response.summary.totalOperations).toBe(3)
      expect(response.summary.totalDataPoints).toBe(252)

      // Verify Slack webhook stats
      const slackStats = response.operations[METRICS.WEBHOOK_SLACK]
      expect(slackStats.count).toBe(100)
      expect(slackStats.successRate).toBe(95)

      // Verify processing stats
      const processStats = response.operations[METRICS.PROCESS_FULL]
      expect(processStats.count).toBe(80)
      expect(processStats.successRate).toBe(90)

      // Verify AI stats (100% success)
      const aiStats = response.operations[METRICS.AI_GENERATE_SUMMARY]
      expect(aiStats.count).toBe(72)
      expect(aiStats.successRate).toBe(100)

      // Verify top errors includes operations with failures
      const errorOperations = response.topErrors.map(e => e.operation)
      expect(errorOperations).toContain(METRICS.WEBHOOK_SLACK)
      expect(errorOperations).toContain(METRICS.PROCESS_FULL)
      expect(errorOperations).not.toContain(METRICS.AI_GENERATE_SUMMARY)
    })
  })
})
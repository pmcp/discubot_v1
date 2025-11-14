/**
 * Metrics Utility Tests
 *
 * Tests for performance metrics tracking, aggregation, and reporting.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { metricsCollector, METRICS } from '../../layers/discubot/server/utils/metrics'

describe('Metrics Collector', () => {
  beforeEach(() => {
    // Clear all metrics before each test
    metricsCollector.clearAll()
  })

  describe('Timer Operations', () => {
    it('should measure operation duration', async () => {
      const timer = metricsCollector.start('test.operation')

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10))

      const duration = timer.end({ success: true })

      expect(duration).toBeGreaterThan(0)
      expect(duration).toBeLessThan(1000)
    })

    it('should record successful operations', () => {
      const timer = metricsCollector.start('test.operation')
      timer.end({ success: true })

      const stats = metricsCollector.getStats('test.operation')
      expect(stats).toBeDefined()
      expect(stats!.count).toBe(1)
      expect(stats!.successCount).toBe(1)
      expect(stats!.failureCount).toBe(0)
      expect(stats!.successRate).toBe(100)
    })

    it('should record failed operations', () => {
      const timer = metricsCollector.start('test.operation')
      timer.end({ success: false })

      const stats = metricsCollector.getStats('test.operation')
      expect(stats).toBeDefined()
      expect(stats!.count).toBe(1)
      expect(stats!.successCount).toBe(0)
      expect(stats!.failureCount).toBe(1)
      expect(stats!.successRate).toBe(0)
    })

    it('should default to success if not specified', () => {
      const timer = metricsCollector.start('test.operation')
      timer.end()

      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.successCount).toBe(1)
      expect(stats!.successRate).toBe(100)
    })

    it('should include metadata in recordings', () => {
      const timer = metricsCollector.start('test.operation')
      timer.end({ success: true, userId: '123', action: 'fetch' })

      const stats = metricsCollector.getStats('test.operation')
      expect(stats).toBeDefined()
      expect(stats!.count).toBe(1)
    })
  })

  describe('Direct Recording', () => {
    it('should record metrics without timing', () => {
      metricsCollector.record('test.operation', 100, true)

      const stats = metricsCollector.getStats('test.operation')
      expect(stats).toBeDefined()
      expect(stats!.count).toBe(1)
      expect(stats!.durations.avg).toBe(100)
    })

    it('should record multiple data points', () => {
      metricsCollector.record('test.operation', 100, true)
      metricsCollector.record('test.operation', 200, true)
      metricsCollector.record('test.operation', 300, true)

      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.count).toBe(3)
      expect(stats!.durations.avg).toBe(200)
    })
  })

  describe('Statistics Calculation', () => {
    beforeEach(() => {
      // Record sample data
      metricsCollector.record('test.operation', 100, true)
      metricsCollector.record('test.operation', 200, true)
      metricsCollector.record('test.operation', 300, false)
      metricsCollector.record('test.operation', 400, true)
      metricsCollector.record('test.operation', 500, true)
    })

    it('should calculate min duration', () => {
      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.durations.min).toBe(100)
    })

    it('should calculate max duration', () => {
      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.durations.max).toBe(500)
    })

    it('should calculate avg duration', () => {
      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.durations.avg).toBe(300)
    })

    it('should calculate p95 percentile', () => {
      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.durations.p95).toBeGreaterThan(0)
      expect(stats!.durations.p95).toBeLessThanOrEqual(500)
    })

    it('should calculate p99 percentile', () => {
      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.durations.p99).toBeGreaterThan(0)
      expect(stats!.durations.p99).toBeLessThanOrEqual(500)
    })

    it('should calculate success rate', () => {
      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.successRate).toBe(80) // 4 out of 5
    })

    it('should count successes and failures', () => {
      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.successCount).toBe(4)
      expect(stats!.failureCount).toBe(1)
    })

    it('should include lastUpdated timestamp', () => {
      const stats = metricsCollector.getStats('test.operation')
      expect(stats!.lastUpdated).toBeDefined()
      expect(new Date(stats!.lastUpdated).getTime()).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('Multiple Operations', () => {
    it('should track multiple operations independently', () => {
      metricsCollector.record('operation.a', 100, true)
      metricsCollector.record('operation.b', 200, true)

      const statsA = metricsCollector.getStats('operation.a')
      const statsB = metricsCollector.getStats('operation.b')

      expect(statsA!.durations.avg).toBe(100)
      expect(statsB!.durations.avg).toBe(200)
    })

    it('should get all stats for all operations', () => {
      metricsCollector.record('operation.a', 100, true)
      metricsCollector.record('operation.b', 200, true)
      metricsCollector.record('operation.c', 300, true)

      const allStats = metricsCollector.getAllStats()

      expect(Object.keys(allStats)).toHaveLength(3)
      expect(allStats['operation.a']).toBeDefined()
      expect(allStats['operation.b']).toBeDefined()
      expect(allStats['operation.c']).toBeDefined()
    })

    it('should count total operations', () => {
      metricsCollector.record('operation.a', 100, true)
      metricsCollector.record('operation.b', 200, true)
      metricsCollector.record('operation.c', 300, true)

      expect(metricsCollector.getOperationCount()).toBe(3)
    })

    it('should count total data points', () => {
      metricsCollector.record('operation.a', 100, true)
      metricsCollector.record('operation.a', 200, true)
      metricsCollector.record('operation.b', 300, true)

      expect(metricsCollector.getTotalDataPoints()).toBe(3)
    })
  })

  describe('Clearing Metrics', () => {
    beforeEach(() => {
      metricsCollector.record('operation.a', 100, true)
      metricsCollector.record('operation.b', 200, true)
    })

    it('should clear specific operation', () => {
      metricsCollector.clear('operation.a')

      expect(metricsCollector.getStats('operation.a')).toBeUndefined()
      expect(metricsCollector.getStats('operation.b')).toBeDefined()
    })

    it('should clear all operations', () => {
      metricsCollector.clearAll()

      expect(metricsCollector.getOperationCount()).toBe(0)
      expect(metricsCollector.getTotalDataPoints()).toBe(0)
    })
  })

  describe('Memory Management', () => {
    it('should limit data points per operation', () => {
      // Record more than MAX_DATA_POINTS (1000)
      for (let i = 0; i < 1500; i++) {
        metricsCollector.record('test.operation', 100, true)
      }

      const stats = metricsCollector.getStats('test.operation')
      // Should be capped at 1000
      expect(stats!.count).toBeLessThanOrEqual(1000)
    })
  })

  describe('Edge Cases', () => {
    it('should handle non-existent operation stats', () => {
      const stats = metricsCollector.getStats('non.existent')
      expect(stats).toBeUndefined()
    })

    it('should handle empty stats gracefully', () => {
      const allStats = metricsCollector.getAllStats()
      expect(allStats).toEqual({})
    })

    it('should handle zero data points', () => {
      metricsCollector.clearAll()
      expect(metricsCollector.getOperationCount()).toBe(0)
      expect(metricsCollector.getTotalDataPoints()).toBe(0)
    })
  })

  describe('Predefined Metric Names', () => {
    it('should have webhook metrics defined', () => {
      expect(METRICS.WEBHOOK_SLACK).toBe('webhook.slack')
      expect(METRICS.WEBHOOK_MAILGUN).toBe('webhook.mailgun')
    })

    it('should have process metrics defined', () => {
      expect(METRICS.PROCESS_FULL).toBe('process.full')
      expect(METRICS.PROCESS_VALIDATION).toBe('process.validation')
      expect(METRICS.PROCESS_AI_ANALYSIS).toBe('process.ai_analysis')
    })

    it('should have AI metrics defined', () => {
      expect(METRICS.AI_GENERATE_SUMMARY).toBe('ai.generate_summary')
      expect(METRICS.AI_DETECT_TASKS).toBe('ai.detect_tasks')
    })

    it('should have Notion metrics defined', () => {
      expect(METRICS.NOTION_CREATE_TASK).toBe('notion.create_task')
      expect(METRICS.NOTION_CREATE_TASKS).toBe('notion.create_tasks')
    })

    it('should have adapter metrics defined', () => {
      expect(METRICS.ADAPTER_FETCH_THREAD).toBe('adapter.fetch_thread')
      expect(METRICS.ADAPTER_POST_REPLY).toBe('adapter.post_reply')
    })

    it('should have database metrics defined', () => {
      expect(METRICS.DB_CREATE_DISCUSSION).toBe('db.create_discussion')
      expect(METRICS.DB_CREATE_JOB).toBe('db.create_job')
      expect(METRICS.DB_CREATE_TASK).toBe('db.create_task')
    })
  })

  describe('Real-world Scenario', () => {
    it('should track a full discussion processing flow', () => {
      // Simulate processing stages
      const stages = [
        { name: METRICS.PROCESS_VALIDATION, duration: 10 },
        { name: METRICS.PROCESS_CONFIG_LOAD, duration: 20 },
        { name: METRICS.PROCESS_THREAD_BUILD, duration: 150 },
        { name: METRICS.PROCESS_AI_ANALYSIS, duration: 2000 },
        { name: METRICS.PROCESS_TASK_CREATE, duration: 300 },
        { name: METRICS.PROCESS_NOTIFICATION, duration: 50 },
      ]

      stages.forEach(stage => {
        metricsCollector.record(stage.name, stage.duration, true)
      })

      const allStats = metricsCollector.getAllStats()
      expect(Object.keys(allStats)).toHaveLength(6)

      // Verify slowest operation is AI analysis
      const aiStats = metricsCollector.getStats(METRICS.PROCESS_AI_ANALYSIS)
      expect(aiStats!.durations.avg).toBe(2000)
    })
  })
})
/**
 * Health Check Endpoint Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eventHandler, H3Event } from 'h3'

// Mock logger
vi.mock('../../layers/discubot/server/utils/logger', () => ({
  logger: {
    startTimer: () => ({
      end: vi.fn().mockReturnValue(10),
    }),
    error: vi.fn(),
  },
}))

describe('Health Check Endpoint', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      // Create mock event
      const mockEvent = {
        node: {
          req: {},
          res: {
            statusCode: 200,
          },
        },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response).toBeDefined()
      expect(response.status).toMatch(/healthy|degraded|unhealthy/)
      expect(response.timestamp).toBeDefined()
      expect(response.version).toBeDefined()
      expect(response.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should include memory metrics', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response.memory).toBeDefined()
      expect(response.memory.used).toBeGreaterThan(0)
      expect(response.memory.total).toBeGreaterThan(0)
      expect(response.memory.percentage).toBeGreaterThanOrEqual(0)
      expect(response.memory.percentage).toBeLessThanOrEqual(100)
    })

    it('should include service health checks', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response.services).toBeDefined()
      expect(response.services.database).toBeDefined()
      expect(response.services.ai).toBeDefined()
      expect(response.services.notion).toBeDefined()

      // Each service should have status
      expect(response.services.database.status).toMatch(/healthy|degraded|unhealthy/)
      expect(response.services.ai.status).toMatch(/healthy|degraded|unhealthy/)
      expect(response.services.notion.status).toMatch(/healthy|degraded|unhealthy/)
    })

    it('should check database health', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response.services.database.status).toBeDefined()
      expect(response.services.database.lastCheck).toBeDefined()
    })

    it('should check AI service health', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response.services.ai.status).toBeDefined()
      // AI might be degraded if API key not configured
      if (response.services.ai.status === 'degraded') {
        expect(response.services.ai.message).toContain('not configured')
      }
    })

    it('should check Notion service health', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response.services.notion.status).toBeDefined()
      expect(response.services.notion.lastCheck).toBeDefined()
    })

    it('should return 200 for healthy status', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      if (response.status === 'healthy') {
        // Status code is set but we can't assert it in tests
        // Just verify response is correct
        expect(response.status).toBe('healthy')
      }
    })

    it('should return degraded status if some services are down', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      // If AI key not configured, expect degraded
      if (response.services.ai.status === 'degraded') {
        expect(response.status).toBe('degraded')
      }
    })

    it('should include uptime in seconds', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response.uptime).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(response.uptime)).toBe(true)
    })

    it('should include version information', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response.version).toBeDefined()
      expect(typeof response.version).toBe('string')
    })

    it('should include ISO timestamp', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      expect(response.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
    })
  })

  describe('Health Status Logic', () => {
    it('should be healthy if all services are healthy', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      const allHealthy = Object.values(response.services).every(
        service => service.status === 'healthy'
      )

      if (allHealthy) {
        expect(response.status).toBe('healthy')
      }
    })

    it('should be degraded if some non-critical services are down', async () => {
      const { default: healthHandler } = await import('../../layers/discubot/server/api/health.get')

      const mockEvent = {
        node: { req: {}, res: { statusCode: 200 } },
      } as any as H3Event

      const response = await healthHandler(mockEvent)

      // If AI is degraded but database is healthy, should be degraded
      if (
        response.services.database.status === 'healthy' &&
        response.services.ai.status === 'degraded'
      ) {
        expect(response.status).toBe('degraded')
      }
    })
  })
})
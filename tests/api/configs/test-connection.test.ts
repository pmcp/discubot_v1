/**
 * Test Connection Endpoint Tests
 *
 * Tests the POST /api/configs/test-connection endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SourceConfig } from '~/layers/discubot/types'

// Mock the adapter registry
vi.mock('~/layers/discubot/server/adapters', () => ({
  getAdapter: vi.fn(),
}))

// Mock the Notion service
vi.mock('~/layers/discubot/server/services/notion', () => ({
  testNotionConnection: vi.fn(),
}))

import { getAdapter } from '~/layers/discubot/server/adapters'
import { testNotionConnection } from '~/layers/discubot/server/services/notion'

describe('Test Connection Endpoint', () => {
  const mockGetAdapter = getAdapter as any
  const mockTestNotionConnection = testNotionConnection as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Request Validation', () => {
    it('should reject requests without a type field', async () => {
      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {},
      }).catch(err => err.data)

      expect(response.statusCode).toBe(400)
      expect(response.data.error).toContain('type')
    })

    it('should reject requests with invalid type', async () => {
      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: { type: 'invalid' },
      }).catch(err => err.data)

      expect(response.statusCode).toBe(400)
      expect(response.data.error).toContain('Invalid type')
    })

    it('should reject type:id requests without configId', async () => {
      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: { type: 'id' },
      }).catch(err => err.data)

      expect(response.statusCode).toBe(400)
      expect(response.data.error).toContain('configId')
    })

    it('should reject type:config requests without config object', async () => {
      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: { type: 'config' },
      }).catch(err => err.data)

      expect(response.statusCode).toBe(400)
      expect(response.data.error).toContain('config')
    })

    it('should reject type:config requests with incomplete config', async () => {
      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: {
            sourceType: 'figma',
            // Missing required fields
          },
        },
      }).catch(err => err.data)

      expect(response.statusCode).toBe(400)
      expect(response.data.error).toContain('Missing required fields')
    })
  })

  describe('Test by Config (type: config)', () => {
    const validConfig = {
      sourceType: 'figma',
      apiToken: 'figd_test123',
      notionToken: 'secret_test456',
      notionDatabaseId: 'abc123def456',
      teamId: 'team_xyz',
    }

    it('should successfully test valid Figma config', async () => {
      // Mock adapter
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      // Mock Notion connection
      mockTestNotionConnection.mockResolvedValue({
        connected: true,
        details: {
          databaseId: 'abc123def456',
          title: 'Test Database',
          url: 'https://notion.so/abc123def456',
        },
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: validConfig,
        },
      })

      expect(response.success).toBe(true)
      expect(response.data.sourceConnected).toBe(true)
      expect(response.data.notionConnected).toBe(true)
      expect(response.data.validationErrors).toHaveLength(0)
      expect(response.data.notionDetails).toEqual({
        databaseId: 'abc123def456',
        title: 'Test Database',
        url: 'https://notion.so/abc123def456',
      })
      expect(mockAdapter.validateConfig).toHaveBeenCalled()
      expect(mockAdapter.testConnection).toHaveBeenCalled()
      expect(mockTestNotionConnection).toHaveBeenCalledWith({
        apiKey: validConfig.notionToken,
        databaseId: validConfig.notionDatabaseId,
      })
    })

    it('should successfully test valid Slack config', async () => {
      const slackConfig = {
        ...validConfig,
        sourceType: 'slack',
        apiToken: 'xoxb-test123',
      }

      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: true,
        details: {
          databaseId: 'abc123def456',
          title: 'Slack Tasks',
          url: 'https://notion.so/abc123def456',
        },
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: slackConfig,
        },
      })

      expect(response.success).toBe(true)
      expect(response.data.sourceConnected).toBe(true)
      expect(response.data.notionConnected).toBe(true)
      expect(mockGetAdapter).toHaveBeenCalledWith('slack')
    })

    it('should handle invalid source API token', async () => {
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: false,
          errors: ['Invalid API token format'],
          warnings: [],
        }),
        testConnection: vi.fn().mockResolvedValue(false),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: true,
        details: {
          databaseId: 'abc123def456',
          title: 'Test Database',
          url: 'https://notion.so/abc123def456',
        },
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: {
            ...validConfig,
            apiToken: 'invalid_token',
          },
        },
      })

      expect(response.success).toBe(false)
      expect(response.data.validationErrors).toContain('Invalid API token format')
      expect(response.data.sourceConnected).toBe(false)
    })

    it('should handle source API connection failure', async () => {
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockRejectedValue(new Error('API request failed: 401 Unauthorized')),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: true,
        details: {
          databaseId: 'abc123def456',
          title: 'Test Database',
          url: 'https://notion.so/abc123def456',
        },
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: validConfig,
        },
      })

      expect(response.success).toBe(false)
      expect(response.data.sourceConnected).toBe(false)
      expect(response.data.sourceError).toContain('401 Unauthorized')
      expect(response.data.notionConnected).toBe(true)
    })

    it('should handle invalid Notion API token', async () => {
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: false,
        error: 'Unauthorized: Invalid API token',
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: validConfig,
        },
      })

      expect(response.success).toBe(false)
      expect(response.data.sourceConnected).toBe(true)
      expect(response.data.notionConnected).toBe(false)
      expect(response.data.notionError).toContain('Unauthorized')
    })

    it('should handle invalid Notion database ID', async () => {
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: false,
        error: 'Could not find database with ID: invalid_id',
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: {
            ...validConfig,
            notionDatabaseId: 'invalid_id',
          },
        },
      })

      expect(response.success).toBe(false)
      expect(response.data.notionConnected).toBe(false)
      expect(response.data.notionError).toContain('Could not find database')
    })

    it('should handle both source and Notion failures', async () => {
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockRejectedValue(new Error('Source API error')),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: false,
        error: 'Notion API error',
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: validConfig,
        },
      })

      expect(response.success).toBe(false)
      expect(response.data.sourceConnected).toBe(false)
      expect(response.data.notionConnected).toBe(false)
      expect(response.data.sourceError).toContain('Source API error')
      expect(response.data.notionError).toContain('Notion API error')
    })

    it('should include validation warnings in response', async () => {
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: ['API token appears to be a test token'],
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: true,
        details: {
          databaseId: 'abc123def456',
          title: 'Test Database',
          url: 'https://notion.so/abc123def456',
        },
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: validConfig,
        },
      })

      expect(response.success).toBe(true)
      expect(response.data.validationWarnings).toContain('API token appears to be a test token')
    })

    it('should return testTime in response', async () => {
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: true,
        details: {
          databaseId: 'abc123def456',
          title: 'Test Database',
          url: 'https://notion.so/abc123def456',
        },
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: validConfig,
        },
      })

      expect(response.data.testTime).toBeGreaterThan(0)
      expect(typeof response.data.testTime).toBe('number')
    })
  })

  describe('Test by ID (type: id)', () => {
    it('should return 501 Not Implemented for now', async () => {
      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'id',
          configId: 'config_123',
        },
      }).catch(err => err.data)

      expect(response.statusCode).toBe(501)
      expect(response.data.error).toContain('not yet implemented')
    })
  })

  describe('Unknown Source Types', () => {
    it('should handle unknown source type gracefully', async () => {
      mockGetAdapter.mockImplementation(() => {
        throw new Error('Unknown source type: unknown')
      })

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: {
            sourceType: 'unknown',
            apiToken: 'test123',
            notionToken: 'secret_test456',
            notionDatabaseId: 'abc123def456',
            teamId: 'team_xyz',
          },
        },
      }).catch(err => err.data)

      expect(response.statusCode).toBe(500)
      expect(response.data.error).toContain('Unknown source type')
    })
  })

  describe('Performance', () => {
    it('should complete test within reasonable time', async () => {
      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: true,
        details: {
          databaseId: 'abc123def456',
          title: 'Test Database',
          url: 'https://notion.so/abc123def456',
        },
      })

      const startTime = Date.now()

      const response = await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: {
            sourceType: 'figma',
            apiToken: 'figd_test123',
            notionToken: 'secret_test456',
            notionDatabaseId: 'abc123def456',
            teamId: 'team_xyz',
          },
        },
      })

      const duration = Date.now() - startTime

      expect(response.data.testTime).toBeLessThan(5000) // Should complete in < 5s
      expect(duration).toBeLessThan(5000)
    })
  })

  describe('Logging', () => {
    it('should log test connection attempts', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      const mockAdapter = {
        validateConfig: vi.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      }
      mockGetAdapter.mockReturnValue(mockAdapter)

      mockTestNotionConnection.mockResolvedValue({
        connected: true,
        details: {
          databaseId: 'abc123def456',
          title: 'Test Database',
          url: 'https://notion.so/abc123def456',
        },
      })

      await $fetch('/api/configs/test-connection', {
        method: 'POST',
        body: {
          type: 'config',
          config: {
            sourceType: 'figma',
            apiToken: 'figd_test123',
            notionToken: 'secret_test456',
            notionDatabaseId: 'abc123def456',
            teamId: 'team_xyz',
          },
        },
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Test Connection]'),
        expect.any(Object),
      )
    })
  })
})

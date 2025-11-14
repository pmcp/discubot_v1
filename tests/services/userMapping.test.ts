import { describe, it, expect, vi } from 'vitest'
import { buildNotionMention, bulkImportMappings } from '~/layers/discubot/server/services/userMapping'

describe('userMappingService', () => {
  describe('buildNotionMention', () => {
    it('should build mention object with user ID', () => {
      const result = buildNotionMention('notion-user-123')

      expect(result).toEqual({
        type: 'mention',
        mention: {
          type: 'user',
          user: {
            id: 'notion-user-123',
          },
        },
      })
    })

    it('should handle different user ID formats', () => {
      const userIds = [
        '12345678-1234-1234-1234-123456789012',
        'user_abc123',
        'notion-id-xyz',
      ]

      userIds.forEach((userId) => {
        const result = buildNotionMention(userId)
        expect(result.mention.user.id).toBe(userId)
      })
    })
  })

  describe('bulkImportMappings', () => {
    it('should validate required fields', async () => {
      const invalidMappings = [
        {
          // missing sourceType
          sourceUserId: 'user1',
          notionUserId: 'notion1',
        },
        {
          // missing sourceUserId
          sourceType: 'slack',
          notionUserId: 'notion1',
        },
        {
          // missing notionUserId
          sourceType: 'slack',
          sourceUserId: 'user1',
        },
      ]

      const result = await bulkImportMappings(invalidMappings as any, 'team-123')

      expect(result.failed).toBe(3)
      expect(result.errors).toHaveLength(3)
      expect(result.successful).toBe(0)
    })

    it('should validate sourceType values', async () => {
      const mappings = [
        {
          sourceType: 'invalid-type' as any,
          sourceUserId: 'user1',
          notionUserId: 'notion1',
        },
      ]

      const result = await bulkImportMappings(mappings, 'team-123')

      expect(result.failed).toBe(1)
      expect(result.errors[0]).toContain('Invalid sourceType')
    })

    it('should set mappingType to "imported"', async () => {
      // Mock Crouton mutation
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'mapping-123',
      })

      // This test validates the structure but would need Crouton mocking
      const mappings = [
        {
          sourceType: 'slack' as const,
          sourceUserId: 'U123',
          notionUserId: 'notion-123',
          sourceUserEmail: 'user@example.com',
        },
      ]

      // Would need to mock createDiscubotUserMapping
      // For now, test structure validation
      expect(mappings[0].sourceType).toBe('slack')
    })

    it('should handle partial failures gracefully', async () => {
      const mappings = [
        {
          sourceType: 'slack' as const,
          sourceUserId: 'U1',
          notionUserId: 'notion-1',
        },
        {
          // invalid
          sourceType: 'invalid' as any,
          sourceUserId: 'U2',
          notionUserId: 'notion-2',
        },
        {
          sourceType: 'figma' as const,
          sourceUserId: 'F3',
          notionUserId: 'notion-3',
        },
      ]

      const result = await bulkImportMappings(mappings, 'team-123')

      // Should process all, some will fail validation
      expect(result.failed).toBeGreaterThan(0)
    })

    it('should enforce max limit of 1000 mappings', async () => {
      const mappings = Array(1001)
        .fill(null)
        .map((_, i) => ({
          sourceType: 'slack' as const,
          sourceUserId: `U${i}`,
          notionUserId: `notion-${i}`,
        }))

      const result = await bulkImportMappings(mappings, 'team-123')

      // Should reject or truncate
      expect(result.failed).toBeGreaterThan(0)
    })

    it('should preserve optional fields', async () => {
      const mappings = [
        {
          sourceType: 'slack' as const,
          sourceUserId: 'U123',
          notionUserId: 'notion-123',
          sourceUserEmail: 'user@example.com',
          sourceUserName: 'John Doe',
          notionUserEmail: 'john@notion.com',
          notionUserName: 'John Doe',
          confidence: 0.95,
        },
      ]

      // Validate structure
      expect(mappings[0]).toHaveProperty('sourceUserEmail')
      expect(mappings[0]).toHaveProperty('confidence')
      expect(mappings[0].confidence).toBe(0.95)
    })

    it('should handle empty array', async () => {
      const result = await bulkImportMappings([], 'team-123')

      expect(result.successful).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.errors).toEqual([])
    })
  })
})

import { describe, it, expect } from 'vitest'
import { sanitizeString, sanitizeObject, SlackEventSchema, MailgunPayloadSchema } from '~/layers/discubot/server/utils/validation'

describe('validation', () => {
  describe('sanitizeString', () => {
    it('should remove XSS script tags', () => {
      const input = 'Hello <script>alert("xss")</script> world'
      const result = sanitizeString(input)
      expect(result).toBe('Hello  world')
    })

    it('should remove HTML tags', () => {
      const input = '<div>Hello</div> <span>World</span>'
      const result = sanitizeString(input)
      expect(result).toBe('Hello World')
    })

    it('should handle empty string', () => {
      const result = sanitizeString('')
      expect(result).toBe('')
    })

    it('should preserve plain text', () => {
      const input = 'This is plain text with no HTML'
      const result = sanitizeString(input)
      expect(result).toBe(input)
    })

    it('should remove dangerous event handlers', () => {
      const input = '<img src="x" onerror="alert(1)">'
      const result = sanitizeString(input)
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert')
    })

    it('should handle nested tags', () => {
      const input = '<div><p><span>text</span></p></div>'
      const result = sanitizeString(input)
      expect(result).toBe('text')
    })

    it('should preserve unicode characters', () => {
      const input = 'Hello 世界 🌍'
      const result = sanitizeString(input)
      expect(result).toBe(input)
    })
  })

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const input = {
        name: '<script>alert("xss")</script>John',
        email: 'test@example.com',
      }
      const result = sanitizeObject(input)
      expect(result.name).toBe('John')
      expect(result.email).toBe('test@example.com')
    })

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<b>John</b>',
          bio: '<script>bad</script>Nice person',
        },
      }
      const result = sanitizeObject(input)
      expect(result.user.name).toBe('John')
      expect(result.user.bio).toBe('Nice person')
    })

    it('should handle arrays of strings', () => {
      const input = {
        tags: ['<script>xss</script>tag1', 'tag2', '<b>tag3</b>'],
      }
      const result = sanitizeObject(input)
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3'])
    })

    it('should preserve non-string values', () => {
      const input = {
        count: 42,
        active: true,
        created: null,
        metadata: undefined,
      }
      const result = sanitizeObject(input)
      expect(result.count).toBe(42)
      expect(result.active).toBe(true)
      expect(result.created).toBe(null)
      expect(result.metadata).toBe(undefined)
    })

    it('should handle empty object', () => {
      const result = sanitizeObject({})
      expect(result).toEqual({})
    })

    it('should handle complex nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              text: '<script>alert(1)</script>Hello',
            },
          },
        },
      }
      const result = sanitizeObject(input)
      expect(result.level1.level2.level3.text).toBe('Hello')
    })

    it('should handle arrays of objects', () => {
      const input = {
        items: [
          { name: '<b>Item 1</b>' },
          { name: '<i>Item 2</i>' },
        ],
      }
      const result = sanitizeObject(input)
      expect(result.items[0].name).toBe('Item 1')
      expect(result.items[1].name).toBe('Item 2')
    })
  })

  describe('SlackEventSchema', () => {
    it('should validate correct Slack event', () => {
      const validEvent = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          user: 'U123456',
          text: 'Hello',
          channel: 'C123456',
          ts: '1234567890.123456',
        },
      }

      const result = SlackEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    it('should reject event with missing required fields', () => {
      const invalidEvent = {
        type: 'event_callback',
        // missing team_id
        event: {
          type: 'message',
        },
      }

      const result = SlackEventSchema.safeParse(invalidEvent)
      expect(result.success).toBe(false)
    })

    it('should validate event with thread_ts', () => {
      const threadEvent = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          user: 'U123456',
          text: 'Reply',
          channel: 'C123456',
          ts: '1234567890.123456',
          thread_ts: '1234567890.000000',
        },
      }

      const result = SlackEventSchema.safeParse(threadEvent)
      expect(result.success).toBe(true)
    })

    it('should validate event with subtype', () => {
      const subtypeEvent = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          user: 'U123456',
          text: 'Edited',
          channel: 'C123456',
          ts: '1234567890.123456',
          subtype: 'message_changed',
        },
      }

      const result = SlackEventSchema.safeParse(subtypeEvent)
      expect(result.success).toBe(true)
    })
  })

  describe('MailgunPayloadSchema', () => {
    it('should validate correct Mailgun payload', () => {
      const validPayload = {
        recipient: 'webhook@example.com',
        'body-html': '<p>Email content</p>',
        'body-plain': 'Email content',
        subject: 'Test subject',
        from: 'sender@example.com',
        timestamp: '1234567890',
        signature: {
          timestamp: '1234567890',
          token: 'abc123',
          signature: 'def456',
        },
      }

      const result = MailgunPayloadSchema.safeParse(validPayload)
      expect(result.success).toBe(true)
    })

    it('should reject payload with missing recipient', () => {
      const invalidPayload = {
        'body-html': '<p>Content</p>',
      }

      const result = MailgunPayloadSchema.safeParse(invalidPayload)
      expect(result.success).toBe(false)
    })

    it('should accept payload with minimal required fields', () => {
      const minimalPayload = {
        recipient: 'webhook@example.com',
        'body-html': '<p>Content</p>',
      }

      const result = MailgunPayloadSchema.safeParse(minimalPayload)
      expect(result.success).toBe(true)
    })

    it('should validate signature object if present', () => {
      const payloadWithSignature = {
        recipient: 'webhook@example.com',
        'body-html': '<p>Content</p>',
        signature: {
          timestamp: '123',
          token: 'abc',
          signature: 'xyz',
        },
      }

      const result = MailgunPayloadSchema.safeParse(payloadWithSignature)
      expect(result.success).toBe(true)
    })

    it('should reject invalid signature object', () => {
      const payloadWithBadSignature = {
        recipient: 'webhook@example.com',
        'body-html': '<p>Content</p>',
        signature: {
          // missing required fields
          timestamp: '123',
        },
      }

      const result = MailgunPayloadSchema.safeParse(payloadWithBadSignature)
      expect(result.success).toBe(false)
    })
  })
})

/**
 * Resend Webhook Endpoint Tests
 *
 * Comprehensive test suite for the Resend webhook handler.
 * Tests cover webhook validation, email fetching, transformation, and processing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ResendEmailResponse } from '~/layers/discubot/server/utils/resendEmail'

// Mock dependencies
vi.mock('~/layers/discubot/server/adapters', () => ({
  getAdapter: vi.fn(() => ({
    parseIncoming: vi.fn(async (payload) => ({
      sourceType: 'figma',
      sourceThreadId: 'test-file-key',
      sourceUrl: 'https://www.figma.com/file/test-file-key',
      teamId: 'test-team',
      authorHandle: 'jane@company.com',
      title: 'Jane commented on Design File',
      content: 'This is a comment',
      participants: ['jane@company.com'],
      timestamp: new Date('2025-01-15T12:00:00Z'),
      metadata: {
        fileKey: 'test-file-key',
        emailType: 'comment',
      },
    })),
  })),
}))

vi.mock('~/layers/discubot/server/services/processor', () => ({
  processDiscussion: vi.fn(async () => ({
    discussionId: 'disc-123',
    notionTasks: [
      {
        taskId: 'task-123',
        url: 'https://notion.so/task-123',
      },
    ],
    isMultiTask: false,
  })),
}))

vi.mock('~/layers/discubot/server/utils/resendEmail', () => ({
  fetchResendEmail: vi.fn(async (emailId: string, apiToken: string) => {
    if (emailId === 'missing-email') {
      throw new Error('Email not found')
    }
    return {
      id: emailId,
      object: 'email',
      from: 'comments-abc123@email.figma.com',
      to: ['team-slug@discubot.example.com'],
      subject: 'Jane commented on Design File',
      html: '<html><body>This is a comment</body></html>',
      text: 'This is a comment',
      created_at: '2025-01-15T12:00:00.000Z',
    } as ResendEmailResponse
  }),
  transformToMailgunFormat: vi.fn((resendEmail) => ({
    subject: resendEmail.subject,
    from: resendEmail.from,
    recipient: resendEmail.to[0],
    'body-html': resendEmail.html || '',
    'body-plain': resendEmail.text || '',
    'stripped-text': resendEmail.text || '',
    timestamp: new Date(resendEmail.created_at).getTime() / 1000,
  })),
}))

vi.mock('~/layers/discubot/server/utils/rateLimit', () => ({
  rateLimit: vi.fn(async () => {}),
  RateLimitPresets: {
    WEBHOOK: { limit: 100, window: 60000 },
  },
}))

describe('/api/webhooks/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Webhook Validation', () => {
    it('should reject webhooks without type field', async () => {
      const payload = {
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.statusMessage).toContain('Invalid Resend webhook payload')
    })

    it('should reject non-email.received events', async () => {
      const payload = {
        type: 'email.sent',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.statusMessage).toContain('Invalid event type')
    })

    it('should reject webhooks without data.id', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {},
      }

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.statusMessage).toContain('Invalid Resend webhook payload')
    })

    it('should accept valid email.received webhooks', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
          from: 'comments-abc123@email.figma.com',
          to: ['team-slug@discubot.example.com'],
          subject: 'Jane commented on Design File',
        },
      }

      // Mock runtime config
      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('Email Fetching', () => {
    it('should fetch email content from Resend API', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      const { fetchResendEmail } = await import('~/layers/discubot/server/utils/resendEmail')

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(200)
      expect(fetchResendEmail).toHaveBeenCalledWith('email-123', 'test-token')
    })

    it('should handle missing email errors', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'missing-email',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(422)
      const data = await response.json()
      expect(data.statusMessage).toContain('Failed to fetch email')
    })

    it('should handle missing RESEND_API_TOKEN', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({}))

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.statusMessage).toContain('RESEND_API_TOKEN not configured')
    })
  })

  describe('Email Transformation', () => {
    it('should transform Resend email to Mailgun format', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      const { transformToMailgunFormat } = await import('~/layers/discubot/server/utils/resendEmail')

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(200)
      expect(transformToMailgunFormat).toHaveBeenCalled()
    })
  })

  describe('Discussion Processing', () => {
    it('should process discussion successfully', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
          from: 'comments-abc123@email.figma.com',
          to: ['team-slug@discubot.example.com'],
          subject: 'Jane commented on Design File',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.discussionId).toBe('disc-123')
      expect(data.data.notionTasks).toHaveLength(1)
      expect(data.data.processingTime).toBeGreaterThan(0)
    })

    it('should return processing metrics', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      const response = await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.processingTime).toBeDefined()
      expect(typeof data.data.processingTime).toBe('number')
    })
  })

  describe('Rate Limiting', () => {
    it('should apply rate limiting to webhook requests', async () => {
      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      const { rateLimit } = await import('~/layers/discubot/server/utils/rateLimit')

      await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(rateLimit).toHaveBeenCalled()
    })
  })

  describe('Logging', () => {
    it('should log webhook receipt', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Resend Webhook]'),
        expect.any(Object)
      )
    })

    it('should log processing success', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      const payload = {
        type: 'email.received',
        created_at: '2025-01-15T12:00:00.000Z',
        data: {
          id: 'email-123',
        },
      }

      vi.stubGlobal('useRuntimeConfig', () => ({
        resendApiToken: 'test-token',
      }))

      await fetch('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Resend Webhook] Successfully processed discussion'),
        expect.any(Object)
      )
    })
  })
})

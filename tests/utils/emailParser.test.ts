/**
 * Email Parser Tests
 *
 * Tests for parsing Figma emails sent via Mailgun
 */

import { describe, it, expect } from 'vitest'
import {
  parseEmail,
  parseFigmaEmail,
  extractFileKeyFromUrl,
  extractTextFromHtml,
  extractLinksFromHtml,
  fuzzyFindText,
  determineEmailType,
  extractFigmaMetadata,
} from '../../layers/discubot/server/utils/emailParser'

describe('emailParser', () => {
  describe('extractFileKeyFromUrl', () => {
    it('extracts file key from /file/ URL', () => {
      const url = 'https://www.figma.com/file/abc123def456/Design-File'
      expect(extractFileKeyFromUrl(url)).toBe('abc123def456')
    })

    it('extracts file key from /design/ URL', () => {
      const url = 'https://www.figma.com/design/xyz789/My-Design'
      expect(extractFileKeyFromUrl(url)).toBe('xyz789')
    })

    it('extracts file key from /proto/ URL', () => {
      const url = 'https://www.figma.com/proto/test123/Prototype'
      expect(extractFileKeyFromUrl(url)).toBe('test123')
    })

    it('returns null for invalid URL', () => {
      const url = 'https://example.com/not-figma'
      expect(extractFileKeyFromUrl(url)).toBeNull()
    })

    it('returns null for Figma URL without file key', () => {
      const url = 'https://www.figma.com/files/recent'
      expect(extractFileKeyFromUrl(url)).toBeNull()
    })
  })

  describe('extractTextFromHtml', () => {
    it('extracts text from simple HTML', () => {
      const html = '<p>Hello world</p>'
      expect(extractTextFromHtml(html)).toBe('Hello world')
    })

    it('removes script and style tags', () => {
      const html = `
        <div>
          <script>alert('test')</script>
          <style>.test { color: red; }</style>
          <p>Visible text</p>
        </div>
      `
      const result = extractTextFromHtml(html)
      expect(result).not.toContain('alert')
      expect(result).not.toContain('color: red')
      expect(result).toContain('Visible text')
    })

    it('extracts from comment-specific selectors', () => {
      const html = '<div class="comment-body">This is a comment</div>'
      expect(extractTextFromHtml(html)).toBe('This is a comment')
    })

    it('handles nested HTML structure', () => {
      const html = `
        <table>
          <tr>
            <td class="comment-text">
              <p>First paragraph</p>
              <p>Second paragraph</p>
            </td>
          </tr>
        </table>
      `
      const result = extractTextFromHtml(html)
      expect(result).toContain('First paragraph')
    })
  })

  describe('extractLinksFromHtml', () => {
    it('extracts all HTTP links', () => {
      const html = `
        <a href="https://example.com">Link 1</a>
        <a href="https://figma.com/file/abc123">Link 2</a>
      `
      const links = extractLinksFromHtml(html)
      expect(links).toHaveLength(2)
      expect(links).toContain('https://example.com')
      expect(links).toContain('https://figma.com/file/abc123')
    })

    it('filters out non-HTTP links', () => {
      const html = `
        <a href="mailto:test@example.com">Email</a>
        <a href="https://example.com">Web</a>
      `
      const links = extractLinksFromHtml(html)
      expect(links).toHaveLength(1)
      expect(links[0]).toBe('https://example.com')
    })

    it('removes duplicate links', () => {
      const html = `
        <a href="https://example.com">Link 1</a>
        <a href="https://example.com">Link 2</a>
      `
      const links = extractLinksFromHtml(html)
      expect(links).toHaveLength(1)
    })

    it('returns empty array for HTML without links', () => {
      const html = '<p>No links here</p>'
      const links = extractLinksFromHtml(html)
      expect(links).toHaveLength(0)
    })
  })

  describe('determineEmailType', () => {
    it('identifies comment emails', () => {
      expect(determineEmailType('John commented on Design', '')).toBe('comment')
      expect(determineEmailType('New comment in file', '')).toBe('comment')
      expect(determineEmailType('Jane mentioned you', '')).toBe('comment')
    })

    it('identifies invitation emails', () => {
      expect(determineEmailType('You were invited to file', '')).toBe('invitation')
      expect(determineEmailType('File shared with you', '')).toBe('invitation')
      expect(determineEmailType('Invitation to collaborate', '')).toBe('invitation')
    })

    it('returns unknown for unclear emails', () => {
      expect(determineEmailType('General notification', '')).toBe('unknown')
      expect(determineEmailType('', '')).toBe('unknown')
    })

    it('is case-insensitive', () => {
      expect(determineEmailType('JOHN COMMENTED ON DESIGN', '')).toBe('comment')
      expect(determineEmailType('You Were INVITED', '')).toBe('invitation')
    })
  })

  describe('fuzzyFindText', () => {
    it('finds exact match', () => {
      const needle = 'hello world'
      const haystack = ['goodbye', 'hello world', 'test']
      expect(fuzzyFindText(needle, haystack)).toBe('hello world')
    })

    it('finds match with different case', () => {
      const needle = 'Hello World'
      const haystack = ['goodbye', 'hello world', 'test']
      expect(fuzzyFindText(needle, haystack)).toBe('hello world')
    })

    it('finds match with extra whitespace', () => {
      const needle = 'hello   world'
      const haystack = ['goodbye', 'hello world', 'test']
      expect(fuzzyFindText(needle, haystack)).toBe('hello world')
    })

    it('finds best partial match', () => {
      const needle = 'hello world test'
      const haystack = ['goodbye', 'hello world', 'hello world testing']
      const result = fuzzyFindText(needle, haystack)
      expect(result).toBeTruthy()
    })

    it('returns null when no match above threshold', () => {
      const needle = 'completely different'
      const haystack = ['hello', 'world', 'test']
      expect(fuzzyFindText(needle, haystack)).toBeNull()
    })

    it('returns null for empty haystack', () => {
      const needle = 'test'
      const haystack: string[] = []
      expect(fuzzyFindText(needle, haystack)).toBeNull()
    })

    it('respects custom threshold', () => {
      const needle = 'hello world'
      const haystack = ['hello', 'world']
      // With high threshold, partial matches won't qualify
      expect(fuzzyFindText(needle, haystack, 0.9)).toBeNull()
      // With low threshold, partial matches will qualify
      expect(fuzzyFindText(needle, haystack, 0.4)).toBeTruthy()
    })
  })

  describe('parseEmail', () => {
    it('parses basic email data', () => {
      const emailData = {
        subject: 'Test Subject',
        from: 'test@example.com',
        'body-plain': 'This is the email body',
        timestamp: 1699999999,
      }

      const result = parseEmail(emailData)

      expect(result.text).toBe('This is the email body')
      expect(result.author).toBe('test@example.com')
      expect(result.subject).toBe('Test Subject')
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('prefers stripped-text over body-plain', () => {
      const emailData = {
        'stripped-text': 'Stripped content',
        'body-plain': 'Full content with signature',
      }

      const result = parseEmail(emailData)
      expect(result.text).toBe('Stripped content')
    })

    it('extracts text from HTML when plain text not available', () => {
      const emailData = {
        'body-html': '<p>HTML content</p>',
      }

      const result = parseEmail(emailData)
      expect(result.text).toBe('HTML content')
    })

    it('extracts file key from links in HTML', () => {
      const emailData = {
        'body-html': '<a href="https://figma.com/file/abc123/Test">View File</a>',
      }

      const result = parseEmail(emailData)
      expect(result.fileKey).toBe('abc123')
      expect(result.links).toContain('https://figma.com/file/abc123/Test')
    })

    it('handles email without timestamp', () => {
      const emailData = {
        'body-plain': 'Test',
      }

      const result = parseEmail(emailData)
      expect(result.timestamp).toBeUndefined()
    })

    it('returns empty arrays for missing data', () => {
      const emailData = {}

      const result = parseEmail(emailData)
      expect(result.text).toBe('')
      expect(result.links).toEqual([])
    })
  })

  describe('parseFigmaEmail', () => {
    it('includes Figma-specific metadata', () => {
      const emailData = {
        subject: 'John commented on Design File',
        from: 'figma@example.com',
        'body-html': `
          <p>John commented:</p>
          <p>This looks great!</p>
          <a href="https://figma.com/file/abc123def/Design">View in Figma</a>
        `,
      }

      const result = parseFigmaEmail(emailData)

      expect(result.emailType).toBe('comment')
      expect(result.fileKey).toBe('abc123def')
      expect(result.fileUrl).toBe('https://figma.com/file/abc123def/Design')
      expect(result.text).toBeTruthy()
    })

    it('identifies invitation emails', () => {
      const emailData = {
        subject: 'You were invited to collaborate',
        'body-plain': 'Click here to join',
      }

      const result = parseFigmaEmail(emailData)
      expect(result.emailType).toBe('invitation')
    })

    it('handles emails without file links', () => {
      const emailData = {
        subject: 'Notification',
        'body-plain': 'General notification',
      }

      const result = parseFigmaEmail(emailData)
      expect(result.emailType).toBe('unknown')
      expect(result.fileKey).toBeUndefined()
      expect(result.fileUrl).toBeUndefined()
    })
  })

  describe('extractFigmaMetadata', () => {
    it('extracts file URL and key from links', () => {
      const parsed = {
        text: 'Comment text',
        links: [
          'https://example.com',
          'https://figma.com/file/abc123/Design',
        ],
        author: 'test@example.com',
      }

      const metadata = extractFigmaMetadata(parsed)

      expect(metadata.fileUrl).toBe('https://figma.com/file/abc123/Design')
      expect(metadata.fileKey).toBe('abc123')
    })

    it('uses provided fileKey if no URL found', () => {
      const parsed = {
        text: 'Comment text',
        links: ['https://example.com'],
        fileKey: 'manual123',
        author: 'test@example.com',
      }

      const metadata = extractFigmaMetadata(parsed)
      expect(metadata.fileKey).toBe('manual123')
    })

    it('determines email type from subject', () => {
      const parsed = {
        text: 'Comment text',
        links: [],
        subject: 'New comment',
        author: 'test@example.com',
      }

      const metadata = extractFigmaMetadata(parsed)
      expect(metadata.emailType).toBe('comment')
    })

    it('defaults to unknown type without subject', () => {
      const parsed = {
        text: 'Comment text',
        links: [],
        author: 'test@example.com',
      }

      const metadata = extractFigmaMetadata(parsed)
      expect(metadata.emailType).toBe('unknown')
    })
  })

  describe('integration tests', () => {
    it('parses realistic Figma comment email', () => {
      const emailData = {
        subject: 'Jane Smith commented on Mobile App Design',
        from: 'jane.smith@company.com',
        recipient: 'comments-team1@example.com',
        'stripped-text': 'Can we make the button bigger?',
        'body-html': `
          <html>
            <body>
              <table>
                <tr>
                  <td class="comment-body">
                    <p><strong>Jane Smith</strong> commented:</p>
                    <p>Can we make the button bigger?</p>
                    <a href="https://www.figma.com/file/xYz789AbC/Mobile-App-Design?node-id=123">
                      View in Figma
                    </a>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
        timestamp: 1699999999,
      }

      const result = parseFigmaEmail(emailData)

      expect(result.emailType).toBe('comment')
      expect(result.text).toBe('Can we make the button bigger?')
      expect(result.author).toBe('jane.smith@company.com')
      expect(result.fileKey).toBe('xYz789AbC')
      expect(result.fileUrl).toContain('figma.com/file/xYz789AbC')
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('handles email with multiple Figma links', () => {
      const emailData = {
        subject: 'Discussion about designs',
        'body-html': `
          <p>Check these files:</p>
          <a href="https://figma.com/file/file1/Design1">Design 1</a>
          <a href="https://figma.com/file/file2/Design2">Design 2</a>
        `,
      }

      const result = parseFigmaEmail(emailData)

      // Should extract first file link
      expect(result.fileKey).toBe('file1')
      expect(result.links).toHaveLength(2)
    })
  })
})

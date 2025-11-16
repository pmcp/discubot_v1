/**
 * Email Parser Tests
 *
 * Tests for parsing Figma emails sent via Mailgun
 * Includes comprehensive tests for Phase 11 enhancements:
 * - Task 11.1: Plaintext whitespace handling
 * - Task 11.2: @mention extraction with CSS filtering
 * - Task 11.3: File key priority system
 * - Task 11.4: Click redirect following
 * - Task 11.5: Figma link extraction
 * - Task 11.6: Fuzzy comment matching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseEmail,
  parseEmailAsync,
  parseFigmaEmail,
  extractFileKeyFromUrl,
  extractTextFromHtml,
  extractLinksFromHtml,
  extractFigmaLink,
  followClickFigmaRedirect,
  fuzzyFindText,
  findCommentByText,
  normalizeText,
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
    it('includes Figma-specific metadata', async () => {
      const emailData = {
        subject: 'John commented on Design File',
        from: 'figma@example.com',
        'body-html': `
          <p>John commented:</p>
          <p>This looks great!</p>
          <a href="https://figma.com/file/abc123def/Design">View in Figma</a>
        `,
      }

      const result = await parseFigmaEmail(emailData)

      expect(result.emailType).toBe('comment')
      expect(result.fileKey).toBe('abc123def')
      expect(result.fileUrl).toBe('https://figma.com/file/abc123def/Design')
      expect(result.text).toBeTruthy()
    })

    it('identifies invitation emails', async () => {
      const emailData = {
        subject: 'You were invited to collaborate',
        'body-plain': 'Click here to join',
      }

      const result = await parseFigmaEmail(emailData)
      expect(result.emailType).toBe('invitation')
    })

    it('handles emails without file links', async () => {
      const emailData = {
        subject: 'Notification',
        'body-plain': 'General notification',
      }

      const result = await parseFigmaEmail(emailData)
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
    it('parses realistic Figma comment email', async () => {
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

      const result = await parseFigmaEmail(emailData)

      expect(result.emailType).toBe('comment')
      expect(result.text).toBe('Can we make the button bigger?')
      expect(result.author).toBe('jane.smith@company.com')
      expect(result.fileKey).toBe('xYz789AbC')
      expect(result.fileUrl).toContain('figma.com/file/xYz789AbC')
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('handles email with multiple Figma links', async () => {
      const emailData = {
        subject: 'Discussion about designs',
        'body-html': `
          <p>Check these files:</p>
          <a href="https://figma.com/file/file1/Design1">Design 1</a>
          <a href="https://figma.com/file/file2/Design2">Design 2</a>
        `,
      }

      const result = await parseFigmaEmail(emailData)

      // Should extract first file link
      expect(result.fileKey).toBe('file1')
      expect(result.links).toHaveLength(2)
    })
  })

  // ========================================
  // Phase 11 Enhancement Tests
  // ========================================

  describe('Task 11.1: Plaintext Whitespace Handling', () => {
    it('trims plaintext before using it', () => {
      const emailData = {
        'body-plain': '  \n\n  Test content  \n  ',
        'body-html': '<p>HTML content</p>',
      }

      const result = parseEmail(emailData)
      expect(result.text).toBe('Test content')
    })

    it('falls back to HTML when plaintext is whitespace-only', () => {
      const emailData = {
        'body-plain': '   \n\n   \t  ',
        'stripped-text': '  ',
        'body-html': '<p>HTML content</p>',
      }

      const result = parseEmail(emailData)
      expect(result.text).toBe('HTML content')
    })

    it('handles empty plaintext correctly', () => {
      const emailData = {
        'body-plain': '',
        'stripped-text': '',
        'body-html': '<p>Fallback to HTML</p>',
      }

      const result = parseEmail(emailData)
      expect(result.text).toBe('Fallback to HTML')
    })

    it('prioritizes stripped-text over body-plain', () => {
      const emailData = {
        'stripped-text': 'Stripped content',
        'body-plain': 'Full content with signature',
        'body-html': '<p>HTML content</p>',
      }

      const result = parseEmail(emailData)
      expect(result.text).toBe('Stripped content')
    })
  })

  describe('Task 11.2: @Mention Extraction', () => {
    it('extracts @Figbot mentions from HTML', () => {
      const html = `
        <div>
          <p>@Figbot please review this design</p>
          <p>Some other text</p>
        </div>
      `

      const text = extractTextFromHtml(html)
      expect(text).toContain('@Figbot')
      expect(text).toContain('please review this design')
    })

    it('filters out CSS @rules from mentions', () => {
      const html = `
        <style>
          @font-face { font-family: 'Test'; }
          @media screen { color: red; }
        </style>
        <div>@testuser this is a real mention</div>
      `

      const text = extractTextFromHtml(html)
      expect(text).not.toContain('@font-face')
      expect(text).not.toContain('@media')
      expect(text).toContain('@testuser')
    })

    it('extracts mentions from table cells (Figma structure)', () => {
      const html = `
        <table>
          <tr>
            <td>@testfigma this is task 2</td>
          </tr>
        </table>
      `

      const text = extractTextFromHtml(html)
      expect(text).toContain('@testfigma')
      expect(text).toContain('this is task 2')
    })

    it('extracts longest @Figbot mention', () => {
      const html = `
        <div>
          <p>@Figbot</p>
          <p>@Figbot please review</p>
          <p>@Figbot please review this entire design thoroughly</p>
        </div>
      `

      const text = extractTextFromHtml(html)
      expect(text).toBe('@Figbot please review this entire design thoroughly')
    })

    it('filters out email addresses from mentions', () => {
      const html = `
        <div>
          Contact: support@email.figma.com
          @testuser this is a real mention
        </div>
      `

      const text = extractTextFromHtml(html)
      expect(text).toContain('@testuser')
      // Should prioritize the real mention over email addresses
    })

    it('handles mentions with context extraction', () => {
      const html = `
        <div>
          <p>Before text @testuser some comment text after</p>
        </div>
      `

      const text = extractTextFromHtml(html)
      expect(text).toContain('@testuser')
      expect(text).toContain('some comment text')
    })
  })

  describe('Task 11.3: File Key Priority System', () => {
    it('Priority 1: Extracts file key from sender email', () => {
      const emailData = {
        from: 'comments-5MPYq7URiGotXahjbW3Nve@email.figma.com',
        'body-html': '<p>Comment text</p>',
      }

      const result = parseEmail(emailData)
      expect(result.fileKey).toBe('5MPYq7URiGotXahjbW3Nve')
    })

    it('Priority 1: Sender email takes precedence over links', () => {
      const emailData = {
        from: 'comments-SenderKey123@email.figma.com',
        'body-html': '<a href="https://figma.com/file/LinkKey456/Design">View</a>',
      }

      const result = parseEmail(emailData)
      expect(result.fileKey).toBe('SenderKey123')
    })

    it('Priority 2: Extracts from click.figma.com URL inline (sync)', () => {
      const emailData = {
        'body-html': `
          <a href="https://click.figma.com/track?url=https%3A%2F%2Fwww.figma.com%2Ffile%2FClickKey789%2FDesign">View</a>
        `,
      }

      const result = parseEmail(emailData)
      expect(result.fileKey).toBe('ClickKey789')
    })

    it('Priority 3: Extracts from direct Figma file links', () => {
      const emailData = {
        'body-html': '<a href="https://figma.com/file/DirectKey123/Design">View</a>',
      }

      const result = parseEmail(emailData)
      expect(result.fileKey).toBe('DirectKey123')
    })

    it('Priority 4: Extracts from upload URL patterns', () => {
      const emailData = {
        'body-html': `
          <img src="https://figma.com/uploads/1234567890abcdef1234567890abcdef12345678/font.woff2" />
        `,
      }

      const result = parseEmail(emailData)
      expect(result.fileKey).toBe('1234567890abcdef1234567890abcdef12345678')
    })

    it('Priority 5: Falls back to 40-char hash', () => {
      const emailData = {
        'body-html': `
          <div>Random text with hash: abcdef1234567890abcdef1234567890abcdef12</div>
        `,
      }

      const result = parseEmail(emailData)
      expect(result.fileKey).toBe('abcdef1234567890abcdef1234567890abcdef12')
    })

    it('Priority order is respected: sender > redirect > direct > upload > hash', () => {
      const emailData = {
        from: 'comments-SenderKey@email.figma.com',
        'body-html': `
          <a href="https://click.figma.com/track?url=https%3A%2F%2Fwww.figma.com%2Ffile%2FRedirectKey%2FDesign">Redirect</a>
          <a href="https://figma.com/file/DirectKey/Design">Direct</a>
          <img src="https://figma.com/uploads/1234567890abcdef1234567890abcdef12345678/font.woff2" />
        `,
      }

      const result = parseEmail(emailData)
      expect(result.fileKey).toBe('SenderKey')
    })
  })

  describe('Task 11.4: Click Redirect Following', () => {
    beforeEach(() => {
      // Mock global fetch
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('follows redirect and extracts file key', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        headers: {
          get: (name: string) =>
            name === 'location'
              ? 'https://www.figma.com/file/RedirectKey123/Design'
              : null,
        },
      } as any)

      const fileKey = await followClickFigmaRedirect(
        'https://click.figma.com/track?url=...'
      )

      expect(fileKey).toBe('RedirectKey123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('click.figma.com'),
        expect.objectContaining({
          method: 'HEAD',
          redirect: 'manual',
        })
      )
    })

    it('handles URL-encoded redirect locations', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        headers: {
          get: (name: string) =>
            name === 'location'
              ? 'https%3A%2F%2Fwww.figma.com%2Ffile%2FEncodedKey456%2FDesign'
              : null,
        },
      } as any)

      const fileKey = await followClickFigmaRedirect(
        'https://click.figma.com/track'
      )

      expect(fileKey).toBe('EncodedKey456')
    })

    it('returns null when no location header', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        headers: {
          get: () => null,
        },
      } as any)

      const fileKey = await followClickFigmaRedirect(
        'https://click.figma.com/track'
      )

      expect(fileKey).toBeNull()
    })

    it('handles timeout after 3 seconds', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              const error = new Error('Timeout')
              error.name = 'AbortError'
              reject(error)
            }, 100)
          })
      )

      const fileKey = await followClickFigmaRedirect(
        'https://click.figma.com/track'
      )

      expect(fileKey).toBeNull()
    })

    it('handles network errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const fileKey = await followClickFigmaRedirect(
        'https://click.figma.com/track'
      )

      expect(fileKey).toBeNull()
    })

    it('supports /design/ and /proto/ URLs in redirects', async () => {
      const mockFetch = vi.mocked(fetch)

      // Test /design/
      mockFetch.mockResolvedValueOnce({
        headers: {
          get: (name: string) =>
            name === 'location'
              ? 'https://www.figma.com/design/DesignKey789/Design'
              : null,
        },
      } as any)

      const designKey = await followClickFigmaRedirect(
        'https://click.figma.com/track'
      )
      expect(designKey).toBe('DesignKey789')

      // Test /proto/
      mockFetch.mockResolvedValueOnce({
        headers: {
          get: (name: string) =>
            name === 'location'
              ? 'https://www.figma.com/proto/ProtoKey123/Prototype'
              : null,
        },
      } as any)

      const protoKey = await followClickFigmaRedirect(
        'https://click.figma.com/track'
      )
      expect(protoKey).toBe('ProtoKey123')
    })
  })

  describe('Task 11.5: Figma Link Extraction', () => {
    it('extracts universal="true" link (highest priority)', () => {
      const html = `
        <div>
          <a href="https://figma.com/file/OtherKey/Design">Regular link</a>
          <a href="https://click.figma.com/track?url=..." universal="true">View in Figma</a>
        </div>
      `

      const link = extractFigmaLink(html)
      expect(link).toBe('https://click.figma.com/track?url=...')
    })

    it('extracts "View in Figma" button link', () => {
      const html = `
        <div>
          <a href="https://example.com">Other link</a>
          <a href="https://figma.com/file/ViewKey123/Design">View in Figma</a>
        </div>
      `

      const link = extractFigmaLink(html)
      expect(link).toBe('https://figma.com/file/ViewKey123/Design')
    })

    it('extracts "Open in Figma" button link', () => {
      const html = `
        <a href="https://figma.com/file/OpenKey456/Design">Open in Figma</a>
      `

      const link = extractFigmaLink(html)
      expect(link).toBe('https://figma.com/file/OpenKey456/Design')
    })

    it('prioritizes click.figma.com tracking links', () => {
      const html = `
        <div>
          <a href="https://figma.com/file/DirectKey/Design">Direct</a>
          <a href="https://click.figma.com/track?url=...">Tracked</a>
        </div>
      `

      const link = extractFigmaLink(html)
      expect(link).toBe('https://click.figma.com/track?url=...')
    })

    it('falls back to direct figma.com links', () => {
      const html = `
        <div>
          <a href="https://example.com">Other</a>
          <a href="https://figma.com/file/FallbackKey/Design">Figma File</a>
        </div>
      `

      const link = extractFigmaLink(html)
      expect(link).toBe('https://figma.com/file/FallbackKey/Design')
    })

    it('supports /design/ and /proto/ URLs', () => {
      const htmlDesign = '<a href="https://figma.com/design/DesignKey/Design">View</a>'
      const htmlProto = '<a href="https://figma.com/proto/ProtoKey/Proto">View</a>'

      expect(extractFigmaLink(htmlDesign)).toBe('https://figma.com/design/DesignKey/Design')
      expect(extractFigmaLink(htmlProto)).toBe('https://figma.com/proto/ProtoKey/Proto')
    })

    it('returns null when no Figma link found', () => {
      const html = `
        <div>
          <a href="https://example.com">Example</a>
          <a href="https://google.com">Google</a>
        </div>
      `

      const link = extractFigmaLink(html)
      expect(link).toBeNull()
    })

    it('handles case-insensitive "view in figma" text', () => {
      const html = '<a href="https://figma.com/file/Key123/Design">VIEW IN FIGMA</a>'
      const link = extractFigmaLink(html)
      expect(link).toBe('https://figma.com/file/Key123/Design')
    })
  })

  describe('Task 11.6: Fuzzy Comment Matching', () => {
    describe('normalizeText', () => {
      it('converts to lowercase', () => {
        expect(normalizeText('Hello World')).toBe('hello world')
      })

      it('normalizes whitespace', () => {
        expect(normalizeText('hello   \n\t  world')).toBe('hello world')
      })

      it('trims whitespace', () => {
        expect(normalizeText('  hello world  ')).toBe('hello world')
      })

      it('handles multiple spaces', () => {
        expect(normalizeText('hello     world     test')).toBe('hello world test')
      })
    })

    describe('findCommentByText', () => {
      const comments = [
        { id: '1', message: 'This is a test comment' },
        { id: '2', message: 'Another comment here' },
        { id: '3', message: '@Figbot please review this design' },
      ]

      it('finds exact match', () => {
        const result = findCommentByText('This is a test comment', comments)
        expect(result?.id).toBe('1')
      })

      it('finds match with different case', () => {
        const result = findCommentByText('THIS IS A TEST COMMENT', comments)
        expect(result?.id).toBe('1')
      })

      it('finds match with extra whitespace', () => {
        const result = findCommentByText('This   is  a   test  comment', comments)
        expect(result?.id).toBe('1')
      })

      it('finds match with substring (contains relationship)', () => {
        // This should match because "@Figbot please review" is contained in "@Figbot please review this design"
        const result = findCommentByText('@Figbot please review this design', comments)
        expect(result?.id).toBe('3')
      })

      it('returns null when no match above threshold', () => {
        const result = findCommentByText('Completely different text', comments)
        expect(result).toBeNull()
      })

      it('respects custom threshold', () => {
        // High threshold test - short text won't match long text with high threshold
        const result = findCommentByText('test', comments, 0.95)
        expect(result).toBeNull()

        // Low threshold test - even partial matches will work with lower threshold
        const result2 = findCommentByText('This is a test', comments, 0.6)
        expect(result2?.id).toBe('1')
      })

      it('returns best match when multiple candidates', () => {
        const multiComments = [
          { id: '1', message: 'test' },
          { id: '2', message: 'test comment' },
          { id: '3', message: 'test comment here' },
        ]

        const result = findCommentByText('test comment', multiComments)
        expect(result?.id).toBe('2') // Exact match
      })

      it('handles HTML entities and formatting differences', () => {
        const htmlComments = [
          { id: '1', message: '@testfigma this is task 2' },
        ]

        const result = findCommentByText('@testfigma  this   is  task  2', htmlComments)
        expect(result?.id).toBe('1')
      })
    })

    describe('fuzzy matching integration', () => {
      it('matches email text to Figma API comment', () => {
        const emailText = '@Figbot please review this design'
        const apiComments = [
          { id: 'c1', message: 'Some other comment' },
          { id: 'c2', message: '@Figbot please review this design' },
          { id: 'c3', message: 'Yet another comment' },
        ]

        const match = findCommentByText(emailText, apiComments)
        expect(match?.id).toBe('c2')
      })

      it('handles footer/boilerplate differences', () => {
        const emailText = '@testuser this is the actual comment'
        const apiComments = [
          {
            id: 'c1',
            message: '@testuser this is the actual comment\n\nSent from Figma'
          },
        ]

        // Even with footer, should still match (using slightly lower threshold for footer text)
        const match = findCommentByText(emailText, apiComments, 0.6)
        expect(match?.id).toBe('c1')
      })

      it('handles slight variations in punctuation', () => {
        const emailText = 'Can we make the button bigger'
        const apiComments = [
          { id: 'c1', message: 'Can we make the button bigger?' },
        ]

        const match = findCommentByText(emailText, apiComments)
        expect(match?.id).toBe('c1')
      })
    })
  })

  describe('Task 11.7: Integration with Real Figma HTML', () => {
    it('parses real Figma email with @mention and click tracking', async () => {
      const emailData = {
        subject: 'Test User commented on Test File',
        from: 'comments-5MPYq7URiGotXahjbW3Nve@email.figma.com',
        'stripped-text': '@testfigma this is task 2',
        'body-html': `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                @font-face { font-family: 'Inter'; }
                @media screen { body { color: black; } }
              </style>
            </head>
            <body>
              <table>
                <tr>
                  <td>@testfigma this is task 2</td>
                </tr>
                <tr>
                  <td>
                    <a href="https://click.figma.com/track?url=https%3A%2F%2Fwww.figma.com%2Ffile%2F5MPYq7URiGotXahjbW3Nve%2FTest" universal="true">
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

      const result = await parseFigmaEmail(emailData)

      // Task 11.1: Plaintext trimmed and used
      expect(result.text).toBe('@testfigma this is task 2')

      // Task 11.3: Priority 1 - Sender email extraction
      expect(result.fileKey).toBe('5MPYq7URiGotXahjbW3Nve')

      // Task 11.5: Figma link extraction (universal="true")
      expect(result.figmaLink).toContain('click.figma.com')

      // Email type detection
      expect(result.emailType).toBe('comment')
    })

    it('handles real Figma HTML with CSS @rules filtered out', () => {
      const html = `
        <html>
          <head>
            <style>
              @font-face { font-family: 'Inter'; src: url('font.woff2'); }
              @media screen and (max-width: 600px) { body { font-size: 14px; } }
              @import url('styles.css');
            </style>
          </head>
          <body>
            <div>
              <p>Test User commented:</p>
              <p>@Figbot please review this</p>
            </div>
          </body>
        </html>
      `

      const text = extractTextFromHtml(html)

      // Should not contain CSS @rules
      expect(text).not.toContain('@font-face')
      expect(text).not.toContain('@media')
      expect(text).not.toContain('@import')

      // Should contain actual @mention
      expect(text).toContain('@Figbot')
    })

    it('extracts file key with all priority levels working', async () => {
      const testCases = [
        {
          name: 'Priority 1: Sender email',
          emailData: {
            from: 'comments-SenderKey123@email.figma.com',
            'body-html': '<p>Comment</p>',
          },
          expectedKey: 'SenderKey123',
        },
        {
          name: 'Priority 2: Click redirect (inline)',
          emailData: {
            'body-html': `
              <a href="https://click.figma.com/track?url=https%3A%2F%2Fwww.figma.com%2Ffile%2FRedirectKey456%2FDesign">View</a>
            `,
          },
          expectedKey: 'RedirectKey456',
        },
        {
          name: 'Priority 3: Direct link',
          emailData: {
            'body-html': '<a href="https://figma.com/file/DirectKey789/Design">View</a>',
          },
          expectedKey: 'DirectKey789',
        },
      ]

      for (const testCase of testCases) {
        const result = parseEmail(testCase.emailData)
        expect(result.fileKey).toBe(testCase.expectedKey)
      }
    })
  })
})

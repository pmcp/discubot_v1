/**
 * Email Parser Utility
 *
 * Parses HTML emails from Figma (via Mailgun) to extract:
 * - Comment text content
 * - File keys
 * - Author information
 * - Links and metadata
 *
 * Uses fuzzy text matching to handle HTML formatting variations.
 */

import * as cheerio from 'cheerio'

export interface ParsedEmail {
  /** Plain text content of the comment */
  text: string
  /** HTML content of the comment (if available) */
  html?: string
  /** Figma file key extracted from links or sender */
  fileKey?: string
  /** Author name/email */
  author?: string
  /** All extracted links */
  links: string[]
  /** Subject line */
  subject?: string
  /** Timestamp from email headers */
  timestamp?: Date
}

export interface FigmaEmailMetadata {
  /** Figma file URL */
  fileUrl?: string
  /** Comment ID (if determinable) */
  commentId?: string
  /** File name */
  fileName?: string
  /** Whether this is a comment or invitation email */
  emailType: 'comment' | 'invitation' | 'unknown'
}

/**
 * Extract Figma file key from a URL
 *
 * Examples:
 * - https://www.figma.com/file/abc123def456/Design-File → abc123def456
 * - https://www.figma.com/design/abc123def456/... → abc123def456
 */
export function extractFileKeyFromUrl(url: string): string | null {
  const patterns = [
    /figma\.com\/file\/([a-zA-Z0-9]+)/,
    /figma\.com\/design\/([a-zA-Z0-9]+)/,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

/**
 * Parse HTML email body to extract plain text content
 * Handles various HTML structures that Figma might use
 */
export function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html)

  // Remove script and style elements
  $('script, style').remove()

  // Try to find the main comment content
  // Figma emails typically have the comment in specific elements
  const commentSelectors = [
    '.comment-body',
    '.comment-text',
    'td[class*="comment"]',
    'p',
  ]

  for (const selector of commentSelectors) {
    const element = $(selector).first()
    if (element.length && element.text().trim()) {
      return element.text().trim()
    }
  }

  // Fallback: get all text content
  return $('body').text().trim()
}

/**
 * Extract all links from HTML email
 */
export function extractLinksFromHtml(html: string): string[] {
  const $ = cheerio.load(html)
  const links: string[] = []

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (href && href.startsWith('http')) {
      links.push(href)
    }
  })

  return [...new Set(links)] // Remove duplicates
}

/**
 * Determine email type based on content and links
 */
export function determineEmailType(subject: string, html: string): FigmaEmailMetadata['emailType'] {
  const subjectLower = subject.toLowerCase()

  if (
    subjectLower.includes('commented') ||
    subjectLower.includes('comment') ||
    subjectLower.includes('mentioned you')
  ) {
    return 'comment'
  }

  if (
    subjectLower.includes('invited') ||
    subjectLower.includes('invitation') ||
    subjectLower.includes('shared')
  ) {
    return 'invitation'
  }

  return 'unknown'
}

/**
 * Extract Figma-specific metadata from email
 */
export function extractFigmaMetadata(parsed: ParsedEmail): FigmaEmailMetadata {
  const figmaLinks = parsed.links.filter(link => link.includes('figma.com'))

  const fileUrl = figmaLinks.find(
    link =>
      link.includes('/file/') ||
      link.includes('/design/') ||
      link.includes('/proto/')
  )

  const fileKey = fileUrl ? extractFileKeyFromUrl(fileUrl) : parsed.fileKey

  const emailType = parsed.subject
    ? determineEmailType(parsed.subject, parsed.html || '')
    : 'unknown'

  return {
    fileUrl,
    fileKey: fileKey || undefined,
    emailType,
  }
}

/**
 * Fuzzy text matching - find best match for comment text in Figma API responses
 * Used when matching email content to actual Figma comments
 *
 * @param needle - Text to search for (from email)
 * @param haystack - Array of possible matches (from Figma API)
 * @param threshold - Minimum similarity score (0-1)
 * @returns Best matching text or null
 */
export function fuzzyFindText(
  needle: string,
  haystack: string[],
  threshold = 0.8
): string | null {
  const normalizedNeedle = needle
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  let bestMatch: string | null = null
  let bestScore = 0

  for (const candidate of haystack) {
    const normalizedCandidate = candidate
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()

    // Calculate similarity score (simple approach)
    const score = calculateSimilarity(normalizedNeedle, normalizedCandidate)

    if (score > bestScore && score >= threshold) {
      bestScore = score
      bestMatch = candidate
    }
  }

  return bestMatch
}

/**
 * Calculate text similarity using Levenshtein distance
 * Returns a score between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Handle exact matches
  if (str1 === str2) return 1

  // Handle contains relationship
  if (str1.includes(str2) || str2.includes(str1)) {
    const longerLength = Math.max(str1.length, str2.length)
    const shorterLength = Math.min(str1.length, str2.length)
    return shorterLength / longerLength
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(str1, str2)
  const maxLength = Math.max(str1.length, str2.length)

  return 1 - distance / maxLength
}

/**
 * Calculate Levenshtein distance between two strings
 * (Minimum number of single-character edits needed to change one string into the other)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Main email parsing function
 *
 * @param emailData - Raw email data from Mailgun webhook
 * @returns Parsed email with extracted information
 */
export function parseEmail(emailData: {
  subject?: string
  from?: string
  'body-html'?: string
  'body-plain'?: string
  'stripped-text'?: string
  timestamp?: number
  recipient?: string
}): ParsedEmail {
  const html = emailData['body-html'] || ''
  const plainText = emailData['stripped-text'] || emailData['body-plain'] || ''

  // Extract text content
  const text = plainText || (html ? extractTextFromHtml(html) : '')

  // Extract links
  const links = html ? extractLinksFromHtml(html) : []

  // Try to extract file key from links
  let fileKey: string | undefined
  for (const link of links) {
    const extracted = extractFileKeyFromUrl(link)
    if (extracted) {
      fileKey = extracted
      break
    }
  }

  // Parse timestamp
  const timestamp = emailData.timestamp
    ? new Date(emailData.timestamp * 1000)
    : undefined

  return {
    text,
    html: html || undefined,
    fileKey,
    author: emailData.from,
    links,
    subject: emailData.subject,
    timestamp,
  }
}

/**
 * Full email parsing with Figma-specific metadata extraction
 */
export function parseFigmaEmail(emailData: {
  subject?: string
  from?: string
  'body-html'?: string
  'body-plain'?: string
  'stripped-text'?: string
  timestamp?: number
  recipient?: string
}): ParsedEmail & FigmaEmailMetadata {
  const parsed = parseEmail(emailData)
  const metadata = extractFigmaMetadata(parsed)

  return {
    ...parsed,
    ...metadata,
  }
}

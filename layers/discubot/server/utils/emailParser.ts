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
 * - https://api-cdn.figma.com/resize/images/2265042955578165560/... → 2265042955578165560
 */
export function extractFileKeyFromUrl(url: string): string | null {
  const patterns = [
    // Direct Figma file URLs
    /figma\.com\/file\/([a-zA-Z0-9]+)/,
    /figma\.com\/design\/([a-zA-Z0-9]+)/,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/,
    // Figma CDN image URLs (contains file ID)
    /api-cdn\.figma\.com\/resize\/images\/(\d+)\//,
    // FigJam files
    /figma\.com\/board\/([a-zA-Z0-9]+)/,
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
 * Extract @Figbot mentions from HTML with context
 * Priority 1: These are the most reliable indicators of actual comment text
 */
function extractFigbotMentions(html: string): string[] {
  const figbotPattern = /@[Ff]igbot(?:\s+[^<>@]*)?/gi
  const matches = html.match(figbotPattern) || []

  // Sort by length to get the most complete comment (not just "@Figbot" but "@Figbot some text")
  return matches.sort((a, b) => b.length - a.length)
}

/**
 * Filter out CSS @rules from mention arrays
 * CSS rules like @font-face, @media, @import are not user mentions
 */
function filterCSSRules(mentions: string[]): string[] {
  return mentions.filter(mention => {
    const mentionLower = mention.toLowerCase()
    return !mentionLower.startsWith('@font-face') &&
           !mentionLower.startsWith('@media') &&
           !mentionLower.startsWith('@import') &&
           !mentionLower.startsWith('@keyframes') &&
           !mentionLower.startsWith('@charset') &&
           !mentionLower.startsWith('@supports') &&
           !mention.includes('@mentions') && // Filter out footer text
           !mention.includes('@email') &&    // Filter out email addresses
           !mention.includes('@mail')
  })
}

/**
 * Extract mentions from table cells (Figma's common HTML structure)
 * Figma emails usually put the comment in a specific table cell
 */
function extractTableCellMentions(html: string): { text: string; mention: string } | null {
  const tdPattern = /<td[^>]*>([^<]*@[A-Za-z0-9_]+[^<]*)<\/td>/gi
  const tdMatches = Array.from(html.matchAll(tdPattern))

  for (const tdMatch of tdMatches) {
    const cellContent = tdMatch[1]
      .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim()

    // Check if this cell contains a mention and isn't just navigation/UI text
    if (
      cellContent.includes('@') &&
      !cellContent.toLowerCase().includes('mobile app') &&
      !cellContent.toLowerCase().includes('stay on top') &&
      !cellContent.includes('unsubscribe') &&
      !cellContent.includes('privacy') &&
      !cellContent.includes('View in Figma') &&
      cellContent.length < 500 // Comments are usually not super long
    ) {
      // Extract the mention from the cell content
      const cellMentionMatch = cellContent.match(/@[A-Za-z0-9_]+/)
      if (cellMentionMatch) {
        return {
          text: cellContent,
          mention: cellMentionMatch[0].replace('@', '').trim()
        }
      }
    }
  }

  return null
}

/**
 * Extract mention with surrounding context (100 chars before/after)
 * Used when mentions are found but need more context
 */
function extractMentionWithContext(html: string, mention: string): string | null {
  // Look for the mention with surrounding text (up to 100 chars before/after)
  const escapedMention = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const contextPattern = new RegExp(`(.{0,100})(${escapedMention})(.{0,100})`, 'i')
  const contextMatch = html.match(contextPattern)

  if (contextMatch) {
    // Clean up the extracted text
    const fullText = (contextMatch[1] + contextMatch[2] + contextMatch[3])
      .replace(/<[^>]*>/g, ' ')    // Remove HTML tags
      .replace(/&[a-z]+;/gi, ' ')  // Remove HTML entities
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim()

    // If this looks like actual comment content (not CSS or navigation)
    if (
      fullText.length > 5 &&
      fullText.length < 500 &&
      !fullText.includes('font-family') &&
      !fullText.includes('font-size') &&
      !fullText.includes('padding') &&
      !fullText.includes('margin') &&
      !fullText.includes('unsubscribe') &&
      !fullText.includes('Figma, Inc') &&
      !fullText.includes('View in Figma') &&
      !fullText.includes('commented on')
    ) {
      return fullText
    }
  }

  return null
}

/**
 * Parse HTML email body to extract plain text content
 * Handles various HTML structures that Figma might use (Mailgun, Resend, etc.)
 *
 * Priority system:
 * 1. @Figbot mentions (most reliable)
 * 2. Table cell mentions (Figma's common structure)
 * 3. Other @mentions with context
 * 4. Cheerio selector-based extraction
 * 5. Substantial lines fallback
 */
export function extractTextFromHtml(html: string): string {
  // Priority 1: Look for @Figbot mentions
  const figbotMentions = extractFigbotMentions(html)

  if (figbotMentions.length > 0) {
    // Use the longest @Figbot mention (most complete comment)
    for (const mention of figbotMentions) {
      if (mention.length > 7) { // More than just "@Figbot"
        console.log('[EmailParser] Found @Figbot comment:', mention.trim())
        return mention.trim()
      }
    }

    // If we only found bare "@Figbot" mentions, use the first one
    if (figbotMentions.length > 0) {
      console.log('[EmailParser] Found bare @Figbot mention:', figbotMentions[0].trim())
      return figbotMentions[0].trim()
    }
  }

  // Priority 2: Look for mentions in table cells (Figma's structure)
  const tableCellResult = extractTableCellMentions(html)
  if (tableCellResult) {
    console.log('[EmailParser] Found comment in table cell:', tableCellResult.text)
    return tableCellResult.text
  }

  // Priority 3: Look for other @mentions with context
  const mentionPattern = /@[A-Za-z0-9_]+(?:\s+[^<>@]*)?/gi
  let allMentions = html.match(mentionPattern) || []

  // Filter out CSS rules and email addresses
  allMentions = filterCSSRules(allMentions)

  if (allMentions.length > 0) {
    console.log('[EmailParser] Found non-CSS mentions:', allMentions.length)

    // Try to extract each mention with context
    for (const mention of allMentions) {
      const contextText = extractMentionWithContext(html, mention)
      if (contextText) {
        console.log('[EmailParser] Extracted mention with context:', contextText)
        return contextText
      }
    }

    // Fallback: Use the first valid mention
    for (const mention of allMentions) {
      if (mention.length > 2) { // More than just "@"
        console.log('[EmailParser] Using mention as fallback:', mention.trim())
        return mention.trim()
      }
    }
  }

  // Priority 4: Use Cheerio for selector-based extraction
  const $ = cheerio.load(html)

  // Remove script, style, and other non-content elements
  $('script, style, head').remove()

  // Try to find the main comment content
  // Figma emails typically have the comment in specific elements
  const commentSelectors = [
    '.comment-body',
    '.comment-text',
    'td[class*="comment"]',
    // Resend-specific selectors
    'div[style*="color"]',  // Figma uses styled divs for comment text
    'td[style*="padding"]', // Comment content is often in padded table cells
    'p',
  ]

  for (const selector of commentSelectors) {
    const element = $(selector).first()
    if (element.length) {
      const text = element.text().trim()
      // Make sure we got substantial text (more than just whitespace)
      if (text.length > 5) {
        console.log('[EmailParser] Found comment text using selector:', selector)
        return text
      }
    }
  }

  // Fallback 1: Look for any substantial text blocks in the email
  // Get all text content and try to find the actual comment
  const bodyText = $('body').text()
  const lines = bodyText.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  // The comment text is usually one of the longer lines that isn't a URL or boilerplate
  const substantialLines = lines.filter(line =>
    line.length > 10 &&
    !line.startsWith('http') &&
    !line.includes('@') &&
    !line.toLowerCase().includes('unsubscribe') &&
    !line.toLowerCase().includes('figma')
  )

  if (substantialLines.length > 0) {
    // Return the first substantial line (likely the comment text)
    const commentText = substantialLines[0]
    console.log('[EmailParser] Found comment text from substantial lines')
    return commentText
  }

  // Fallback 2: get all text content
  const allText = $('body').text().trim()
  console.log('[EmailParser] Using full body text as fallback')
  return allText
}

/**
 * Extract all links from HTML email (both href and src attributes)
 * Prioritizes links with comment indicators
 */
export function extractLinksFromHtml(html: string): string[] {
  const $ = cheerio.load(html)
  const links: string[] = []
  const priorityLinks: string[] = []

  // Extract from <a href="...">
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (href && href.startsWith('http')) {
      links.push(href)
    }
  })

  // Extract from <img src="..."> (Figma CDN URLs contain file IDs)
  // Prioritize images with comment coordinates (commentx, commenty parameters)
  $('img[src]').each((_, element) => {
    const src = $(element).attr('src')
    if (src && src.startsWith('http') && src.includes('figma.com')) {
      // Images with commentx/commenty are the actual comment location images
      if (src.includes('commentx=') && src.includes('commenty=')) {
        priorityLinks.push(src)
      } else {
        links.push(src)
      }
    }
  })

  // Return priority links first, then regular links
  return [...new Set([...priorityLinks, ...links])] // Remove duplicates, priority first
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

  console.log('[EmailParser] Parsing email', {
    hasHtml: !!html,
    hasPlainText: !!plainText,
    htmlLength: html.length,
    plainTextLength: plainText.length,
    plainTextPreview: plainText.substring(0, 200),
  })

  // Extract text content
  const trimmedPlainText = plainText?.trim() || ''
  const text = trimmedPlainText || (html ? extractTextFromHtml(html) : '')

  console.log('[EmailParser] Extracted text', {
    textLength: text.length,
    textPreview: text.substring(0, 200),
  })

  // Extract links
  const links = html ? extractLinksFromHtml(html) : []

  // Try to extract file key from sender email address FIRST (most reliable!)
  // Format: comments-[FILEKEY]@email.figma.com
  let fileKey: string | undefined
  if (emailData.from) {
    const emailKeyMatch = emailData.from.match(/comments-([a-zA-Z0-9]+)@/i)
    if (emailKeyMatch) {
      fileKey = emailKeyMatch[1]
      console.log('[EmailParser] Extracted file key from sender email:', fileKey)
    }
  }

  // Fallback: Try to extract file key from links
  if (!fileKey) {
    for (const link of links) {
      const extracted = extractFileKeyFromUrl(link)
      if (extracted) {
        fileKey = extracted
        console.log('[EmailParser] Extracted file key from link:', fileKey)
        break
      }
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

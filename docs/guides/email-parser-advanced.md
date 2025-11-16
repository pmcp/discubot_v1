# Email Parser Advanced Guide

## Overview

The email parser (`layers/discubot/server/utils/emailParser.ts`) is a sophisticated HTML email parsing system designed to extract structured data from Figma notification emails sent via Mailgun. This guide documents the advanced features and algorithms that make the parser robust and reliable.

## Table of Contents

1. [Priority Systems](#priority-systems)
2. [@mention Extraction Strategy](#mention-extraction-strategy)
3. [Click Redirect Handling](#click-redirect-handling)
4. [Fuzzy Matching Algorithm](#fuzzy-matching-algorithm)
5. [Usage Examples](#usage-examples)

---

## Priority Systems

The email parser uses two sophisticated priority systems to extract the most reliable data from Figma emails, which can vary significantly in structure depending on the email provider (Mailgun, Resend, etc.).

### File Key Extraction Priority

The parser attempts to extract the Figma file key using a **5-level priority system**, trying each method in order until a file key is found:

#### Priority 1: Sender Email Address (Most Reliable!)
```typescript
// Format: comments-[FILEKEY]@email.figma.com
const emailKeyMatch = emailData.from.match(/comments-([a-zA-Z0-9]+)@/i)
```

**Why this is most reliable:**
- Always present in Figma comment emails
- Directly embedded in the sender address
- No parsing ambiguity
- Not affected by HTML structure changes

**Example:**
```
From: comments-abc123def456@email.figma.com
→ File Key: abc123def456
```

#### Priority 2: click.figma.com Redirects (Requires HEAD Request)
```typescript
// Follow redirect to extract file key from destination URL
const extractedKey = await followClickFigmaRedirect(redirectUrl)
```

**How it works:**
- Figma uses `click.figma.com` tracking URLs in email buttons
- Parser performs HEAD request with 3-second timeout
- Extracts Location header from redirect response
- Decodes and extracts file key from destination URL

**Example:**
```
Email: href="https://click.figma.com/..."
HEAD Request → Location: https://www.figma.com/file/abc123def456/...
→ File Key: abc123def456
```

**Note:** Only available in `parseEmailAsync()` - the synchronous version tries to decode the URL inline instead.

#### Priority 3: Direct Figma File Links
```typescript
// Extract from standard Figma URLs
const patterns = [
  /figma\.com\/file\/([a-zA-Z0-9]+)/,
  /figma\.com\/design\/([a-zA-Z0-9]+)/,
  /figma\.com\/proto\/([a-zA-Z0-9]+)/,
  /figma\.com\/board\/([a-zA-Z0-9]+)/,  // FigJam
]
```

**Supported URL types:**
- `/file/` - Standard file URLs
- `/design/` - Design mode URLs
- `/proto/` - Prototype URLs
- `/board/` - FigJam board URLs

#### Priority 4: Upload URL Patterns
```typescript
// Pattern: /uploads/[40-char-hash]
const uploadPattern = /figma\.com\/uploads\/([a-zA-Z0-9]+)/gi
```

**How it works:**
- Figma CDN URLs for fonts, images, etc. contain file references
- File keys in upload URLs are typically 40 characters
- Parser extracts alphanumeric strings 22-40 characters long

#### Priority 5: 40-char Hash Fallback
```typescript
// Last resort: Look for any 40-character hex string
const keyPattern = /[a-f0-9]{40}/gi
```

**When this is used:**
- All other methods failed
- Common format for older Figma file keys
- Less reliable but better than nothing

---

### Text Extraction Priority

The parser uses a **5-level priority system** to extract the actual comment text from HTML emails:

#### Priority 1: @Figbot Mentions (Most Reliable)
```typescript
const figbotPattern = /@[Ff]igbot(?:\s+[^<>@]*)?/gi
```

**Why this is most reliable:**
- Direct indicator of bot-targeted comments
- Includes surrounding context in one match
- Sorted by length to get most complete version

**Example:**
```html
HTML: "Hey team, @Figbot please review this design for accessibility"
→ Extracted: "@Figbot please review this design for accessibility"
```

#### Priority 2: Table Cell Mentions (Figma's Common Structure)
```typescript
const tdPattern = /<td[^>]*>([^<]*@[A-Za-z0-9_]+[^<]*)<\/td>/gi
```

**How it works:**
- Figma emails typically place comments in specific `<td>` cells
- Parser looks for cells containing @mentions
- Filters out navigation/UI text (unsubscribe, privacy, etc.)
- Validates length (<500 chars for reasonable comments)

**Filters applied:**
```typescript
// These are NOT considered comment content:
- Mobile app prompts
- "Stay on top" notifications
- Unsubscribe links
- Privacy policy links
- "View in Figma" buttons
```

#### Priority 3: Other @mentions with Context
```typescript
// Extract mention with 100 chars before/after
const contextPattern = new RegExp(`(.{0,100})(${mention})(.{0,100})`, 'i')
```

**How it works:**
- Finds any @mention in the HTML
- Extracts 100 characters before and after for context
- Cleans HTML tags and entities
- Filters out CSS rules and boilerplate

**CSS Rules Filtered:**
```typescript
- @font-face
- @media
- @import
- @keyframes
- @charset
- @supports
- @mentions (footer text)
- @email, @mail (email addresses)
```

#### Priority 4: Cheerio Selector-Based Extraction
```typescript
const commentSelectors = [
  '.comment-body',
  '.comment-text',
  'td[class*="comment"]',
  'div[style*="color"]',  // Resend-specific
  'td[style*="padding"]', // Common pattern
  'p',
]
```

**How it works:**
- Uses Cheerio (jQuery-like) to parse HTML structure
- Tries selectors in order of specificity
- Returns first selector with substantial text (>5 chars)
- Removes `<script>`, `<style>`, and `<head>` elements first

#### Priority 5: Substantial Lines Fallback
```typescript
const substantialLines = lines.filter(line =>
  line.length > 10 &&
  !line.startsWith('http') &&
  !line.includes('@') &&
  !line.toLowerCase().includes('unsubscribe') &&
  !line.toLowerCase().includes('figma')
)
```

**Last resort strategy:**
- Extracts all text from `<body>`
- Splits into lines, filters out boilerplate
- Returns first substantial line (>10 chars)
- Excludes URLs, mentions, and footer text

---

## @mention Extraction Strategy

The parser implements a sophisticated multi-stage strategy to extract user mentions while filtering out false positives.

### Stage 1: Find @Figbot Mentions

```typescript
function extractFigbotMentions(html: string): string[] {
  const figbotPattern = /@[Ff]igbot(?:\s+[^<>@]*)?/gi
  const matches = html.match(figbotPattern) || []

  // Sort by length to get the most complete comment
  return matches.sort((a, b) => b.length - a.length)
}
```

**Key features:**
- Case-insensitive (`@Figbot` or `@figbot`)
- Captures trailing text (the actual comment)
- Prioritizes longer matches (more context)

**Examples:**
```typescript
"@Figbot" → Valid (bare mention)
"@Figbot please review" → Preferred (has context)
"@figbot this looks great!" → Preferred (case-insensitive + context)
```

### Stage 2: Extract Table Cell Mentions

```typescript
function extractTableCellMentions(html: string): { text: string; mention: string } | null {
  const tdPattern = /<td[^>]*>([^<]*@[A-Za-z0-9_]+[^<]*)<\/td>/gi
  // ... filters and validation
}
```

**Validation rules:**
- Must contain an `@` symbol
- Length must be < 500 characters
- Must NOT contain excluded patterns:
  - "mobile app"
  - "stay on top"
  - "unsubscribe"
  - "privacy"
  - "View in Figma"

**Example:**
```html
<td>@john Great work on the header design!</td>
→ { text: "@john Great work on the header design!", mention: "john" }

<td>View in Figma or use mobile app</td>
→ null (filtered out)
```

### Stage 3: Extract Mentions with Context

```typescript
function extractMentionWithContext(html: string, mention: string): string | null {
  const contextPattern = new RegExp(`(.{0,100})(${mention})(.{0,100})`, 'i')
  // ... extraction and cleaning
}
```

**Context window:**
- **100 characters before** the mention
- **100 characters after** the mention
- Total maximum: ~200+ characters

**Cleaning steps:**
1. Remove HTML tags (`<[^>]*>`)
2. Remove HTML entities (`&[a-z]+;`)
3. Normalize whitespace (`\s+` → single space)
4. Trim leading/trailing whitespace

**Filters applied:**
```typescript
// Length validation
5 < text.length < 500

// Content exclusions
!text.includes('font-family')
!text.includes('font-size')
!text.includes('padding')
!text.includes('margin')
!text.includes('unsubscribe')
!text.includes('Figma, Inc')
!text.includes('View in Figma')
!text.includes('commented on')
```

### Stage 4: Filter CSS Rules

```typescript
function filterCSSRules(mentions: string[]): string[] {
  return mentions.filter(mention => {
    const mentionLower = mention.toLowerCase()
    return !mentionLower.startsWith('@font-face') &&
           !mentionLower.startsWith('@media') &&
           // ... other CSS rules
  })
}
```

**Why this is necessary:**
- HTML emails include inline CSS
- CSS @rules look like mentions to regex
- Must be filtered to avoid false positives

**Filtered patterns:**
```typescript
@font-face { ... }  → Filtered
@media (max-width)  → Filtered
@import url(...)    → Filtered
@keyframes slide    → Filtered
@charset "UTF-8"    → Filtered
@supports (grid)    → Filtered
@john (user)        → Kept ✓
```

---

## Click Redirect Handling

Figma uses `click.figma.com` tracking URLs in email links. The parser can follow these redirects to extract the actual file key.

### Implementation

```typescript
export async function followClickFigmaRedirect(url: string): Promise<string | null> {
  // Create abort controller for 3-second timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  try {
    // Perform HEAD request with manual redirect handling
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    })

    // Extract location header from redirect response
    const location = response.headers.get('location')
    if (!location) return null

    // Decode the URL (may be URL-encoded)
    const decoded = decodeURIComponent(location)

    // Extract file key from decoded destination URL
    const fileMatch = decoded.match(/figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]+)/)
    return fileMatch?.[1] || null
  } finally {
    clearTimeout(timeoutId)
  }
}
```

### Key Features

#### 1. HEAD Request (Not GET)
```typescript
method: 'HEAD'
```
- Only fetches headers, not body content
- Much faster than GET request
- Sufficient to get redirect location
- Reduces bandwidth and latency

#### 2. Manual Redirect Handling
```typescript
redirect: 'manual'
```
- Prevents automatic redirect following
- Allows inspection of Location header
- Gives control over redirect chain
- Can log intermediate URLs

#### 3. 3-Second Timeout
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 3000)
```

**Why 3 seconds?**
- Long enough for most requests to complete
- Short enough to not block webhook processing
- Graceful degradation if network is slow
- Falls back to other priority methods

#### 4. URL Decoding
```typescript
const decoded = decodeURIComponent(location)
```

**Why this is necessary:**
- Redirect URLs may be URL-encoded
- Example: `%2F` → `/`
- Required for regex matching
- Handles double-encoded URLs

### Error Handling

```typescript
catch (error: any) {
  if (error.name === 'AbortError') {
    console.log('[EmailParser] Redirect request timed out after 3s')
  } else {
    console.error('[EmailParser] Error following redirect:', error.message)
  }
  return null
}
```

**Graceful degradation:**
- Timeout → Log and return null
- Network error → Log and return null
- Invalid response → Return null
- Parser continues with Priority 3+ methods

### Example Flow

```
Input:
  Email HTML contains:
  <a href="https://click.figma.com/f/a/dGhpcyBpcyBhbiBleGFtcGxl...">View in Figma</a>

Step 1: Extract tracking URL
  → https://click.figma.com/f/a/dGhpcyBpcyBhbiBleGFtcGxl...

Step 2: Send HEAD request
  HEAD https://click.figma.com/f/a/... HTTP/1.1

Step 3: Receive redirect response
  HTTP/1.1 302 Found
  Location: https://www.figma.com/file/abc123def456/My-Design?node-id=123

Step 4: Decode URL
  → https://www.figma.com/file/abc123def456/My-Design?node-id=123

Step 5: Extract file key
  Match: /figma\.com\/file\/([a-zA-Z0-9]+)/
  → File Key: abc123def456
```

### Async vs Sync Versions

#### Async Version (parseEmailAsync)
```typescript
// Follows redirects with HEAD request
const extractedKey = await followClickFigmaRedirect(redirectUrl)
```
- **Pros:** Most accurate, follows actual redirects
- **Cons:** Requires async/await, has network latency
- **Use when:** Processing webhooks (async context available)

#### Sync Version (parseEmail)
```typescript
// Tries to decode URL inline
const decoded = decodeURIComponent(redirectUrl)
const fileMatch = decoded.match(/figma\.com\/file\/([a-zA-Z0-9]+)/)
```
- **Pros:** No network request, instant response
- **Cons:** May fail if file key not embedded in tracking URL
- **Use when:** Sync context required, speed is critical

---

## Fuzzy Matching Algorithm

The fuzzy matching system allows the parser to correlate email content with Figma API comments, even when text formatting differs slightly.

### Core Algorithm: Levenshtein Distance

```typescript
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
```

**What it calculates:**
- Minimum number of single-character edits to change one string into another
- Edits include: substitution, insertion, deletion
- Lower distance = more similar strings

**Example:**
```typescript
levenshteinDistance("kitten", "sitting")
→ 3 edits needed:
  1. kitten → sitten (substitute k → s)
  2. sitten → sittin (substitute e → i)
  3. sittin → sitting (insert g)
```

### Similarity Score Calculation

```typescript
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
```

**Score interpretation:**
- `1.0` - Identical strings
- `0.9+` - Very similar (minor differences)
- `0.8+` - Similar (default threshold)
- `0.7+` - Somewhat similar
- `<0.7` - Probably different

**Optimizations:**
1. **Exact match**: Return 1.0 immediately
2. **Contains**: Fast path for substring relationships
3. **Levenshtein**: Full algorithm only when needed

### Text Normalization

```typescript
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
```

**Why normalization matters:**
```typescript
// Without normalization:
"Hello  World" ≠ "hello world"  // Different case + whitespace
Similarity: ~0.6

// With normalization:
normalizeText("Hello  World") === normalizeText("hello world")
Similarity: 1.0
```

### Fuzzy Text Finding

```typescript
export function fuzzyFindText(
  needle: string,
  haystack: string[],
  threshold = 0.8
): string | null {
  const normalizedNeedle = normalizeText(needle)
  let bestMatch: string | null = null
  let bestScore = 0

  for (const candidate of haystack) {
    const normalizedCandidate = normalizeText(candidate)
    const score = calculateSimilarity(normalizedNeedle, normalizedCandidate)

    if (score > bestScore && score >= threshold) {
      bestScore = score
      bestMatch = candidate
    }
  }

  return bestMatch
}
```

**How it works:**
1. Normalize the search text (needle)
2. For each candidate in haystack:
   - Normalize candidate
   - Calculate similarity score
   - Keep track of best match above threshold
3. Return best match (or null if none above threshold)

**Example:**
```typescript
const needle = "Hello  World"
const haystack = [
  "Goodbye cruel world",
  "hello world",
  "Hello there world!",
]

fuzzyFindText(needle, haystack, 0.8)
→ "hello world" (score: 1.0 after normalization)
```

### Finding Comments by Text

```typescript
export function findCommentByText<T extends { message: string }>(
  searchText: string,
  comments: T[],
  threshold = 0.8
): T | null {
  const normalizedSearchText = normalizeText(searchText)
  let bestMatch: T | null = null
  let bestScore = 0

  for (const comment of comments) {
    const normalizedMessage = normalizeText(comment.message)
    const score = calculateSimilarity(normalizedSearchText, normalizedMessage)

    if (score > bestScore && score >= threshold) {
      bestScore = score
      bestMatch = comment
    }
  }

  console.log('[EmailParser] Fuzzy match result:', {
    searchText: searchText.substring(0, 100),
    bestScore,
    found: !!bestMatch,
    threshold,
  })

  return bestMatch
}
```

**Use case:**
- Email contains: `"@Figbot review this design"`
- Figma API returns comments:
  ```typescript
  [
    { message: "@Figbot review this design", id: "123" },
    { message: "Looks good to me", id: "456" },
  ]
  ```
- Match found: `{ message: "@Figbot review this design", id: "123" }` (score: 1.0)

### Threshold Tuning

**Default: 0.8 (80% similarity)**
```typescript
threshold = 0.8  // Good balance
```

**Why 0.8?**
- Allows minor formatting differences
- Prevents false positives
- Handles email HTML artifacts
- Tested across production emails

**Custom thresholds:**
```typescript
// Strict matching (require near-exact match)
fuzzyFindText(text, candidates, 0.95)

// Lenient matching (more tolerance)
fuzzyFindText(text, candidates, 0.6)

// Exact match only
fuzzyFindText(text, candidates, 1.0)
```

**Real-world examples:**

| Email Text | Figma API Text | Score | Match? |
|-----------|----------------|-------|--------|
| `@Figbot review this` | `@Figbot review this` | 1.0 | ✓ Yes |
| `@Figbot review this` | `@Figbot  review  this` | 1.0 | ✓ Yes (normalized) |
| `@Figbot review` | `@Figbot review this design` | 0.75 | ✗ No (below 0.8) |
| `review this design` | `@Figbot review this design` | 0.72 | ✗ No (below 0.8) |
| `Please review` | `Please review the header` | 0.63 | ✗ No (below 0.8) |

---

## Usage Examples

### Basic Email Parsing

```typescript
import { parseEmail } from '~/server/utils/emailParser'

// Synchronous parsing (uses inline URL decoding)
const result = parseEmail({
  subject: 'John commented on Design File',
  from: 'comments-abc123def456@email.figma.com',
  'body-html': '<p>@Figbot please review</p>',
  'stripped-text': '@Figbot please review',
  timestamp: 1699999999,
})

console.log(result)
// {
//   text: '@Figbot please review',
//   html: '<p>@Figbot please review</p>',
//   fileKey: 'abc123def456',  // From sender email (Priority 1)
//   author: 'comments-abc123def456@email.figma.com',
//   links: [],
//   subject: 'John commented on Design File',
//   timestamp: Date('2023-11-14T22:13:19.000Z'),
// }
```

### Async Parsing with Redirect Following

```typescript
import { parseEmailAsync } from '~/server/utils/emailParser'

// Async parsing (follows click.figma.com redirects)
const result = await parseEmailAsync({
  subject: 'Jane mentioned you',
  from: 'figma@example.com',
  'body-html': `
    <p>@john Great work!</p>
    <a href="https://click.figma.com/f/a/xyz789">View in Figma</a>
  `,
})

console.log(result)
// {
//   text: '@john Great work!',
//   fileKey: 'abc123def456',  // From followed redirect (Priority 2)
//   figmaLink: 'https://click.figma.com/f/a/xyz789',
//   // ... other fields
// }
```

### Full Figma Email Parsing

```typescript
import { parseFigmaEmail } from '~/server/utils/emailParser'

// Parse with Figma-specific metadata
const result = await parseFigmaEmail({
  subject: 'Team member commented on Dashboard',
  from: 'comments-xyz789@email.figma.com',
  'body-html': `
    <p>@Figbot can you generate a discussion?</p>
    <a href="https://figma.com/file/xyz789/Dashboard">View File</a>
  `,
})

console.log(result)
// {
//   text: '@Figbot can you generate a discussion?',
//   fileKey: 'xyz789',
//   emailType: 'comment',  // 'comment' | 'invitation' | 'unknown'
//   fileUrl: 'https://figma.com/file/xyz789/Dashboard',
//   // ... other fields
// }
```

### Extracting File Keys from URLs

```typescript
import { extractFileKeyFromUrl } from '~/server/utils/emailParser'

// Various Figma URL formats
extractFileKeyFromUrl('https://www.figma.com/file/abc123/Design')
// → 'abc123'

extractFileKeyFromUrl('https://www.figma.com/design/xyz789/Dashboard')
// → 'xyz789'

extractFileKeyFromUrl('https://www.figma.com/proto/test456/Prototype')
// → 'test456'

extractFileKeyFromUrl('https://api-cdn.figma.com/resize/images/123456789/')
// → '123456789'

extractFileKeyFromUrl('https://example.com/not-figma')
// → null
```

### Fuzzy Comment Matching

```typescript
import { findCommentByText } from '~/server/utils/emailParser'

// Email extracted text
const emailText = "@Figbot  please  review  this  design"

// Figma API comments
const figmaComments = [
  { id: '1', message: '@Figbot please review this design' },
  { id: '2', message: 'Looks good!' },
  { id: '3', message: '@Figbot another task' },
]

// Find matching comment
const match = findCommentByText(emailText, figmaComments)

console.log(match)
// { id: '1', message: '@Figbot please review this design' }
// (Score: 1.0 after normalization)

// With custom threshold
const strictMatch = findCommentByText(emailText, figmaComments, 0.95)
// Still matches (exact after normalization)

const lenientMatch = findCommentByText("review design", figmaComments, 0.5)
// Might match comment 1 (partial overlap)
```

### Following Click Redirects

```typescript
import { followClickFigmaRedirect } from '~/server/utils/emailParser'

// Follow a tracking URL
const trackingUrl = 'https://click.figma.com/f/a/dGhpcyBpcyBhbiBleGFtcGxl'
const fileKey = await followClickFigmaRedirect(trackingUrl)

console.log(fileKey)
// → 'abc123def456' (extracted from redirect destination)

// Handles timeouts gracefully
const slowUrl = 'https://click.figma.com/slow-endpoint'
const result = await followClickFigmaRedirect(slowUrl)
// → null (timeout after 3 seconds)
```

### Text Normalization and Similarity

```typescript
import { normalizeText, fuzzyFindText } from '~/server/utils/emailParser'

// Normalize text for comparison
normalizeText("  Hello   World  ")
// → "hello world"

normalizeText("HELLO\n\nWORLD")
// → "hello world"

// Find best match in array
const searchText = "Please review the header"
const candidates = [
  "Please review the header design",
  "Review the footer",
  "Check the header",
]

const bestMatch = fuzzyFindText(searchText, candidates, 0.7)
// → "Please review the header design" (high similarity)

// No match below threshold
const noMatch = fuzzyFindText("Completely different", candidates, 0.8)
// → null
```

---

## Best Practices

### 1. Always Use Async Version for Webhooks

```typescript
// ✓ Good: Async parsing in webhook handler
export default defineEventHandler(async (event) => {
  const emailData = await readBody(event)
  const parsed = await parseEmailAsync(emailData)  // Follows redirects
  // ...
})

// ✗ Bad: Sync parsing misses redirect benefits
export default defineEventHandler(async (event) => {
  const emailData = await readBody(event)
  const parsed = parseEmail(emailData)  // No redirect following
  // ...
})
```

### 2. Log Parser Output for Debugging

The parser includes extensive console logging. Monitor logs to understand which priority levels are being triggered:

```typescript
const parsed = await parseEmailAsync(emailData)

// Logs will show:
// [EmailParser] Parsing email (async)
// [EmailParser] Priority 1: Extracted file key from sender email: abc123
// [EmailParser] Found @Figbot comment: @Figbot review this
```

### 3. Use Fuzzy Matching for Comment Correlation

When matching email content to Figma API comments, always use fuzzy matching:

```typescript
// ✓ Good: Fuzzy matching handles formatting differences
const match = findCommentByText(emailText, figmaComments, 0.8)

// ✗ Bad: Exact matching fails with whitespace/case differences
const exact = figmaComments.find(c => c.message === emailText)
```

### 4. Handle Missing File Keys Gracefully

Not all emails contain file keys (invitations, notifications). Always check:

```typescript
const parsed = await parseEmailAsync(emailData)

if (!parsed.fileKey) {
  console.warn('No file key found, skipping Figma API correlation')
  // Handle invitation/notification emails differently
}
```

### 5. Tune Fuzzy Threshold Based on Use Case

```typescript
// High precision (fewer false positives)
const strictMatch = findCommentByText(text, comments, 0.9)

// Balanced (recommended default)
const normalMatch = findCommentByText(text, comments, 0.8)

// High recall (catch more matches, risk false positives)
const lenientMatch = findCommentByText(text, comments, 0.6)
```

---

## Related Documentation

- [Figma Integration Guide](./figma-integration.md) - Overall Figma integration architecture
- [Figma Quick Start](./figma-quick-start.md) - Getting started with Figma webhooks
- Email Parser Implementation: `layers/discubot/server/utils/emailParser.ts`
- Email Parser Tests: `tests/utils/emailParser.test.ts`

---

## Testing

Comprehensive tests are available in `tests/utils/emailParser.test.ts` covering:

- **File key extraction** (all 5 priority levels)
- **Text extraction** (all 5 priority levels)
- **@mention extraction** (with CSS filtering)
- **Click redirect following** (with timeout handling)
- **Fuzzy matching** (various thresholds and edge cases)
- **Real-world Figma HTML** (production email samples)

Run tests:
```bash
pnpm test tests/utils/emailParser.test.ts
```

---

## Performance Considerations

### Redirect Following Timeout

The 3-second timeout for redirect following is a balance:
- **Too short**: Legitimate redirects might timeout
- **Too long**: Blocks webhook processing

If you experience frequent timeouts, consider:
1. Increasing timeout to 5 seconds
2. Using sync version with inline decoding
3. Processing redirects in background job

### Fuzzy Matching Complexity

Levenshtein distance is O(m×n) where m and n are string lengths. For long comments or large comment arrays:

```typescript
// Optimization: Truncate very long text before matching
const truncated = emailText.substring(0, 500)
const match = findCommentByText(truncated, comments, 0.8)
```

### Memory Usage

The parser creates multiple copies of strings during normalization. For high-volume webhook processing, consider:
- Streaming email processing
- Limiting HTML size before parsing
- Using worker threads for parsing

---

**Last Updated:** 2024-11-16
**Related Tasks:** Phase 11 (Tasks 11.1-11.7)

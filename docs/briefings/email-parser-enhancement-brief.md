# Email Parser Enhancement Briefing

**Date**: 2025-11-16
**Phase**: 11 - Figma Email Parser Enhancement
**Priority**: Critical
**Estimated Effort**: 8 hours

---

## Executive Summary

Current Figma email parsing is failing with "No comment text found in email" errors. Investigation reveals the prototype at `/Users/pmcp/Projects/fyit-tools/layers/figno` has battle-tested parsing logic that's missing from the current implementation. This briefing documents the gap analysis and implementation plan.

## Problem Statement

### Immediate Issue
```
ERROR [Resend Webhook] Unexpected error: {
  message: 'Failed to parse email',
  statusCode: 422,
  data: { error: 'No comment text found in email' }
}
```

### Root Cause Analysis

**Logs show**:
- HTML content: 40,389 characters (substantial)
- Plain text extracted: 1 character (a space " ")
- Result: Parser uses the space instead of attempting HTML extraction

**The Bug** (emailParser.ts:343):
```typescript
const text = plainText || (html ? extractTextFromHtml(html) : '')
```

When `plainText = " "` (single space), it's truthy → HTML parsing never attempted.

---

## Prototype vs Current Implementation

### Architecture Overview

**Prototype** (`/Users/pmcp/Projects/fyit-tools/layers/figno`):
- Production-tested with real Figma emails
- ~425 lines of sophisticated parsing logic
- Multiple fallback strategies
- Fuzzy matching for comment correlation
- Circuit breaker for API protection

**Current** (`/Users/pmcp/Projects/discubot_v1/layers/discubot`):
- Clean adapter architecture
- Generic parsing approach
- ~412 lines but less Figma-specific
- Missing battle-tested edge case handling

---

## Critical Missing Features

### 1. @Mention Extraction Logic
**Location**: `fyit-tools/.../emailParser.ts` Lines 19-153

**What it does**:
- Extracts @Figbot and @user mentions specifically
- Filters out CSS @rules (@font-face, @media, @import)
- Finds mentions in table cells (Figma's HTML structure)
- Extracts context (100 chars before/after)
- Sorts mentions by length to get full comments

**Impact**: Current implementation misses actual comment text, only gets subject lines or boilerplate.

**Code Example**:
```typescript
// Priority 1: @Figbot mentions with context
const figbotMentions = extractFigbotMentions(html)
if (figbotMentions.length > 0) {
  return figbotMentions[0] // Most likely comment text
}

// Filter CSS rules
allMentions = allMentions.filter(mention => {
  const mentionLower = mention.toLowerCase()
  return !mentionLower.startsWith('@font-face') &&
         !mentionLower.startsWith('@media') &&
         !mentionLower.startsWith('@import')
})
```

---

### 2. File Key Extraction Priority System
**Location**: `fyit-tools/.../emailParser.ts` Lines 227-357

**Priority Order**:
1. **Sender email** (MOST RELIABLE): `comments-[FILEKEY]@email.figma.com`
2. **click.figma.com redirects**: Decode → extract
3. **Direct Figma links**: `figma.com/file/[KEY]`
4. **Upload URLs**: Alternative patterns
5. **40-char hashes**: Fallback pattern

**Current Implementation**: Only tries link parsing (Priority 3)

**Impact**: Misses the most reliable data source (sender email).

**Code Example**:
```typescript
// Priority 1: Extract from sender email
const senderMatch = fromEmail.match(/comments-([a-zA-Z0-9]+)@email\.figma\.com/)
if (senderMatch) {
  return senderMatch[1] // Most reliable!
}
```

---

### 3. Click.figma.com Redirect Handling
**Location**:
- `fyit-tools/.../emailParser.ts` Lines 244-267
- `fyit-tools/.../webhook/mailgun/figma.post.ts` Lines 289-331

**What it does**:
- Detects click tracking links (`click.figma.com`)
- Follows redirect (HEAD request)
- Extracts file key from destination URL
- Decodes URL-encoded destinations

**Impact**: Current implementation fails for emails with click tracking.

**Real-world Example**:
```html
<a href="https://click.figma.com/uni/ls/click?upn=u001.Y4GnNWhdnCDA...">
  View in Figma
</a>
```

The actual Figma link is hidden in the redirect!

**Code Example**:
```typescript
if (url.includes('click.figma.com')) {
  const response = await fetch(url, { method: 'HEAD', redirect: 'manual' })
  const location = response.headers.get('location')
  const decoded = decodeURIComponent(location)
  // Extract file key from decoded URL
}
```

---

### 4. Fuzzy Comment Matching
**Location**: `fyit-tools/.../services/figma.ts` Lines 383-494

**What it does**:
- Normalizes text (removes punctuation, whitespace)
- Calculates Levenshtein distance
- Uses similarity threshold (0.8 = 80% match)
- Handles footer/boilerplate text differences
- Falls back to most recent comment with @mention

**Impact**: Current implementation may fail to match comments when HTML formatting differs from API response.

**Code Example**:
```typescript
const similarity = calculateSimilarity(
  normalizeText(emailText),
  normalizeText(apiCommentText)
)

if (similarity >= 0.8) {
  return apiComment // Match found!
}
```

**Why this matters**: Figma's email HTML may have different formatting than the API's plain text response.

---

### 5. Comprehensive HTML Selectors
**Location**: `fyit-tools/.../emailParser.ts` Lines 155-184

**Prototype Selectors**:
```typescript
[
  '.comment-content',
  '.message-content',
  'td[style*="font-size: 14px"] p',  // Figma-specific!
  'table table td p',                 // Nested tables
  'div[style*="font-family:\'Whyte\'"] p'  // Whyte font = Figma
]
```

**Current Selectors**:
```typescript
[
  '.comment-body',
  '.comment-text',
  'td[class*="comment"]',
  'div[style*="color"]',  // Too generic!
  'td[style*="padding"]', // Too generic!
  'p'
]
```

**From Real Figma Email**:
```html
<td class="darkmode" align="left" style="padding: 4px 0px 4px;">
  <div style="font-family:'Whyte',Arial,Helvetica,...">
    <p style="margin:0">
      <span style="color: #007be5">@testfigma</span> this is task 2
    </p>
  </div>
</td>
```

Current selectors would match `div[style*="color"]` (too early, might get wrong content).

---

### 6. Footer/Boilerplate Filtering
**Location**: `fyit-tools/.../emailParser.ts` Lines 78-95, 120-137

**Filters out**:
- "mobile app"
- "stay on top"
- "unsubscribe"
- "Figma, Inc"
- "View in Figma"
- "@mentions" (footer text, not actual mentions)

**Current Implementation**: Excludes lines with "@" (removes @mentions!) and "figma" (many comment emails mention Figma!).

**Impact**: May extract footer text as comment content OR may exclude actual comment text.

---

### 7. Link Extraction for "View in Figma"
**Requirement**: Extract the "View in Figma" button URL from emails

**From Real Email**:
```html
<a class="link active-t darkmode btn-white2" universal="true"
   href="https://click.figma.com/uni/ls/click?upn=...">
  View in Figma
</a>
```

**What we need**:
1. Find `<a>` tags with `universal="true"` attribute
2. Extract `href` attribute
3. Return as `figmaLink` in parsed result

**Current Implementation**: Doesn't extract this link.

---

### 8. Circuit Breaker Pattern
**Location**: `fyit-tools/.../services/figma.ts` Lines 7-22

**What it does**:
- Tracks failure count
- Opens circuit after 3 failures
- Auto-recovery after 30 seconds
- Prevents API hammering

**Impact**: Current implementation may cause rate limiting during API issues.

---

## Implementation Plan

### Phase 11 Tasks

#### Task 11.1: Fix Plaintext Whitespace Handling (0.5h)
**File**: `layers/discubot/server/utils/emailParser.ts`

**Change** (Line 343):
```typescript
// BEFORE
const text = plainText || (html ? extractTextFromHtml(html) : '')

// AFTER
const trimmedPlainText = plainText?.trim() || ''
const text = trimmedPlainText || (html ? extractTextFromHtml(html) : '')
```

**Test**: Verify HTML parsing is attempted when plainText is whitespace-only.

---

#### Task 11.2: Port @Mention Extraction Logic (1.5h)
**File**: `layers/discubot/server/utils/emailParser.ts`

**Add functions**:
```typescript
// Extract @Figbot mentions with context
function extractFigbotMentions(html: string): string[]

// Filter CSS rules
function filterCSSRules(mentions: string[]): string[]

// Extract from table cells
function extractTableCellMentions(html: string): string[]
```

**Update**: `extractTextFromHtml()` to use these functions as Priority 1.

---

#### Task 11.3: Port File Key Extraction Priority System (1h)
**File**: `layers/discubot/server/utils/emailParser.ts`

**Add priority system**:
```typescript
// Priority 1: Sender email
const fileKey = extractFileKeyFromSender(from)
if (fileKey) return fileKey

// Priority 2: Click.figma.com redirects (Task 11.4)
// Priority 3: Direct links (existing)
// Priority 4: Upload URLs
// Priority 5: 40-char hashes
```

---

#### Task 11.4: Port Click.figma.com Redirect Handling (1h)
**File**: `layers/discubot/server/utils/emailParser.ts`

**Add function**:
```typescript
async function followClickFigmaRedirect(url: string): Promise<string | null> {
  const response = await fetch(url, { method: 'HEAD', redirect: 'manual' })
  const location = response.headers.get('location')
  if (!location) return null

  const decoded = decodeURIComponent(location)
  const fileMatch = decoded.match(/figma\.com\/file\/([a-zA-Z0-9]+)/)
  return fileMatch?.[1] || null
}
```

**Update**: File key extraction to use this for click.figma.com links.

---

#### Task 11.5: Add Figma Link Extraction (0.5h)
**File**: `layers/discubot/server/utils/emailParser.ts`

**Add function**:
```typescript
function extractFigmaLink(html: string): string | null {
  // Find <a> with universal="true"
  // OR find button with text "View in Figma"
  // Extract href
  return url
}
```

**Update**: Return in parsed result as `figmaLink` field.

---

#### Task 11.6: Port Fuzzy Comment Matching (1.5h)
**File**: `layers/discubot/server/adapters/figma.ts`

**Add functions**:
```typescript
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshteinDistance(str1: string, str2: string): number {
  // Implementation
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

function findCommentByText(
  comments: FigmaComment[],
  emailText: string,
  threshold = 0.8
): FigmaComment | null {
  // Find best match above threshold
}
```

**Update**: `fetchThread()` to use fuzzy matching.

---

#### Task 11.7: Testing & Validation (1.5h)

**Test Suite**:
1. **Plaintext whitespace test** - Verify HTML parsing when plaintext is " "
2. **@mention extraction test** - Test with real Figma HTML
3. **File key priority test** - Verify sender email priority
4. **Click redirect test** - Mock redirect following
5. **Link extraction test** - Extract "View in Figma" URL
6. **Fuzzy matching test** - Test similarity thresholds
7. **Integration test** - Use the actual Figma HTML provided

**Real Figma HTML Test Data**:
```html
<div style="display:none;...">
  "@testfigma this is task 2"
</div>
...
<td class="darkmode" align="left" style="padding: 4px 0px 4px;">
  <div style="font-family:'Whyte',...">
    <p style="margin:0">
      <span style="color: #007be5">@testfigma</span> this is task 2
    </p>
  </div>
</td>
...
<a class="link active-t darkmode btn-white2" universal="true"
   href="https://click.figma.com/uni/ls/click?upn=...">
  View in Figma
</a>
```

**Expected Results**:
- Comment text: "@testfigma this is task 2"
- File key: "5MPYq7URiGotXahjbW3Nve" (from sender email)
- Figma link: "https://click.figma.com/uni/ls/click?upn=..."

---

#### Task 11.8: Documentation (0.5h)

**Create**: `docs/guides/email-parser-advanced.md`

**Content**:
- Architecture overview of parser
- Priority systems (file key, text extraction)
- @mention extraction strategy
- Click redirect handling
- Fuzzy matching algorithm
- Troubleshooting guide
- Known limitations
- Future improvements

**Update**: `docs/guides/figma-integration.md` with enhanced parser capabilities.

---

## Success Criteria

1. ✅ Email parsing succeeds with real Figma HTML
2. ✅ Comment text extracted correctly: "@testfigma this is task 2"
3. ✅ File key extracted from sender email
4. ✅ Figma link extracted for "View in Figma" button
5. ✅ No new type errors (run `npx nuxt typecheck`)
6. ✅ All new tests passing
7. ✅ Next incoming webhook processes successfully

---

## Risk Assessment

### Low Risk
- Plaintext fix (simple change)
- Link extraction (straightforward HTML parsing)
- Testing (validation only)

### Medium Risk
- @mention extraction (complex regex, edge cases)
- File key priority system (multiple fallbacks)
- HTML selectors (must not break existing)

### High Risk
- Click redirect handling (external HTTP requests, timeouts)
- Fuzzy matching (performance implications, false positives)

### Mitigation Strategies
- **Testing**: Comprehensive test suite with real Figma HTML
- **Logging**: Detailed logging at each extraction step
- **Timeouts**: Set timeouts for redirect following (3s max)
- **Fallbacks**: Maintain existing logic as fallback
- **Feature Flags**: Can disable advanced features if issues arise

---

## Performance Considerations

### Email Parsing
- **Current**: ~50ms average
- **With enhancements**: ~150ms estimated
- **Impact**: Acceptable (webhook processing is async)

### Redirect Following
- **New overhead**: +100-300ms per click.figma.com link
- **Mitigation**: Cache redirects, timeout after 3s
- **Frequency**: Only for click-tracked emails

### Fuzzy Matching
- **New overhead**: +50-100ms per comment thread
- **Mitigation**: Only run if exact match fails
- **Optimization**: Cache Levenshtein calculations

---

## Rollback Plan

If enhancements cause issues:

1. **Feature Flags**: Add env var `USE_ENHANCED_PARSER=true`
2. **Fallback Logic**: Keep current parser as fallback
3. **Monitoring**: Track parse failures in metrics
4. **Quick Disable**: Set `USE_ENHANCED_PARSER=false`

---

## References

### Prototype Code Locations
- Email Parser: `/Users/pmcp/Projects/fyit-tools/layers/figno/server/utils/emailParser.ts`
- Email Classifier: `/Users/pmcp/Projects/fyit-tools/layers/figno/server/utils/emailClassifier.ts`
- Figma Service: `/Users/pmcp/Projects/fyit-tools/layers/figno/server/services/figma.ts`
- Webhook Handler: `/Users/pmcp/Projects/fyit-tools/layers/figno/server/api/webhook/mailgun/figma.post.ts`

### Current Implementation
- Email Parser: `/Users/pmcp/Projects/discubot_v1/layers/discubot/server/utils/emailParser.ts`
- Figma Adapter: `/Users/pmcp/Projects/discubot_v1/layers/discubot/server/adapters/figma.ts`
- Resend Webhook: `/Users/pmcp/Projects/discubot_v1/layers/discubot/server/api/webhooks/resend.post.ts`

### Real Figma Email HTML
- Location: User provided in conversation (40,389 characters)
- Preview text: "@testfigma this is task 2"
- File key: 5MPYq7URiGotXahjbW3Nve
- Sender: `comments-5MPYq7URiGotXahjbW3Nve@email.figma.com`

---

## Next Steps

1. **Approve this briefing** ✅
2. **Create Phase 11 tasks in PROGRESS_TRACKER.md** (Next)
3. **Begin Task 11.1** (Fix plaintext handling)
4. **Iterate through all 8 tasks**
5. **Test with next incoming webhook**
6. **Monitor production metrics**

---

**Prepared By**: Claude Code
**Review Status**: Pending User Approval
**Estimated Delivery**: 1 day (8 hours development + testing)

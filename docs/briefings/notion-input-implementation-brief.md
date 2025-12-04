# Notion as Input Source - Implementation Plan

**Version**: 1.1 (Updated with API research)
**Last Updated**: 2025-12-04

## Overview

Add Notion as a discussion input source, allowing users to tag `@discubot` in Notion comments to create tasks. This mirrors the existing Slack and Figma patterns.

**Trigger**: User comments `@discubot` in a Notion page/database
**Result**: AI analyzes discussion → Task created in configured Notion database → Reply posted to comment thread

---

## Architecture

```
Notion Comment "@discubot fix this bug"
        ↓
comment.created webhook → /api/webhooks/notion-input.post.ts
        ↓
Verify X-Notion-Signature (HMAC-SHA256)
        ↓
Wait 2-3s (webhook fires before data fully saved)
        ↓
Fetch comment via API (GET /v1/comments?block_id={page_id})
        ↓
Check rich_text for trigger keyword
        ↓ (if found)
Filter thread by discussion_id → Build DiscussionThread
        ↓
Processor → AI Analysis
        ↓
Create task in Notion database (existing notion.ts service)
        ↓
Reply to comment thread (POST /v1/comments with discussion_id)
```

---

## Webhook Security (Verified)

### Signature Verification

Notion sends an `X-Notion-Signature` header with every webhook request:

```
X-Notion-Signature: sha256={hex_digest}
```

**Algorithm**: HMAC-SHA256
**Key**: The `verification_token` from your webhook subscription
**Body**: Raw request body as minified JSON

```typescript
import { createHmac, timingSafeEqual } from 'crypto'

function verifyNotionSignature(
  body: string,
  signature: string,
  verificationToken: string
): boolean {
  const expectedSignature = 'sha256=' + createHmac('sha256', verificationToken)
    .update(body)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
```

### Verification Challenge

When creating a webhook subscription:
1. Notion sends a POST request containing a `verification_token` field
2. You must manually confirm the subscription in the Notion integration UI
3. Store the `verification_token` securely for signature verification

**Note**: This is NOT an echo-back challenge like Slack. Confirmation happens in Notion's UI.

---

## Sparse Payload Pattern (Important!)

Notion webhooks send **minimal data** - only IDs and timestamps, NOT full content.

```typescript
// What you receive (sparse)
interface NotionWebhookPayload {
  type: 'comment.created'
  timestamp: string
  data: {
    id: string              // Comment UUID only
    parent: {
      type: 'page_id' | 'block_id'
      page_id?: string
      block_id?: string
    }
    discussion_id: string   // Thread identifier
  }
  entity: {
    id: string              // Page UUID
    type: 'page'
  }
}

// What you need to do: Fetch full content via API
const comments = await fetchComments(payload.data.parent.page_id, token)
const thisComment = comments.find(c => c.id === payload.data.id)
const triggerFound = checkForTrigger(thisComment.rich_text, '@discubot')
```

### Timing Consideration

Community reports indicate the webhook often fires **before** Notion's backend finishes saving the comment data.

**Recommendation**: Add a 2-3 second delay before fetching comment content to avoid incomplete responses.

```typescript
// In webhook handler
await new Promise(resolve => setTimeout(resolve, 2500)) // 2.5s delay
const comments = await fetchComments(pageId, token)
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `layers/discubot/server/adapters/notion-input.ts` | Notion input adapter implementing DiscussionSourceAdapter |
| `layers/discubot/server/api/webhooks/notion-input.post.ts` | Webhook endpoint for incoming Notion comments |
| `docs/guides/notion-input-setup-guide.md` | Setup guide for users |

### Modified Files
| File | Changes |
|------|---------|
| `layers/discubot/server/adapters/index.ts` | Register Notion input adapter |
| `layers/discubot/app/components/flows/FlowBuilder.vue` | Add Notion as input option |

**Note**: File named `notion-input.ts` to distinguish from existing `notion.ts` (output service).

---

## Implementation Tasks

### Phase 1: Notion Input Adapter (4-5h)

#### Task 1.1: Create Notion Input Adapter Base
**File**: `layers/discubot/server/adapters/notion-input.ts`

Implement `DiscussionSourceAdapter` interface:

```typescript
export class NotionInputAdapter implements DiscussionSourceAdapter {
  readonly sourceType = 'notion'

  async parseIncoming(payload: NotionWebhookPayload): Promise<ParsedDiscussion> {
    // 1. Extract comment ID, page ID, discussion_id from sparse payload
    // 2. Wait 2-3s for data to be saved
    // 3. Fetch comment content via API
    // 4. Check rich_text for trigger keyword
    // 5. Build ParsedDiscussion
  }

  async fetchThread(threadId: string, config: SourceConfig): Promise<DiscussionThread> {
    // threadId format: "page_id:discussion_id"
    // GET /v1/comments?block_id={page_id}
    // Filter by discussion_id to get thread
    // Build thread with root message + replies
  }

  async postReply(threadId: string, message: string, config: SourceConfig): Promise<boolean> {
    // POST /v1/comments with discussion_id parameter
    // Format message as rich_text array
  }

  async updateStatus(threadId: string, status: DiscussionStatus, config: SourceConfig): Promise<boolean> {
    // Notion doesn't support comment reactions
    return true  // No-op, always succeed
  }

  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    // Check notionToken exists and format (ntn_* or secret_*)
    // Check verificationToken exists (for webhook signature)
  }

  async testConnection(config: SourceConfig): Promise<boolean> {
    // GET /v1/users/me to verify token works
  }
}
```

#### Task 1.2: Notion API Helpers
**File**: `layers/discubot/server/adapters/notion-input.ts`

Add helper functions:

```typescript
const NOTION_API_BASE = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

// Fetch all comments on a page/block
async function fetchComments(
  blockId: string,
  token: string
): Promise<NotionComment[]> {
  const response = await fetch(
    `${NOTION_API_BASE}/comments?block_id=${blockId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
      }
    }
  )
  const data = await response.json()
  return data.results
}

// Post reply to discussion thread
async function postComment(
  discussionId: string,
  richText: RichTextItem[],
  token: string
): Promise<boolean> {
  const response = await fetch(`${NOTION_API_BASE}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      discussion_id: discussionId,  // Reply to existing thread
      rich_text: richText,
    })
  })
  return response.ok
}

// Check if rich_text contains trigger keyword
function checkForTrigger(
  richText: RichTextItem[],
  keyword: string
): boolean {
  const plainText = richText.map(rt => rt.plain_text).join('')
  return plainText.toLowerCase().includes(keyword.toLowerCase())
}

// Extract plain text from rich_text array
function extractPlainText(richText: RichTextItem[]): string {
  return richText.map(rt => rt.plain_text).join('')
}
```

#### Task 1.3: Register Adapter
**File**: `layers/discubot/server/adapters/index.ts`

```typescript
import { createNotionInputAdapter } from './notion-input'

const adapters: AdapterRegistry = {
  figma: createFigmaAdapter(),
  slack: createSlackAdapter(),
  notion: createNotionInputAdapter(),  // Add
}
```

---

### Phase 2: Webhook Endpoint (2-3h)

#### Task 2.1: Create Notion Input Webhook
**File**: `layers/discubot/server/api/webhooks/notion-input.post.ts`

```typescript
import { createHmac, timingSafeEqual } from 'crypto'

export default defineEventHandler(async (event) => {
  const body = await readRawBody(event)
  const signature = getHeader(event, 'x-notion-signature')

  // 1. Verify webhook signature
  if (!verifySignature(body, signature, config.verificationToken)) {
    throw createError({ statusCode: 401, message: 'Invalid signature' })
  }

  const payload = JSON.parse(body)

  // 2. Only process comment.created events
  if (payload.type !== 'comment.created') {
    return { success: true, message: 'Event type ignored' }
  }

  // 3. Wait for data to be saved (Notion timing issue)
  await new Promise(resolve => setTimeout(resolve, 2500))

  // 4. Load config by page/workspace association
  // 5. Fetch comment content via API
  // 6. Check for trigger keyword
  // 7. If triggered, route to processor

  return { success: true }
})

function verifySignature(
  body: string,
  signature: string | undefined,
  verificationToken: string
): boolean {
  if (!signature) return false

  const expected = 'sha256=' + createHmac('sha256', verificationToken)
    .update(body)
    .digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  } catch {
    return false
  }
}
```

#### Task 2.2: Config Lookup Strategy

The webhook receives a page ID but needs to find the associated flow config. Options:

**Option A: Store page/database associations**
- When user configures Notion input, store which pages/databases to monitor
- Lookup: Find config where `sourceMetadata.monitoredPages` includes the page ID

**Option B: Workspace-level config**
- One config per Notion workspace
- Lookup: Find config by workspace ID (from Notion API response)

**Recommendation**: Option B (simpler, matches Slack pattern)

---

### Phase 3: Type Updates (0.5h)

#### Task 3.1: Add Notion Types
**File**: `layers/discubot/types/index.ts`

```typescript
// Notion webhook payload (sparse - only IDs)
export interface NotionWebhookPayload {
  type: 'comment.created' | 'page.content_updated' | string
  timestamp: string
  data: {
    id: string
    parent: {
      type: 'page_id' | 'block_id'
      page_id?: string
      block_id?: string
    }
    discussion_id: string
  }
  entity: {
    id: string
    type: 'page' | 'database'
  }
}

// Notion rich text item
export interface NotionRichTextItem {
  type: 'text' | 'mention' | 'equation'
  text?: {
    content: string
    link?: { url: string } | null
  }
  mention?: {
    type: 'user' | 'page' | 'database' | 'date'
    user?: { id: string }
  }
  plain_text: string
  annotations: {
    bold: boolean
    italic: boolean
    strikethrough: boolean
    underline: boolean
    code: boolean
    color: string
  }
}

// Notion comment object (from API response)
export interface NotionComment {
  object: 'comment'
  id: string
  parent: {
    type: 'page_id' | 'block_id'
    page_id?: string
    block_id?: string
  }
  discussion_id: string
  created_time: string
  last_edited_time: string
  created_by: {
    object: 'user'
    id: string
  }
  rich_text: NotionRichTextItem[]
}

// Notion input config (stored in FlowInput.sourceMetadata)
export interface NotionInputConfig {
  verificationToken: string    // For webhook signature verification
  triggerKeyword: string       // Default: "@discubot"
  workspaceId?: string         // Optional, for organization
  integrationToken: string     // Notion API token
}
```

---

### Phase 4: Flow Integration (2-3h)

#### Task 4.1: Add Notion Input to FlowBuilder
**File**: `layers/discubot/app/components/flows/FlowBuilder.vue`

- Add "Notion" option to input source dropdown
- Show Notion-specific configuration fields:
  - Notion Integration Token (masked input, required)
  - Verification Token (masked input, required - from webhook subscription)
  - Trigger Keyword (UInput, default: `@discubot`)
  - Webhook URL (read-only, copy button)
  - "Test Connection" button
  - Link to setup guide

---

### Phase 5: Documentation (1h)

#### Task 5.1: Create Setup Guide
**File**: `docs/guides/notion-input-setup-guide.md`

Contents:
1. Create Notion Integration (with comment read/write capabilities)
2. Create webhook subscription in integration settings
3. Copy verification token for signature verification
4. Configure webhook URL pointing to `/api/webhooks/notion-input`
5. Connect integration to target pages/databases
6. Test with trigger keyword comment
7. Troubleshooting (timing, permissions, signature errors)

---

### Phase 6: Testing (2-3h)

#### Task 6.1: Unit Tests
**File**: `tests/adapters/notion-input.test.ts`

- Test `parseIncoming()` with sparse payloads
- Test `fetchThread()` response parsing
- Test `postReply()` API call formatting
- Test trigger detection (case-insensitive, various keywords)
- Test signature verification (valid, invalid, missing)

#### Task 6.2: Integration Tests
**File**: `tests/integration/notion-input-flow.test.ts`

- End-to-end flow: webhook → adapter → processor → task creation
- Test webhook signature verification
- Test timing delay handling
- Test error recovery (API failures, missing comments)

---

## Thread ID Format

Following existing patterns:
- Figma: `{file_key}:{comment_id}`
- Slack: `{channel_id}:{thread_ts}`
- **Notion**: `{page_id}:{discussion_id}`

---

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/comments?block_id={id}` | GET | List comments on page/block |
| `/v1/comments` | POST | Reply to discussion (with `discussion_id`) |
| `/v1/users/me` | GET | Test connection / get bot info |

**Note**: There is no `GET /v1/comments/{id}` endpoint. Must list all comments and filter.

**Rate Limit**: 3 requests per second (180/min)

---

## Estimated Total Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Notion Input Adapter | 4-5h |
| Phase 2: Webhook Endpoint | 2-3h |
| Phase 3: Type Updates | 0.5h |
| Phase 4: Flow Integration | 2-3h |
| Phase 5: Documentation | 1h |
| Phase 6: Testing | 2-3h |
| **Total** | **12-16h** |

---

## Design Decisions

1. **Trigger keyword**: Configurable per flow (default: `@discubot`)
2. **Status updates**: No-op - Notion doesn't support comment reactions
3. **Rate limiting**: 3 req/sec matches existing implementation
4. **Timing delay**: 2.5s wait before fetching to handle Notion's async save
5. **File naming**: `notion-input.ts` to distinguish from `notion.ts` (output service)
6. **Config lookup**: Workspace-level (matches Slack pattern)

---

## Success Criteria

- [ ] User can add Notion as input source in FlowBuilder
- [ ] Configurable trigger keyword triggers task creation
- [ ] Reply posted to Notion comment thread with task link
- [ ] Webhook signature verification working (HMAC-SHA256)
- [ ] Handles sparse payload + API fetch pattern
- [ ] 2-3s timing delay prevents missing data
- [ ] Documentation complete
- [ ] Tests passing

---

## Known Limitations

1. **Block-level comments**: Notion API doesn't fully support inline/block comments
2. **No comment reactions**: Can't add emoji status indicators like Slack
3. **Sparse webhooks**: Must always fetch full content via separate API call
4. **Timing sensitivity**: Webhook may arrive before data is queryable

---

## References

- [Notion Webhooks Reference](https://developers.notion.com/reference/webhooks)
- [Notion Comments API](https://developers.notion.com/reference/comment-object)
- [Notion Rich Text](https://developers.notion.com/reference/rich-text)
- [Create Comment Endpoint](https://developers.notion.com/reference/create-a-comment)
- [Existing Slack Adapter](../layers/discubot/server/adapters/slack.ts)
- [Existing Figma Adapter](../layers/discubot/server/adapters/figma.ts)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-03 | Initial draft |
| 1.1 | 2025-12-04 | Updated with API research: signature format, sparse payloads, timing delay, verification challenge clarification |

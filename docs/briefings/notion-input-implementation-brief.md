# Notion as Input Source - Implementation Plan

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
Fetch comment via API (GET /comments/{id})
        ↓
Check rich_text for "@discubot" keyword
        ↓ (if found)
Fetch full thread (GET /comments?block_id=X, filter by discussion_id)
        ↓
Build DiscussionThread → Processor → AI Analysis
        ↓
Create task in Notion database (existing notion.ts service)
        ↓
Reply to comment: "✅ Task created: [link]"
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `layers/discubot/server/adapters/notion.ts` | Notion adapter implementing DiscussionSourceAdapter |
| `layers/discubot/server/api/webhooks/notion-input.post.ts` | Webhook endpoint for incoming Notion comments |
| `docs/guides/notion-input-setup-guide.md` | Setup guide for users |

### Modified Files
| File | Changes |
|------|---------|
| `layers/discubot/server/adapters/index.ts` | Register Notion adapter |
| `layers/discubot/types/index.ts` | Add 'notion' to sourceType union |
| `layers/discubot/app/components/flows/FlowBuilder.vue` | Add Notion as input option |

---

## Implementation Tasks

### Phase 1: Notion Adapter (4-5h)

#### Task 1.1: Create Notion Adapter Base
**File**: `layers/discubot/server/adapters/notion.ts`

Implement `DiscussionSourceAdapter` interface:

```typescript
export const notionAdapter: DiscussionSourceAdapter = {
  sourceType: 'notion',

  async parseIncoming(payload: NotionWebhookPayload): Promise<ParsedDiscussion> {
    // Extract comment ID, page ID from webhook
    // Fetch comment content via API
    // Check for @discubot trigger
    // Build ParsedDiscussion
  },

  async fetchThread(threadId: string, config: SourceConfig): Promise<DiscussionThread> {
    // threadId format: "page_id:discussion_id"
    // GET /comments?block_id={page_id}
    // Filter by discussion_id
    // Build thread with root message + replies
  },

  async postReply(threadId: string, message: string, config: SourceConfig): Promise<boolean> {
    // POST /comments with discussion_id
  },

  async updateStatus(threadId: string, status: DiscussionStatus, config: SourceConfig): Promise<boolean> {
    // Notion doesn't support reactions - skip status updates entirely
    return true  // No-op, just return success
  },

  async validateConfig(config: SourceConfig): Promise<ValidationResult> {
    // Check notionToken exists
    // Validate token format
  },

  async testConnection(config: SourceConfig): Promise<boolean> {
    // GET /users/me to verify token
  }
}
```

#### Task 1.2: Notion API Helpers
**File**: `layers/discubot/server/adapters/notion.ts`

Add helper functions:
- `fetchComment(commentId: string, token: string)` - Get single comment
- `fetchCommentThread(pageId: string, discussionId: string, token: string)` - Get all comments in thread
- `postComment(pageId: string, discussionId: string, content: string, token: string)` - Reply to thread
- `checkForTrigger(richText: RichTextItem[], keyword: string)` - Check for trigger keyword in content

#### Task 1.3: Register Adapter
**File**: `layers/discubot/server/adapters/index.ts`

```typescript
import { notionAdapter } from './notion'

const ADAPTERS: Record<string, DiscussionSourceAdapter> = {
  figma: figmaAdapter,
  slack: slackAdapter,
  notion: notionAdapter,  // Add
}
```

---

### Phase 2: Webhook Endpoint (2-3h)

#### Task 2.1: Create Notion Input Webhook
**File**: `layers/discubot/server/api/webhooks/notion-input.post.ts`

```typescript
export default defineEventHandler(async (event) => {
  // 1. Verify webhook signature (X-Notion-Signature header)
  // 2. Handle verification_token challenge (initial subscription)
  // 3. Parse webhook payload
  // 4. Only process comment.created events
  // 5. Fetch comment content
  // 6. Check for trigger keyword (configurable per flow)
  // 7. If triggered, route to processor
  // 8. Return 200 OK
})
```

#### Task 2.2: Webhook Signature Verification
Add HMAC-SHA256 verification for `X-Notion-Signature` header.

#### Task 2.3: Handle Verification Challenge
Notion sends a `verification_token` when subscribing - endpoint must echo it back.

---

### Phase 3: Type Updates (0.5h)

#### Task 3.1: Update Source Types
**File**: `layers/discubot/types/index.ts`

```typescript
// Update sourceType union
export type SourceType = 'figma' | 'slack' | 'notion'

// Add Notion-specific config interface
export interface NotionInputConfig {
  notionToken: string
  triggerKeyword: string   // configurable per flow, default: "@discubot"
  workspaceId?: string     // optional, for display/organization
}
```

---

### Phase 4: Flow Integration (2-3h)

#### Task 4.1: Add Notion Input to FlowBuilder
**File**: `layers/discubot/app/components/flows/FlowBuilder.vue`

- Add "Notion" option to input source dropdown
- Show Notion-specific configuration fields:
  - Notion Integration Token (masked input)
  - **Trigger Keyword** (UInput, default: `@discubot`, user can change to `@task`, `#todo`, etc.)
  - Webhook URL (read-only, copy button for Notion integration settings)
  - "Test Connection" button
  - Link to setup guide

---

### Phase 5: Documentation (1h)

#### Task 5.1: Create Setup Guide
**File**: `docs/guides/notion-input-setup-guide.md`

Contents:
1. Create Notion Integration
2. Enable comment read/write capabilities
3. Subscribe to `comment.created` webhook
4. Connect integration to target databases
5. Test with trigger keyword comment
6. Troubleshooting

---

### Phase 6: Testing (2-3h)

#### Task 6.1: Unit Tests
**File**: `tests/adapters/notion.test.ts`

- Test `parseIncoming()` with various payloads
- Test `fetchThread()` response parsing
- Test `postReply()` API call
- Test trigger detection (various keywords)

#### Task 6.2: Integration Tests
**File**: `tests/integration/notion-flow.test.ts`

- End-to-end flow: webhook → adapter → processor → task creation
- Test webhook signature verification
- Test verification challenge handling

---

## Thread ID Format

Following existing patterns:
- Figma: `{file_key}:{comment_id}`
- Slack: `{channel_id}:{thread_ts}`
- **Notion**: `{page_id}:{discussion_id}`

---

## Webhook Payload Structure

```typescript
interface NotionCommentWebhook {
  type: 'comment.created'
  data: {
    id: string           // comment UUID
    parent: {
      type: 'page_id' | 'block_id'
      page_id?: string
      block_id?: string
    }
    discussion_id: string
  }
  entity: {
    id: string          // page UUID
    type: 'page'
  }
  timestamp: string
}
```

---

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/comments/{id}` | Fetch single comment content |
| `GET /v1/comments?block_id={id}` | List comments on page/block |
| `POST /v1/comments` | Post reply to discussion |
| `GET /v1/users/me` | Test connection |

---

## Configuration Storage

Reuse existing config pattern but for input:
- Store in flow input's `inputConfig` JSON field
- Fields: `notionToken`, `triggerKeyword`, `workspaceId`

---

## Estimated Total Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Notion Adapter | 4-5h |
| Phase 2: Webhook Endpoint | 2-3h |
| Phase 3: Type Updates | 0.5h |
| Phase 4: Flow Integration | 2-3h |
| Phase 5: Documentation | 1h |
| Phase 6: Testing | 2-3h |
| **Total** | **12-16h** |

---

## Agent Assignments

Execute phases sequentially:

1. **Task 1.1-1.3**: Create Notion adapter (api-designer or general-purpose)
2. **Task 2.1-2.3**: Create webhook endpoint (api-designer)
3. **Task 3.1**: Update types (general-purpose)
4. **Task 4.1**: FlowBuilder UI updates (ui-builder)
5. **Task 5.1**: Documentation (general-purpose)
6. **Task 6.1-6.2**: Testing (test-specialist)

---

## Design Decisions

1. **Trigger keyword**: Configurable per flow (default: `@discubot`, but users can set `@task`, `#todo`, etc.)
2. **Status updates**: Skip entirely - no status indicator, just create task and post reply
3. **Rate limiting**: Notion API is 3 req/sec - same as existing implementation, should work fine.

---

## Success Criteria

- [ ] User can add Notion as input source in FlowBuilder
- [ ] Configurable trigger keyword (default `@discubot`) triggers task creation
- [ ] Reply posted to Notion comment thread with task link
- [ ] Webhook signature verification working
- [ ] Documentation complete
- [ ] Tests passing

---

## References

- [Notion Webhooks Reference](https://developers.notion.com/reference/webhooks)
- [Notion Comments API](https://developers.notion.com/reference/comment-object)
- [Notion Rich Text](https://developers.notion.com/reference/rich-text)
- [Existing Slack Adapter](../layers/discubot/server/adapters/slack.ts)
- [Existing Figma Adapter](../layers/discubot/server/adapters/figma.ts)

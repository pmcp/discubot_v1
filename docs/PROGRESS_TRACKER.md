# Discubot Progress Tracker

**Project Start Date**: 2025-11-11
**Current Feature**: Phase 18 - Notion as Input Source
**Overall Progress**: 4/14 tasks complete
**Estimated Effort**: 12-16h

> **Historical Archive**: For completed phases (1-17), see [PROGRESS_MADE.md](./PROGRESS_MADE.md)

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Tasks Completed | 6 / 14 |
| Remaining Tasks | 8 |
| Hours Logged | 8.5 / 12-16 |
| Current Phase | Phase 18 - Notion Input Source |
| Blockers | 0 |

---

## Phase 18: Notion as Input Source

**Status**: In Progress
**Progress**: 6/14 tasks (43%)
**Time**: 8.5h / 12-16h estimated
**Briefing**: `/docs/briefings/notion-input-implementation-brief.md`

**Goal**: Add Notion as a discussion input source, allowing users to tag `@discubot` (or custom trigger) in Notion comments to create tasks. This mirrors the existing Slack and Figma patterns.

**Trigger**: User comments `@discubot` in a Notion page/database
**Result**: AI analyzes discussion → Task created in configured Notion database → Reply posted to comment thread

---

### Phase 1: Notion Adapter (4-5h)

- [x] Task 18.1: Create Notion Adapter Base (2h) [COMPLETED]
  - File: `layers/discubot/server/adapters/notion.ts`
  - Implement `DiscussionSourceAdapter` interface
  - Methods: `parseIncoming()`, `fetchThread()`, `postReply()`, `updateStatus()`, `validateConfig()`, `testConnection()`
  - Note: `updateStatus()` will be a no-op (Notion doesn't support reactions)

- [x] Task 18.2: Notion API Helpers (1.5h) [COMPLETED]
  - File: `layers/discubot/server/adapters/notion.ts`
  - `fetchComment(commentId, token)` - Get single comment
  - `fetchCommentThread(pageId, discussionId, token)` - Get all comments in thread
  - `postComment(pageId, discussionId, content, token)` - Reply to thread
  - `checkForTrigger(richText[], keyword)` - Check for trigger keyword

- [x] Task 18.3: Register Adapter (0.5h) [COMPLETED]
  - File: `layers/discubot/server/adapters/index.ts`
  - Add `notion: notionAdapter` to ADAPTERS registry
  - Export for use in processor

---

### Phase 2: Webhook Endpoint (2-3h)

- 🔄 Task 18.4: Create Notion Input Webhook (1.5h)
  - File: `layers/discubot/server/api/webhooks/notion-input.post.ts`
  - Verify webhook signature (X-Notion-Signature header)
  - Handle verification_token challenge (initial subscription)
  - Parse webhook payload
  - Only process `comment.created` events
  - Fetch comment content
  - Check for trigger keyword
  - Route to processor if triggered

- 🔄 Task 18.5: Webhook Signature Verification (0.5h)
  - Add HMAC-SHA256 verification for `X-Notion-Signature` header
  - Use existing `webhookSecurity.ts` patterns

- 🔄 Task 18.6: Handle Verification Challenge (0.5h)
  - Echo back `verification_token` when Notion sends subscription challenge

---

### Phase 3: Type Updates (0.5h)

- [x] Task 18.7: Update Source Types (0.5h) [COMPLETED]
  - File: `layers/discubot/types/index.ts`
  - Add 'notion' to `SourceType` union: `'figma' | 'slack' | 'notion'`
  - Add `NotionInputConfig` interface:
    ```typescript
    interface NotionInputConfig {
      notionToken: string
      triggerKeyword: string   // default: "@discubot"
      workspaceId?: string
    }
    ```

---

### Phase 4: Flow Integration (2-3h)

- [x] Task 18.8: Add Notion Input to FlowBuilder (2.5h) [COMPLETED]
  - File: `layers/discubot/app/components/flows/FlowBuilder.vue`
  - Added "Add Notion" button to input sources (alongside Slack and Figma)
  - Notion-specific configuration fields:
    - Notion Integration Token (masked input with password type)
    - Trigger Keyword (UInput, default: `@discubot`, configurable)
    - Webhook URL (read-only with copy button)
    - "Test Connection" button with status indicator
    - Setup guide with step-by-step instructions
  - Created test-connection endpoint: `layers/discubot/server/api/notion/test-connection.post.ts`
  - Updated input list to show Notion icon and trigger keyword

---

### Phase 5: Documentation (1h)

- [x] Task 18.9: Create Setup Guide (1h) [COMPLETED]
  - File: `docs/guides/notion-input-setup-guide.md`
  - Contents:
    1. Create Notion Integration
    2. Enable comment read/write capabilities
    3. Subscribe to `comment.created` webhook
    4. Connect integration to target databases
    5. Test with trigger keyword comment
    6. Troubleshooting

---

### Phase 6: Testing (2-3h)

- [x] Task 18.10: Unit Tests - Adapter (1h) [COMPLETED]
  - File: `tests/adapters/notion.test.ts`
  - Test `parseIncoming()` with various payloads
  - Test `fetchThread()` response parsing
  - Test `postReply()` API call
  - Test trigger detection (various keywords)

- [ ] Task 18.11: Unit Tests - Webhook (1h)
  - File: `tests/webhooks/notion-input.test.ts`
  - Test webhook signature verification
  - Test verification challenge handling
  - Test event filtering (only comment.created)

- [ ] Task 18.12: Integration Tests (1h)
  - File: `tests/integration/notion-flow.test.ts`
  - End-to-end flow: webhook → adapter → processor → task creation
  - Test with mock Notion API responses

---

### Phase 7: Final Verification (0.5h)

- [ ] Task 18.13: Run Full Test Suite (0.25h)
  - Run `pnpm test`
  - Fix any failing tests

- [ ] Task 18.14: Run Type Check (0.25h)
  - Run `npx nuxt typecheck`
  - Fix any type errors

---

## Thread ID Format

Following existing patterns:
- Figma: `{file_key}:{comment_id}`
- Slack: `{channel_id}:{thread_ts}`
- **Notion**: `{page_id}:{discussion_id}`

---

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/comments/{id}` | Fetch single comment content |
| `GET /v1/comments?block_id={id}` | List comments on page/block |
| `POST /v1/comments` | Post reply to discussion |
| `GET /v1/users/me` | Test connection |

---

## Success Criteria

- [x] User can add Notion as input source in FlowBuilder
- [ ] Configurable trigger keyword (default `@discubot`) triggers task creation
- [ ] Reply posted to Notion comment thread with task link
- [ ] Webhook signature verification working
- [ ] Documentation complete
- [ ] Tests passing

---

## Daily Log

### 2025-12-04 - Day 1
**Focus**: Notion Adapter Implementation
**Hours**: 3.5h
**Completed**:
- [x] Archived previous progress tracker (Phases 1-17)
- [x] Created fresh progress tracker for Phase 18
- [x] Reviewed implementation briefing
- [x] Task 18.1: Created Notion Adapter Base with full DiscussionSourceAdapter interface
- [x] Task 18.2: Added Notion API helper functions
- [x] Task 18.7: Added SourceType union and NotionInputConfig interface to types

**Notes**:
- Created `layers/discubot/server/adapters/notion.ts` (~500 lines)
- Implemented all 6 interface methods: parseIncoming, fetchThread, postReply, updateStatus, validateConfig, testConnection
- Added 4 helper functions: fetchComment, fetchCommentThread, postComment, checkForTrigger
- updateStatus is intentionally a no-op (Notion doesnt support reactions)
- Added SourceType union ('figma' | 'slack' | 'notion') and NotionInputConfig interface
- Typecheck passes for new file (pre-existing errors in other files)
- Following existing adapter patterns (Slack, Figma)
- Committed as: feat: add Notion input adapter (Task 18.1, 18.2)

### 2025-12-04 - Day 1 (continued)
**Focus**: FlowBuilder UI Integration
**Hours**: 2.5h
**Completed**:
- [x] Task 18.8: Added Notion as input source option in FlowBuilder

**Changes Made**:
- Modified `layers/discubot/app/components/flows/FlowBuilder.vue`:
  - Added 'notion' to InputFormData sourceType union
  - Added notionToken and triggerKeyword fields to form state
  - Added isNotionInputModalOpen modal state
  - Added notionWebhookUrl computed property
  - Added testingNotionConnection state and testNotionConnection function
  - Added copyNotionWebhookUrl function
  - Updated inputSchema to validate Notion-specific fields
  - Updated resetInputForm to handle Notion source type
  - Updated saveInput to store Notion config in sourceMetadata
  - Added "Add Notion" button modal with complete form
  - Updated inputs list to show Notion icon and trigger keyword
- Created `layers/discubot/server/api/notion/test-connection.post.ts`:
  - Simple endpoint to verify Notion token validity
  - Calls Notion API GET /users/me
  - Returns bot info on success

### 2025-12-04 - Day 1 (continued)
**Focus**: Documentation - Notion Setup Guide
**Hours**: 1h
**Completed**:
- [x] Task 18.9: Created comprehensive Notion Input Setup Guide

**Notes**:
- Created `docs/guides/notion-input-setup-guide.md` (~600 lines)
- Comprehensive user-facing documentation for configuring Notion as input source
- Includes: architecture diagram, 6-step setup process, troubleshooting, environment variables
- Follows existing guide patterns (Slack, Figma)
- Covers: integration creation, webhook configuration, FlowBuilder setup, testing, production checklist
- Added advanced configuration section for multiple teams/databases
- Included performance characteristics and limitations
- Added FAQ and related documentation references
- Updated PROGRESS_TRACKER with task completion and statistics

---

## Decisions Log

### Decision 006: Configurable Trigger Keyword
**Date**: 2025-12-04
**Context**: How should users trigger Discubot in Notion comments?
**Decision**: Make trigger keyword configurable per flow (default: `@discubot`)
**Rationale**: Flexibility for teams (e.g., `@task`, `#todo`), consistent with other adapters
**Impact**: One additional config field, simple string matching

### Decision 007: Skip Status Updates for Notion
**Date**: 2025-12-04
**Context**: Other adapters add reactions/emojis to show processing status
**Decision**: `updateStatus()` will be a no-op for Notion adapter
**Rationale**: Notion API doesn't support reactions on comments
**Impact**: Simpler implementation, users get reply instead of status indicator

---

## Key Learnings

(To be updated as implementation progresses)

---

## References

- [Notion Webhooks Reference](https://developers.notion.com/reference/webhooks)
- [Notion Comments API](https://developers.notion.com/reference/comment-object)
- [Implementation Briefing](/docs/briefings/notion-input-implementation-brief.md)
- [Existing Slack Adapter](../layers/discubot/server/adapters/slack.ts)
- [Existing Figma Adapter](../layers/discubot/server/adapters/figma.ts)

---

### 2025-12-04 - Day 1 (continued)
**Focus**: Notion Adapter Unit Tests
**Hours**: 1h
**Completed**:
- [x] Task 18.10: Created comprehensive unit tests for Notion adapter

**Notes**:
- Created `tests/adapters/notion.test.ts` (~600 lines)
- 44 tests covering all adapter methods:
  - `checkForTrigger()` - 10 tests (plain text, case insensitivity, empty arrays, custom keywords)
  - `parseIncoming()` - 8 tests (valid payloads, block_id/page_id parents, missing fields, error handling)
  - `fetchThread()` - 6 tests (valid format, invalid format, empty thread, pagination, filtering, sorting)
  - `postReply()` - 4 tests (success, API error, missing discussion ID)
  - `validateConfig()` - 6 tests (valid configs, missing token, invalid format, source mismatch)
  - `testConnection()` - 6 tests (success, invalid token, network error)
  - `updateStatus()` - 2 tests (no-op behavior verification)
  - `sourceType` - 1 test
- All tests pass (44/44)
- Follows existing test patterns from Slack and Figma adapters
- Uses vi.mock() for $fetch mocking and logger mocking

---

**Last Updated**: 2025-12-04 (Task 18.10 completed)

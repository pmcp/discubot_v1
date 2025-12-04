# Source Platform Linking Brief

**Date**: 2024-12-04
**Status**: Ready for implementation
**Priority**: Medium

## Summary

Link author names and @mentions in Notion task content to the source platform (Figma/Slack) instead of leaving them as plain text.

## Problem

When creating Notion tasks from Figma/Slack discussions:
- `@Maarten Lauwaert` appears as plain text (not clickable)
- No way to navigate back to the source to see who is who
- Inconsistent formatting - some mentions tagged, some not

## Solution

Instead of Notion @mentions, link directly to the **source platform**:

| Element | Before | After |
|---------|--------|-------|
| Author name | `@Maarten Lauwaert:` (plain text) | `@Maarten Lauwaert:` (linked to Figma/Slack message) |
| @mention in content | `@Maarten Lauwaert needs to...` | `@Maarten Lauwaert needs to...` (linked) |

### Benefits
- Works for ALL users (no user mapping required)
- Provides direct access to source context
- Simpler than Notion @mentions
- Platform-agnostic approach

---

## URL Formats

### Figma
```
https://www.figma.com/file/{fileKey}#comment-{commentId}
```

### Slack
```
https://slack.com/app_redirect?team={slackTeamId}&channel={channelId}&message_ts={ts}
```

---

## Implementation

### Files to Modify

#### 1. `layers/discubot/server/services/notion.ts`

**Add URL builder helper:**

```typescript
function buildMessageUrl(
  sourceType: string,
  messageId: string,
  metadata: { fileKey?: string; channelId?: string; slackTeamId?: string }
): string | null {
  if (sourceType === 'figma' && metadata.fileKey) {
    return `https://www.figma.com/file/${metadata.fileKey}#comment-${messageId}`
  }
  if (sourceType === 'slack' && metadata.channelId && metadata.slackTeamId) {
    return `https://slack.com/app_redirect?team=${metadata.slackTeamId}&channel=${metadata.channelId}&message_ts=${messageId}`
  }
  return null
}
```

**Update `buildTaskContent()` signature:**

```typescript
function buildTaskContent(
  task: DetectedTask,
  thread: DiscussionThread,
  aiSummary: AISummary,
  config: NotionTaskConfig,
  userMentions?: Map<string, string>,
  sourceMetadata?: {                    // NEW
    sourceType: 'figma' | 'slack'
    fileKey?: string                    // Figma
    channelId?: string                  // Slack
    slackTeamId?: string                // Slack
  }
): any[]
```

**Update author name blocks (~lines 530, 568):**

```typescript
// Before
{ text: { content: `@${authorName}:` }, annotations: { bold: true } }

// After
const authorUrl = buildMessageUrl(config.sourceType, message.id, sourceMetadata)
{
  type: 'text',
  text: {
    content: `@${authorName}:`,
    link: authorUrl ? { url: authorUrl } : undefined
  },
  annotations: { bold: true, color: authorUrl ? 'blue' : 'default' }
}
```

#### 2. `layers/discubot/server/utils/emoji-converter.ts`

**Enhance `parseContentWithLinks()` to parse @mentions:**

```typescript
// Rename to parseContentWithMentionsAndLinks()
export function parseContentWithMentionsAndLinks(
  text: string,
  messageUrl?: string  // Link @mentions to this URL
): NotionRichText[] {
  // 1. Parse URLs (existing logic)
  // 2. Parse @Name patterns and link to messageUrl
}
```

**@mention regex:**
```typescript
// Match @Name where Name is one or more capitalized words
const mentionRegex = /@([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)/g
// Matches: @Maarten, @Maarten Lauwaert, @John Doe Smith
```

#### 3. `layers/discubot/server/services/processor.ts`

**Extract and pass metadata to Notion service:**

From Figma thread metadata:
- `fileKey` - available in `thread.metadata.fileKey`

From Slack thread metadata:
- `channelId` - available in `thread.metadata.channelId`
- `slackTeamId` - available in `thread.metadata.slackTeamId` or from flow input

---

## Implementation Steps

1. Add `buildMessageUrl()` helper function to notion.ts
2. Update `buildTaskContent()` signature to accept source metadata
3. Update author name rendering to use linked text (root message + replies)
4. Enhance `parseContentWithLinks()` → `parseContentWithMentionsAndLinks()` in emoji-converter.ts
5. Update message content parsing in notion.ts to pass the message URL
6. Update `createNotionTask()` and `createNotionTasks()` to accept and pass metadata
7. Update processor.ts to extract metadata from thread and pass to Notion service
8. Run `npx nuxt typecheck` to verify no type errors

---

## Testing

1. **Figma**: Process a thread → Click author name → Opens Figma at that comment
2. **Slack**: Process a thread → Click author name → Opens Slack at that message
3. **@mentions in content**: Click `@Maarten Lauwaert` in message text → Opens source
4. Verify root message and all replies have working links
5. Verify fallback to plain text when metadata is missing

---

## Data Available (Reference)

### Figma ThreadMessage (figma.ts:603-614)
```typescript
{
  id: comment.id,                    // Comment ID for deep links
  authorHandle: comment.user.id,     // Figma user UUID
  authorName: comment.user.handle,   // Display name
  content: comment.message,
}
```

### Slack ThreadMessage (slack.ts:646-652)
```typescript
{
  id: message.ts,                    // Timestamp = message ID
  authorHandle: message.user,        // Slack user ID (U123ABC456)
  content: message.text,
}
```

### Thread Metadata
```typescript
// Figma
{ fileKey: string }

// Slack (slack.ts:337-342)
{
  channelId: string,
  threadTs: string,
  slackTeamId: string,
}
```
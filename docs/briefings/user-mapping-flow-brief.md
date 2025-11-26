# User Mapping Flow-Aware UX Briefing

**Date**: 2025-11-26
**Status**: Planning
**Goal**: Create a flow-aware user mapping UX with discovery features for Slack and Figma

---

## Executive Summary

User mappings connect source platform users (Slack, Figma) to Notion users for proper @mention resolution. Currently, the mapping UI is disconnected from flows - users must manually enter workspace IDs with no discovery features.

**Current State**: Generic CRUD form, no context, manual entry of all fields
**Target State**: Flow-integrated UI with smart discovery per platform

### Key Benefits
- **Slack**: Auto-fetch all workspace members, match by email
- **Figma**: Bootstrap discovery via @mention webhook trick
- **Notion**: Already implemented user listing
- **UX**: Entry point from FlowBuilder, pre-filled context

---

## Problem Analysis

### Current Pain Points

1. **No Flow Context**: User mappings page doesn't know about flows or inputs
2. **Manual Entry**: Users must copy/paste workspace IDs manually
3. **No Discovery**: Can't see available users to map
4. **No Auto-Match**: No email-based matching suggestions

### What Exists Today

| Component | Status | Location |
|-----------|--------|----------|
| User mapping schema | ✅ Has `sourceWorkspaceId` | `/crouton/schemas/user-mapping-schema.json` |
| User mapping CRUD | ✅ Works | `/layers/discubot/collections/usermappings/` |
| Notion users API | ✅ Implemented | `/layers/discubot/server/api/notion/users.get.ts` |
| Slack OAuth | ✅ Works | Missing `users:read` scope |
| Figma adapter | ✅ Works | Doesn't parse @mentions yet |
| FlowBuilder | ✅ Works | No "Manage Users" button |

---

## Platform Capabilities Research

### Slack: Full Discovery Available

**API**: `users.list` - Returns all workspace members
**Required Scope**: `users:read`, `users:read.email` (currently commented out)
**Data Available**:
```json
{
  "id": "U12345ABC",
  "name": "john.doe",
  "real_name": "John Doe",
  "email": "john@company.com",
  "avatar": "https://..."
}
```

**Current State**: OAuth requests scopes but `users:read` is commented out at line 99 in `install.get.ts`

### Figma: No User Listing API

**API**: None - Figma doesn't provide workspace member listing
**Discovery Options**:
1. **Bootstrap Comment** (recommended) - User posts comment @mentioning everyone + bot
2. **Learn as you go** - Discover users from processed comments
3. **Manual entry** - User types email/name manually

**@Mention Format** (in Figma comment text):
```
Hey @[123456:john.smith] can you review this?
```
Where `123456` is the stable Figma user ID.

### Notion: Already Implemented

**API**: `GET /api/notion/users` - Returns all workspace members
**Status**: Fully working with pagination and bot filtering

---

## Proposed Architecture

### Entry Point: FlowBuilder Step 2

```
FlowBuilder (Step 2: Add Inputs)
    └── Each input card has actions: [Edit] [Delete] [Manage Users]
            │
            └── Click "Manage Users"
                    │
                    ├── Extract context from input:
                    │   - sourceType (slack/figma)
                    │   - sourceWorkspaceId (from sourceMetadata)
                    │   - apiToken (for API calls)
                    │
                    └── Open UserMappingDrawer (USlideover)
                            │
                            ├── if slack → SlackUserDiscovery
                            │     └── Side-by-side: Slack users ↔ Notion users
                            │
                            └── if figma → FigmaUserDiscovery
                                  └── Bootstrap mode OR manual entry
```

### sourceWorkspaceId Resolution

```typescript
function getSourceWorkspaceId(input: FlowInput): string {
  switch (input.sourceType) {
    case 'slack':
      // Stored during OAuth callback
      return input.sourceMetadata?.slackTeamId || ''
    case 'figma':
      // Use email slug as workspace identifier
      return input.emailAddress || input.emailSlug || ''
    default:
      return input.id
  }
}
```

---

## Feature 1: Slack User Discovery

### UX Flow

1. User clicks "Manage Users" on Slack input card
2. Drawer opens, fetches:
   - All Slack workspace members (via new API)
   - All Notion workspace members (existing API)
   - Existing mappings for this sourceWorkspaceId
3. Shows side-by-side matching interface
4. User clicks "Auto-Match by Email" - matches users with same email
5. User manually adjusts any mismatches
6. User clicks "Save" - creates/updates mappings

### UI Design

```
┌─────────────────────────────────────────────────────────────┐
│ User Mappings: Product Team Slack                           │
│ Workspace: T12345XYZ                                        │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐    ┌──────────────────────┐       │
│ │ Slack Users (15)     │    │ Notion Users (12)    │       │
│ │ [🔍 Search...]       │    │ [🔍 Search...]       │       │
│ ├──────────────────────┤    ├──────────────────────┤       │
│ │ ✅ @john.doe        │ →  │ John Doe             │ AUTO  │
│ │    john@example.com  │    │ john@example.com     │       │
│ │ ⚪ @jane.smith      │    │ [Select user... ▼]   │       │
│ │    jane@example.com  │    │                      │       │
│ │ ✅ @bob.wilson      │ →  │ Bob Wilson           │ AUTO  │
│ │    bob@example.com   │    │ bob@example.com      │       │
│ └──────────────────────┘    └──────────────────────┘       │
├─────────────────────────────────────────────────────────────┤
│ [⚡ Auto-Match by Email]  [💾 Save 2 Mappings]  [Cancel]   │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Tasks

1. **Enable `users:read` scope** (15min)
   - File: `/layers/discubot/server/api/oauth/slack/install.get.ts`
   - Uncomment line 99, add to SLACK_SCOPES array
   - Note: Existing integrations need re-auth

2. **Create Slack users endpoint** (45min)
   - File: `/layers/discubot/server/api/slack/users.get.ts` (NEW)
   - Call `users.list` API with bot token
   - Filter bots, deleted users
   - Return `{ users: [{ id, name, email, avatar }] }`

3. **Create SlackUserDiscovery component** (2h)
   - File: `/layers/discubot/app/components/usermappings/SlackUserDiscovery.vue`
   - Side-by-side layout
   - Auto-match button
   - NotionUserPicker integration

---

## Feature 2: Figma Bootstrap Discovery

### The Bootstrap Comment Trick

Since Figma has no user listing API, we use Figma's own @mention system to discover users:

1. User creates a comment in Figma: `"User sync: @everyone @discubot"` (mentioning team + bot)
2. Figma sends email notification to the bot (normal webhook flow)
3. Processor detects this is a "bootstrap" comment (mentions bot or has trigger phrase)
4. Parser extracts all @mentioned user IDs from comment text
5. Creates "pending" user mappings for each discovered user
6. User maps these to Notion users in the UI

### Detection Logic

```typescript
// In processor.ts - detect bootstrap comment
function isBootstrapComment(thread: DiscussionThread): boolean {
  const text = thread.rootMessage.text.toLowerCase()
  return (
    // Contains "sync" or "bootstrap" keyword
    text.includes('user sync') ||
    text.includes('bootstrap') ||
    // OR mentions the bot
    thread.rootMessage.text.includes('@discubot')
  )
}

// In figma.ts - extract @mentions
function extractMentionsFromComment(message: string): FigmaMention[] {
  const mentionRegex = /@\[([^:]+):([^\]]+)\]/g
  const mentions: FigmaMention[] = []

  let match
  while ((match = mentionRegex.exec(message)) !== null) {
    mentions.push({
      userId: match[1],      // Figma user ID
      displayName: match[2]  // Username
    })
  }

  return mentions
}
```

### Bootstrap Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    FIGMA FILE                               │
│                                                             │
│  📝 Comment: "User sync: @alice @bob @charlie @discubot"    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               EMAIL WEBHOOK ARRIVES                         │
│  From: comments-FILEKEY@email.figma.com                     │
│  Contains: @mentions in comment text                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  PROCESSOR                                  │
│  1. Detect: isBootstrapComment() → true                     │
│  2. Extract: extractMentionsFromComment()                   │
│  3. Store: Create pending user mappings                     │
│  4. Skip: Don't create Notion task for this comment         │
│  5. Reply: "Found 3 users. Map them in dashboard."          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                UI DASHBOARD                                 │
│  Shows discovered users ready for mapping                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Discovered from Figma (3):                         │    │
│  │ ⚠️ alice (123456)  →  [Select Notion user... ▼]   │    │
│  │ ⚠️ bob (789012)    →  [Select Notion user... ▼]   │    │
│  │ ⚠️ charlie (345678)→  [Select Notion user... ▼]   │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### UI Design

```
┌─────────────────────────────────────────────────────────────┐
│ User Mappings: Design Team Figma                            │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Figma doesn't have a user listing API.                  │
│                                                             │
│ Option 1: Create a bootstrap comment                        │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ In Figma, post a comment @mentioning everyone:       │   │
│ │ "User sync: @alice @bob @charlie @discubot"          │   │
│ │                                                       │   │
│ │ We'll detect the comment and discover the users.     │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Option 2: Add manually                                      │
│ ┌──────────────────────┐  ┌──────────────────────┐         │
│ │ Figma Email          │  │ Notion User          │         │
│ │ [designer@co.com   ] │  │ [Select user... ▼]   │         │
│ └──────────────────────┘  └──────────────────────┘         │
│                                       [+ Add Mapping]       │
├─────────────────────────────────────────────────────────────┤
│ Discovered Users (pending mapping):                         │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 🔵 alice (123456)     →  [Select user... ▼]    [Save]   ││
│ │ 🔵 bob (789012)       →  [Select user... ▼]    [Save]   ││
│ │ 🔵 charlie (345678)   →  [Jane Designer ▼]     [Save]   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ Existing Mappings (2):                                      │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ✅ david@co.com       →  David Developer       [Delete] ││
│ │ ✅ emma@co.com        →  Emma Engineer         [Delete] ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Implementation Tasks

1. **Add @mention parser** (1h)
   - File: `/layers/discubot/server/adapters/figma.ts`
   - Function: `extractMentionsFromComment(message: string)`
   - Extract user IDs and display names from `@[id:name]` format

2. **Add bootstrap detection** (30min)
   - File: `/layers/discubot/server/services/processor.ts`
   - Function: `isBootstrapComment(thread)`
   - Skip Notion task creation for bootstrap comments

3. **Store discovered users** (30min)
   - Create user mappings with `notionUserId: null` (pending)
   - Use mappingType: `'discovered'`
   - confidence: 0 until mapped

4. **Create FigmaUserDiscovery component** (2h)
   - File: `/layers/discubot/app/components/usermappings/FigmaUserDiscovery.vue`
   - Show instructions for bootstrap comment
   - Display discovered/pending users
   - Manual entry fallback

---

## Feature 3: Shared Components

### NotionUserPicker

Reusable dropdown for selecting Notion users:

```vue
<template>
  <USelectMenu
    v-model="selectedUser"
    :items="notionUsers"
    :loading="loading"
    searchable
    searchable-placeholder="Search users..."
  >
    <template #option="{ item }">
      <UAvatar :src="item.avatarUrl" size="xs" />
      <span class="ml-2">{{ item.name }}</span>
      <span class="ml-2 text-muted text-xs">{{ item.email }}</span>
    </template>
  </USelectMenu>
</template>
```

Props: `notionToken`, `teamId`
Emits: `update:modelValue` (Notion user object)

### UserMappingDrawer

Container component that routes to correct discovery UI:

```vue
<script setup lang="ts">
interface Props {
  open: boolean
  sourceType: 'slack' | 'figma'
  sourceWorkspaceId: string
  apiToken?: string
  notionToken: string
  teamId: string
}
</script>

<template>
  <USlideover v-model:open="open">
    <template #header>
      User Mappings: {{ inputName }}
    </template>

    <SlackUserDiscovery
      v-if="sourceType === 'slack'"
      :workspace-id="sourceWorkspaceId"
      :api-token="apiToken"
      :notion-token="notionToken"
      :team-id="teamId"
    />

    <FigmaUserDiscovery
      v-else-if="sourceType === 'figma'"
      :workspace-id="sourceWorkspaceId"
      :notion-token="notionToken"
      :team-id="teamId"
    />
  </USlideover>
</template>
```

---

## FlowBuilder Integration

### Add "Manage Users" Button

Location: `/layers/discubot/app/components/flows/FlowBuilder.vue`

In the input card actions (near line 1270):

```vue
<div class="flex gap-2">
  <UButton
    icon="i-lucide-users"
    variant="ghost"
    size="xs"
    @click="openUserMappingDrawer(index)"
  />
  <UButton
    icon="i-lucide-pencil"
    variant="ghost"
    size="xs"
    @click="openEditInput(index)"
  />
  <UButton
    icon="i-lucide-trash"
    variant="ghost"
    size="xs"
    color="error"
    @click="deleteInput(index)"
  />
</div>
```

### Extract Context

```typescript
function openUserMappingDrawer(index: number) {
  const input = inputsList.value[index]

  // Get workspace ID based on source type
  const sourceWorkspaceId = input.sourceType === 'slack'
    ? input.sourceMetadata?.slackTeamId
    : input.emailAddress || input.emailSlug

  // Get Notion token from first Notion output
  const notionOutput = outputsList.value.find(o => o.outputType === 'notion')
  const notionToken = notionOutput?.outputConfig?.notionToken

  userMappingContext.value = {
    sourceType: input.sourceType,
    sourceWorkspaceId,
    apiToken: input.apiToken,
    notionToken,
    inputName: input.name,
  }

  isUserMappingDrawerOpen.value = true
}
```

---

## Task Breakdown

### Phase 1: Backend (~3h)

| Task | Time | Description |
|------|------|-------------|
| 1.1 | 15min | Enable Slack `users:read` scope |
| 1.2 | 45min | Create `/api/slack/users.get.ts` endpoint |
| 1.3 | 1h | Add Figma @mention parser to adapter |
| 1.4 | 30min | Add bootstrap comment detection to processor |
| 1.5 | 30min | Store discovered users as pending mappings |

### Phase 2: Composables (~1h)

| Task | Time | Description |
|------|------|-------------|
| 2.1 | 20min | Create `useSlackUsers.ts` |
| 2.2 | 20min | Create `useNotionUsers.ts` wrapper |
| 2.3 | 20min | Create `useAutoMatch.ts` |

### Phase 3: Components (~5h)

| Task | Time | Description |
|------|------|-------------|
| 3.1 | 1h | Create `NotionUserPicker.vue` |
| 3.2 | 45min | Create `UserMappingTable.vue` |
| 3.3 | 45min | Create `UserMappingDrawer.vue` |
| 3.4 | 2h | Create `SlackUserDiscovery.vue` |
| 3.5 | 2h | Create `FigmaUserDiscovery.vue` |

### Phase 4: Integration (~1.5h)

| Task | Time | Description |
|------|------|-------------|
| 4.1 | 45min | Add "Manage Users" button to FlowBuilder |
| 4.2 | 30min | Wire up context extraction |
| 4.3 | 15min | Add toast notifications |

### Phase 5: Testing (~1h)

| Task | Time | Description |
|------|------|-------------|
| 5.1 | 15min | Run `npx nuxt typecheck` |
| 5.2 | 30min | Test Slack flow with re-auth |
| 5.3 | 30min | Test Figma bootstrap flow |

**Total Estimate: 11-13 hours**

---

## Data Model Reference

### User Mapping Schema

```typescript
interface UserMapping {
  id: string
  teamId: string
  sourceType: 'slack' | 'figma'
  sourceWorkspaceId: string      // Slack team ID or Figma email slug
  sourceUserId: string           // Slack user ID or Figma user ID
  sourceUserEmail?: string       // For email matching
  sourceUserName?: string        // Display name
  notionUserId: string | null    // null = pending mapping
  notionUserName?: string
  notionUserEmail?: string
  mappingType: 'manual' | 'auto-email' | 'discovered'
  confidence: number             // 0-1, 1.0 for auto-email match
  active: boolean
  createdAt: Date
  updatedAt: Date
}
```

---

## Open Questions

1. **Re-authorization UX**: How to prompt users to re-authorize Slack for new scopes?
   - Recommendation: Show banner in drawer with "Re-authorize" button

2. **Multiple Notion outputs**: Which token to use if flow has multiple Notion outputs?
   - Recommendation: Use first Notion output, show picker if multiple

3. **Bootstrap comment reply**: Should bot reply to bootstrap comment?
   - Recommendation: Yes, reply with "Found X users. Map them in your dashboard."

---

## Success Criteria

- [ ] User can click "Manage Users" on any flow input
- [ ] Slack: All workspace members displayed and auto-matchable by email
- [ ] Figma: Bootstrap comment flow works to discover users
- [ ] Mappings saved with correct `sourceWorkspaceId`
- [ ] Existing mappings displayed and editable
- [ ] Typecheck passes

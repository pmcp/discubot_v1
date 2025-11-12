# Discubot: Architecture & Design Brief

**Project**: Discubot - Universal Discussion-to-Notion Sync System
**Date**: 2025-11-11
**Status**: Design Phase (Revised - Lean Architecture)
**Framework**: Nuxt 4 + Nuxt-Crouton + SuperSaaS
**Version**: 2.1 (rebuild from figno proof-of-concept)
**Architecture**: Lean MVP approach - 5 collections, 2 layers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Goals](#design-goals)
3. [Learnings from Figno Proof-of-Concept](#learnings-from-figno)
4. [Core Architecture](#core-architecture)
5. [Source Adapter Pattern](#source-adapter-pattern)
6. [Layer Separation Strategy](#layer-separation-strategy)
7. [Data Flow](#data-flow)
8. [Security Architecture](#security-architecture)
9. [Team Management with SuperSaaS](#team-management)
10. [Key Architectural Decisions](#key-decisions)
11. [Technology Stack](#technology-stack)

---

## Executive Summary

Discubot is a universal discussion-to-task synchronization system that connects multiple collaboration platforms (Figma, Slack, Discord, etc.) with Notion task management. Built on Nuxt 4 and leveraging the Nuxt-Crouton CRUD framework, it uses a source adapter pattern to enable rapid addition of new discussion sources while maintaining a consistent AI-powered processing pipeline.

### Key Innovation: Source Adapter Pattern

Unlike the figno proof-of-concept which was tightly coupled to Figma, Discubot abstracts discussion sources behind a common interface. This allows:
- Adding new sources (Slack, Linear, GitHub) without touching core logic
- Reusing AI summarization and Notion integration across all sources
- Maintaining consistency in output format and user experience
- Rapid prototyping using Crouton-generated CRUD scaffolding

### System Flow

```
Discussion Source (Figma/Slack/etc.)
    ↓
Source Adapter (parses + validates)
    ↓
Unified Processing Pipeline (AI + Notion)
    ↓
Task Creation in Notion
    ↓
Confirmation back to Source
```

---

## Design Goals

### 1. **Generic & Extensible**
- Abstract "discussion source" pattern works for any service
- Adding a new source = implementing a simple adapter interface
- Core processing logic is source-agnostic

### 2. **Crouton-First Approach**
- Use `@friendlyinternet/nuxt-crouton` for all CRUD operations
- Auto-generate forms, tables, APIs, and database schemas
- Focus manual development on adapters and business logic

### 3. **SuperSaaS Multi-Tenancy**
- Team-based isolation via `nuxt-crouton-connector`
- Each team has separate configurations and data
- Automatic team scoping on all queries

### 4. **AI-Powered Intelligence**
- Claude AI for summarization and task detection
- Multi-task identification from single discussions
- Context-aware summary generation

### 5. **Production-Ready from Day One**
- Built on proven patterns from figno
- Robust error handling with retry logic
- Comprehensive logging and monitoring
- Progressive enhancement (add complexity as needed)

### 6. **Maintainable & Scalable**
- Clear separation of concerns (layers)
- Consistent patterns throughout codebase
- Easy to onboard new developers
- Horizontal scaling via Cloudflare Workers

---

## Learnings from Figno

### What Worked Well ✅

#### 1. **Fire-and-Forget Webhook Pattern**
```typescript
// Webhook handler returns 200 OK immediately
export default defineEventHandler(async (event) => {
  // 1. Verify signature
  // 2. Create job in KV
  // 3. Trigger async processor
  return { ok: true } // < 3 seconds
})
```

**Why it works:**
- Prevents webhook timeouts
- Source platform doesn't retry
- Actual processing happens in background

#### 2. **Circuit Breaker for External APIs** ⏳ *Deferred to Phase 6*
```typescript
// From figno - proven effective but adds complexity
// For MVP: Use simple retry logic with exponential backoff
// Add circuit breaker when scale demands it
class CircuitBreaker {
  // Opens after 3 failures
  // Stays open for 30 seconds
  // Prevents cascade failures
}
```

**Why it worked in figno:**
- Protects against API outages
- Prevents queue backup
- Graceful degradation

**Why deferred for MVP:**
- Adds complexity before scale problems exist
- Simple retry logic sufficient for initial launch
- Can add when monitoring shows it's needed

#### 3. **AI Response Caching** 🔧 *Simplified for MVP*
```typescript
// MVP: Simple Map-based cache (single-server deployment)
const summaryCache = new Map<string, { summary: string, timestamp: number }>()

async function getCachedSummary(thread: Thread) {
  const key = JSON.stringify(thread.messages)
  const cached = summaryCache.get(key)

  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.summary
  }

  const summary = await claudeAPI.summarize(thread)
  summaryCache.set(key, { summary, timestamp: Date.now() })
  return summary
}

// Future: Upgrade to KV when deploying multi-region
```

**Why Map-based for MVP:**
- No external dependencies (KV)
- Works perfectly for single-server deployment
- Dramatically reduces API costs
- Faster response times
- Handles duplicate requests
- Can upgrade to KV in Phase 6 if multi-region deployment requires it

#### 4. **Multi-Task Detection**
```typescript
// AI can identify multiple tasks from one discussion
const result = await ai.detectTasks(thread)
// result.isMultiTask = true
// result.tasks = [
//   { title: "Fix login button", priority: "high" },
//   { title: "Update docs", priority: "low" }
// ]
```

**Why it works:**
- Single discussion → multiple actionable tasks
- Reduces manual task creation
- Better captures discussion outcomes

#### 5. **Rate Limiting Notion API**
```typescript
// Sequential task creation with delays
for (const task of tasks) {
  await notion.createTask(task)
  await delay(200) // Prevent throttling
}
```

**Why it works:**
- Respects Notion's 3 req/sec limit
- Prevents 429 rate limit errors
- Ensures all tasks get created

### What Needs Improvement ❌

#### 1. **Tight Coupling to Figma**
```typescript
// figno/server/services/figma.ts - Figma-specific
// figno/server/utils/emailParser.ts - Email-specific
// figno/server/database/schema.ts - 10 Figma-specific tables
```

**Problem:** Hard to add Slack without duplicating code

**Solution:** Abstract source interface, shared services

#### 2. **Configuration Sprawl**
```typescript
// 10+ database tables just for figno
fignoTeamConfigs
fignoAgents
fignoMonitoredFiles
fignoSyncJobs
fignoCommentThreads
fignoEmailConfigs
// ... and more
```

**Problem:** Complex relationships, hard to maintain

**Solution:** 4 generic collections with clear purpose
- discussions (with embedded thread data)
- configs (team-specific settings)
- jobs (processing tracking)
- tasks (audit trail + backup)

#### 3. **Limited Reusability**
```typescript
// AI service is good but Figma-centric in places
// Notion service works but not configurable
// Email parsing can't be reused for Slack
```

**Problem:** Can't easily port to other sources

**Solution:** Generic interfaces, dependency injection

---

## Core Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  DISCUSSION SOURCES                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Figma   │  │  Slack   │  │  Linear  │  │  Future  │   │
│  │  Email   │  │  Webhook │  │  Webhook │  │  Sources │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼──────────────┼──────────┘
        │             │             │              │
        └─────────────┴─────────────┴──────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│              SOURCE ADAPTERS (Plugin System)                 │
│  Each adapter implements:                                    │
│  - parseIncoming() → ParsedDiscussion                       │
│  - fetchThread() → DiscussionThread                         │
│  - postReply() → boolean                                    │
│  - updateStatus() → boolean                                 │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│            UNIFIED PROCESSING PIPELINE                       │
│  1. Discussion ingestion → discussions collection            │
│  2. Thread building → embedded in discussions.threadData     │
│  3. AI analysis (Claude) → summary + tasks                  │
│  4. Task creation (Notion) → tasks collection               │
│  5. Status update → source adapter                          │
│  6. Job tracking → jobs collection                      │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│           CROUTON-GENERATED COLLECTIONS (5 Total)            │
│  - discussions: Raw discussion + embedded thread data        │
│  - configs: Team-specific source settings             │
│  - jobs: Job queue and status tracking                  │
│  - tasks: Created Notion tasks (audit trail + backup)       │
│  - userMappings: Source user → Notion user mappings         │
│                                                              │
│  Removed for simplicity (MVP):                              │
│  - threads: Embedded as JSON in discussions.threadData      │
│  - sources: Hardcoded in adapter files (Figma, Slack)       │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL INTEGRATIONS                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Notion     │  │  Claude AI   │  │  SuperSaaS   │      │
│  │   API        │  │  API         │  │  Teams       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Source Adapters (Manual)
- Parse incoming webhooks/emails
- Fetch complete thread data
- Post replies/confirmations
- Update status indicators (reactions)
- Validate source-specific configuration

#### Core Services (Manual - ported from figno)
- **AI Service**: Claude integration, caching, multi-task detection
- **Notion Service**: Task creation, rate limiting, field mapping
- **Processor Service**: Orchestrates the 7-stage pipeline

#### Collections (Generated by Crouton)
- **Forms**: Create/edit interfaces with validation
- **Tables**: List views with sorting, filtering, pagination
- **APIs**: RESTful endpoints for all CRUD operations
- **Composables**: Type-safe data fetching and mutations
- **Schemas**: Drizzle ORM database definitions

---

## Source Adapter Pattern

### The Problem

Each discussion platform has different:
- **Ingestion methods**: Email (Figma), Webhooks (Slack), Polling (Linear)
- **Data formats**: HTML emails, JSON payloads, GraphQL
- **Threading models**: Nested replies, flat threads, comment IDs
- **Authentication**: API tokens, OAuth, session cookies
- **Status updates**: Reactions (Figma), Emoji (Slack), Status fields (Linear)

### The Solution: Adapter Interface

All sources implement a standardized interface:

```typescript
// server/adapters/base.ts
export interface DiscussionSourceAdapter {
  // Unique identifier for this source type
  sourceType: 'figma' | 'slack' | 'linear' | 'github' | string

  // Parse incoming webhook/email into standardized format
  parseIncoming(payload: any): Promise<ParsedDiscussion>

  // Fetch full thread details from source
  fetchThread(
    threadId: string,
    config: SourceConfig
  ): Promise<DiscussionThread>

  // Post a reply back to the source
  postReply(
    threadId: string,
    message: string,
    config: SourceConfig
  ): Promise<boolean>

  // Update status indicators (reactions, emoji, status field)
  updateStatus(
    threadId: string,
    status: DiscussionStatus,
    config: SourceConfig
  ): Promise<boolean>

  // Validate source configuration
  validateConfig(config: SourceConfig): Promise<ValidationResult>

  // Health check
  testConnection(config: SourceConfig): Promise<boolean>
}
```

### Standardized Data Structures

All adapters output the same format:

```typescript
interface ParsedDiscussion {
  sourceType: string
  sourceThreadId: string      // Unique ID in source system
  sourceUrl: string           // Deep link to discussion
  teamId: string              // Resolved team
  authorHandle: string        // User who created
  title: string               // Subject/title
  content: string             // Main content
  participants: string[]      // All participants
  timestamp: Date
  metadata: Record<string, any>  // Source-specific data
}

interface DiscussionThread {
  id: string
  rootMessage: ThreadMessage
  replies: ThreadMessage[]
  participants: string[]
  metadata: Record<string, any>
}

interface ThreadMessage {
  id: string
  authorHandle: string
  content: string
  timestamp: Date
  attachments?: Attachment[]
}
```

### Adapter Implementations

#### Figma Adapter
```typescript
// server/adapters/figma.ts
export class FigmaAdapter implements DiscussionSourceAdapter {
  sourceType = 'figma'

  async parseIncoming(payload: MailgunPayload): Promise<ParsedDiscussion> {
    // Parse HTML email using cheerio
    // Extract file key from sender or links
    // Classify email type (comment vs invitation)
    // Return standardized ParsedDiscussion
  }

  async fetchThread(
    fileKey: string,
    commentId: string,
    config: SourceConfig
  ): Promise<DiscussionThread> {
    // Call Figma API: GET /v1/files/{fileKey}/comments
    // Find matching comment by text similarity (fuzzy match)
    // Build thread (root + replies)
    // Return DiscussionThread
  }

  async postReply(
    fileKey: string,
    commentId: string,
    message: string,
    config: SourceConfig
  ): Promise<boolean> {
    // POST /v1/files/{fileKey}/comments
    // parent_id: commentId
    // message: confirmation text with Notion link
  }

  async updateStatus(
    fileKey: string,
    commentId: string,
    status: DiscussionStatus,
    config: SourceConfig
  ): Promise<boolean> {
    // Map status to reactions:
    // processing → 👀 (eyes)
    // completed → ✅ (white_check_mark)
    // failed → ❌ (x)
    // POST /v1/files/{fileKey}/comments/{commentId}/reactions
  }
}
```

#### Slack Adapter
```typescript
// server/adapters/slack.ts
export class SlackAdapter implements DiscussionSourceAdapter {
  sourceType = 'slack'

  async parseIncoming(payload: SlackEventPayload): Promise<ParsedDiscussion> {
    // Verify Slack signature
    // Extract app_mention event
    // Parse channel, thread_ts, user, text
    // Return ParsedDiscussion
  }

  async fetchThread(
    channelId: string,
    threadTs: string,
    config: SourceConfig
  ): Promise<DiscussionThread> {
    // Call Slack API: conversations.replies
    // channel: channelId, ts: threadTs
    // Build thread from messages
    // Return DiscussionThread
  }

  async postReply(
    channelId: string,
    threadTs: string,
    message: string,
    config: SourceConfig
  ): Promise<boolean> {
    // POST chat.postMessage
    // channel: channelId, thread_ts: threadTs
    // text: confirmation with Notion link
  }

  async updateStatus(
    channelId: string,
    messageTs: string,
    status: DiscussionStatus,
    config: SourceConfig
  ): Promise<boolean> {
    // reactions.add
    // Map status to emoji (eyes, white_check_mark, x)
  }
}
```

### Adapter Benefits

1. **Isolation**: Each source is self-contained, changes don't affect others
2. **Testability**: Can mock adapters easily for testing
3. **Extensibility**: New sources = new adapter class, no core changes
4. **Consistency**: All sources produce same output format
5. **Flexibility**: Adapters can have source-specific optimizations

---

## User Mapping & Mention Resolution

### The Problem

When discussions from Slack or Figma mention users (e.g., `<@U123ABC456>` in Slack or `@user@example.com` in Figma), we need to properly @mention those users in the created Notion tasks. However, user IDs differ across platforms:
- **Slack**: User IDs like `U123ABC456`
- **Figma**: Email handles like `user@example.com`
- **Notion**: UUIDs like `b2e19928-b427-4aad-9a9d-fde65479b1d9`

### The Solution: User Mapping Collection

A dedicated `userMappings` collection maps external user identities to Notion users:

```typescript
interface UserMapping {
  sourceType: 'slack' | 'figma'
  sourceUserId: string           // U123ABC456 or user@example.com
  sourceTeamId: string            // T123ABC456 or file key
  notionUserId: string            // Notion UUID
  displayName: string             // Cached name
  email: string                   // For matching
  sourceProfile: json             // Full profile cache
  lastSyncedAt: Date
  active: boolean
}
```

### Mention Resolution Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: DETECT MENTIONS                                   │
│  Slack message: "Hey <@U123ABC456>, can you review this?"  │
│  Regex: /<@(U[A-Z0-9]+)>/g                                 │
│  Extracted: ["U123ABC456"]                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: RESOLVE TO NOTION USER                            │
│  Look up userMappings:                                      │
│    sourceType="slack"                                       │
│    sourceUserId="U123ABC456"                                │
│    sourceTeamId="T123ABC456"                                │
│  Result: notionUserId="b2e19928-..."                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 3: CREATE NOTION MENTION OBJECT                      │
│  {                                                          │
│    type: "mention",                                         │
│    mention: {                                               │
│      type: "user",                                          │
│      user: { id: "b2e19928-..." }                         │
│    },                                                       │
│    plain_text: "@John Doe"                                 │
│  }                                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 4: INSERT INTO NOTION TASK                           │
│  Notion page rich_text:                                     │
│  [                                                          │
│    { type: "text", text: { content: "Hey " } },           │
│    { type: "mention", ... },  ← Proper @mention           │
│    { type: "text", text: { content: ", can you..." } }    │
│  ]                                                          │
│  Result: User gets notified in Notion! 🔔                  │
└─────────────────────────────────────────────────────────────┘
```

### Slack OAuth Scope Enhancement

To fetch user information from Slack, we need the `users:read.email` scope:

```typescript
// server/api/oauth/slack/install.get.ts
const SLACK_SCOPES = [
  'channels:history',
  'chat:write',
  'reactions:write',
  'app_mentions:read',
  'im:history',
  'mpim:history',
  'users:read',        // Read basic user info
  'users:read.email'   // NEW: Required to fetch email for matching
]
```

### User Info Caching

The system caches user profile data to avoid repeated API calls:

```typescript
// server/services/userMapping.ts
export async function getOrCreateUserMapping(
  slackUserId: string,
  slackTeamId: string,
  config: SourceConfig
): Promise<UserMapping> {
  // 1. Check if mapping exists in database
  let mapping = await db.query.userMappings.findFirst({
    where: and(
      eq(userMappings.sourceType, 'slack'),
      eq(userMappings.sourceUserId, slackUserId),
      eq(userMappings.sourceTeamId, slackTeamId)
    )
  })

  // 2. If found and fresh (< 24 hours), return cached
  if (mapping && isRecent(mapping.lastSyncedAt, 24 * 60 * 60 * 1000)) {
    return mapping
  }

  // 3. Otherwise, fetch from Slack API
  const userInfo = await fetchSlackUserInfo(slackUserId, config.apiToken)

  // 4. Attempt to match Notion user by email
  const notionUserId = await matchNotionUserByEmail(
    userInfo.profile.email,
    config.notionToken
  )

  // 5. Create or update mapping
  if (!mapping && notionUserId) {
    mapping = await db.insert(userMappings).values({
      sourceType: 'slack',
      sourceUserId: slackUserId,
      sourceTeamId: slackTeamId,
      notionUserId,
      displayName: userInfo.real_name,
      email: userInfo.profile.email,
      sourceProfile: userInfo,
      lastSyncedAt: new Date(),
      active: true
    }).returning()
  } else if (mapping) {
    // Update existing
    await db.update(userMappings)
      .set({
        displayName: userInfo.real_name,
        email: userInfo.profile.email,
        sourceProfile: userInfo,
        lastSyncedAt: new Date()
      })
      .where(eq(userMappings.id, mapping.id))
  }

  return mapping
}
```

### Fallback Strategy

If no user mapping is found:
1. Show plain text username instead: `@username` (not a Notion mention)
2. Log warning for admin to create mapping
3. Task is still created successfully (graceful degradation)
4. No notification sent to Notion user

### Manual vs Automatic Mapping

**Automatic (Preferred):**
- Match by email address automatically
- Happens on first mention detection
- Requires `users:read.email` scope (Slack) or email in comments (Figma)

**Manual (Fallback):**
- Admin creates mappings in Admin UI
- Useful when emails don't match
- Supports multiple source workspaces → same Notion user

### Admin UI for User Mappings

**List Page** (`/dashboard/[team]/discubot/user-mappings.vue`):
- Show all user mappings with filters
- Display: source type, source user, display name, Notion user, last synced
- Actions: Edit, Sync now, Delete

**Form** (Crouton-generated + enhanced):
- Select source type (Slack/Figma)
- Input source user ID or select from fetched list
- Select Notion user from dropdown (fetched via `users.list` API)
- Auto-sync profile data button
- Bulk import: Fetch all workspace users, attempt email matching

---

## Layer Separation Strategy

### Project Structure (Lean 2-Layer Approach)

```
discubot_v1/                           # Main project (SuperSaaS template)
├── layers/
│   ├── discussion/        # Crouton-generated (NEVER manually edit)
│   │   ├── collections/
│   │   │   ├── discussions/           # Generated by Crouton
│   │   │   ├── configs/               # Generated by Crouton
│   │   │   ├── jobs/                  # Generated by Crouton
│   │   │   └── tasks/                 # Generated by Crouton
│   │   └── nuxt.config.ts
│   │
│   └── discussion/                    # Manual code (business logic)
│       ├── server/
│       │   ├── services/
│       │   │   ├── ai.ts              # Claude AI (from figno) + Map cache
│       │   │   ├── notion.ts          # Notion integration (from figno)
│       │   │   └── processor.ts       # 7-stage pipeline orchestration
│       │   ├── adapters/
│       │   │   ├── base.ts            # Abstract adapter interface
│       │   │   ├── figma.ts           # FigmaAdapter implementation
│       │   │   └── slack.ts           # SlackAdapter implementation
│       │   ├── api/
│       │   │   ├── webhook/
│       │   │   │   ├── figma.post.ts  # Mailgun webhook
│       │   │   │   └── slack.post.ts  # Slack Events API
│       │   │   └── internal/
│       │   │       └── process.post.ts # Background processor
│       │   └── utils/
│       │       ├── emailParser.ts     # Figma email parsing
│       │       └── retry.ts           # Simple exponential backoff
│       ├── types/
│       │   └── index.ts               # Shared TypeScript types
│       ├── components/                # Custom UI (extends Crouton)
│       └── nuxt.config.ts
│
├── crouton.config.mjs                 # Crouton generator config
├── crouton/
│   ├── schemas/                       # Collection schemas (4 total)
│   │   ├── discussion-schema.json     # With embedded threadData
│   │   ├── config-schema.json
│   │   ├── job-schema.json
│   │   └── task-schema.json
│   └── crouton.config.mjs
└── nuxt.config.ts
```

### Why This Separation?

#### **discussion/** (Generated - NEVER Manually Edit)
All CRUD operations for data management, auto-generated by Crouton.

**Responsibilities:**
- Database schemas (Drizzle ORM) for 4 collections
- REST APIs (GET/POST/PATCH/DELETE)
- Forms (Create/Edit with validation)
- Tables (List views with filtering)
- Composables (Type-safe data fetching)

**Why separate:**
- Fully regenerable by Crouton
- Can upgrade Crouton version easily
- Manual code doesn't pollute generated code
- Clear boundary: DON'T TOUCH THIS LAYER

**Collections:**
- discussions (with embedded threadData)
- configs (team-specific settings)
- jobs (7-stage pipeline tracking)
- tasks (audit trail + backup)

#### **discussion/** (Manual - All Business Logic)
All custom code, services, adapters, and UI.

**Responsibilities:**
- **Services**: AI (Claude), Notion, Processor (7-stage pipeline)
- **Adapters**: Base interface, Figma, Slack implementations
- **Webhooks**: Figma email, Slack events
- **Utilities**: Email parsing, retry logic
- **Types**: Shared TypeScript definitions
- **Components**: Custom UI extending Crouton

**Why consolidated:**
- Simpler navigation (one place for all manual code)
- Easier imports (no layer hopping)
- Both adapters in same location (easy comparison)
- Can still refactor to separate layers later if needed
- Follows KISS principle: start simple

**Source Types (Hardcoded):**
```typescript
// No database table needed - just constants
const SOURCE_TYPES = {
  FIGMA: {
    id: 'figma',
    name: 'Figma',
    adapterClass: FigmaAdapter,
    icon: '🎨',
    requiresEmail: true
  },
  SLACK: {
    id: 'slack',
    name: 'Slack',
    adapterClass: SlackAdapter,
    icon: '💬',
    requiresWebhook: true
  }
}
```

### Layer Dependencies

```
discussion/ ──→ discussion/
  ├─ services/
  ├─ adapters/
  ├─ api/
  └─ components/
```

**Rules:**
1. `discussion/` depends on `discussion/` (for types, composables)
2. `discussion/` has no dependencies (pure Crouton)
3. All manual code lives in `discussion/`
4. All generated code lives in `discussion/`

### File Regeneration Strategy

**Generated (Never Manual Edit):**
- `layers/discubot/collections/**/*` - All Crouton output (~100 files)

**Manual (Safe to Edit):**
- `layers/discubot/**/*` - All business logic, services, adapters
- `crouton/schemas/*.json` - 4 collection definitions
- `crouton/crouton.config.mjs` - Generator configuration

**When to Regenerate:**
1. Schema changes → Re-run `npx crouton-generate`
2. New collection (rare) → Update crouton.config.mjs, regenerate
3. Crouton version upgrade → Regenerate all collections

**File Counts:**
- Generated: ~100 files (4 collections × ~25 files each)
- Manual: ~20-30 files (services, adapters, webhooks, utils)

---

## Data Flow

### Complete Processing Pipeline (7 Stages)

```
┌─────────────────────────────────────────────────────────┐
│  STAGE 1: INGESTION                                     │
│  Source: Figma/Slack/etc. → Webhook → Adapter          │
│  Output: discussions record (status: pending)           │
│  Duration: < 3 seconds (fire-and-forget)                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 2: JOB CREATION                                  │
│  Create jobs record (status: pending)                   │
│  Store job ID in discussions.syncJobId                  │
│  Trigger background processor                           │
│  Duration: < 1 second                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 3: THREAD BUILDING                               │
│  Processor: Fetch full thread via adapter.fetchThread() │
│  Update jobs (stage: thread_building)               │
│  Create threads record with rootMessage + replies       │
│  Output: threads record (status: pending)               │
│  Duration: 2-5 seconds (depends on thread length)       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 4: AI ANALYSIS                                   │
│  Update jobs (stage: ai_analysis)                   │
│  Call Claude AI:                                        │
│    1. generateSummary(thread) → summary + key points   │
│    2. detectTasks(thread) → isMultiTask + tasks[]      │
│  Update threads record: aiSummary, detectedTasks        │
│  Output: threads record (status: analyzed)              │
│  Duration: 3-8 seconds (depends on thread length)       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 5: TASK CREATION                                 │
│  Update jobs (stage: task_creation)                     │
│  For each detected task:                                │
│    1. Create Notion page via Notion API                │
│    2. Create tasks record (notionPageId, url, etc.)    │
│    3. Add task ID to jobs.taskIds[]                    │
│    4. Wait 200ms (rate limiting)                       │
│  Output: tasks records (status: todo)                   │
│  Duration: 1-3 seconds per task                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 6: NOTIFICATION                                  │
│  Update jobs (stage: notification)                      │
│  Build confirmation message:                            │
│    Single: "✅ Task created: {title}\n🔗 {notionUrl}" │
│    Multi:  "✅ Created {N} tasks:\n1. ...\n2. ..."    │
│  Call adapter.postReply(threadId, message)              │
│  Call adapter.updateStatus(threadId, 'completed')       │
│  Update threads (status: notified)                      │
│  Duration: 1-2 seconds                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 7: COMPLETION                                    │
│  Update jobs:                                           │
│    - status: completed                                  │
│    - completedAt: now                                   │
│    - processingTime: duration                           │
│  Update discussions (status: completed, processedAt)    │
│  Total Duration: 10-20 seconds (end-to-end)             │
└─────────────────────────────────────────────────────────┘
```

### Error Handling Flow

```
ANY STAGE FAILS
│
├─ Update jobs:
│    - status: failed or retrying
│    - error: error message
│    - errorStack: stack trace
│    - attempts++
│
├─ Circuit Breaker Check:
│    └─ If open → Fail fast, don't retry
│
├─ If attempts < maxAttempts (3):
│    ├─ Calculate backoff: Math.pow(2, attempts) * 1000ms
│    ├─ Wait exponentially (1s, 2s, 4s)
│    └─ Retry from current stage
│
└─ If attempts >= maxAttempts:
     ├─ Update jobs (status: failed)
     ├─ Update discussions (status: failed)
     ├─ Call adapter.updateStatus(threadId, 'failed')
     ├─ Optionally post error message to source
     └─ Move to dead letter queue for manual review
```

### Real-World Example: Figma Comment

```
1. Designer mentions bot in Figma comment
   └─ "@DiscubotAI please create a task for this"

2. Figma sends email to comments-team1@domain.com
   └─ Mailgun receives, forwards to /api/webhook/figma

3. STAGE 1: Ingestion (2 seconds)
   ├─ Webhook verifies signature
   ├─ FigmaAdapter.parseIncoming(mailPayload)
   ├─ Creates discussion record:
   │   - sourceType: 'figma'
   │   - sourceThreadId: 'file_abc:comment_123'
   │   - teamId: 'team1' (from email)
   │   - title: 'Discussion about login button'
   │   - status: 'pending'
   └─ Returns 200 OK to Mailgun

4. STAGE 2: Job Creation (1 second)
   ├─ Creates syncJob record
   ├─ Links to discussion
   └─ Triggers /api/internal/process-discussion

5. STAGE 3: Thread Building (3 seconds)
   ├─ FigmaAdapter.fetchThread(fileKey, commentId, config)
   ├─ Calls Figma API: GET /v1/files/{fileKey}/comments
   ├─ Finds comment by fuzzy text match
   ├─ Builds thread with root + 2 replies
   └─ Creates threads record with 3 messages

6. STAGE 4: AI Analysis (5 seconds)
   ├─ AIService.generateSummary(thread)
   │   └─ "Discussion about making login button bigger and blue"
   ├─ AIService.detectTasks(thread)
   │   └─ Single task detected, isMultiTask: false
   └─ Updates threads record with AI data

7. STAGE 5: Task Creation (2 seconds)
   ├─ NotionService.createTask({
   │     title: "Make login button bigger and blue",
   │     description: "Per designer feedback...",
   │     sourceUrl: "https://figma.com/...",
   │   })
   ├─ Creates tasks record:
   │   - notionPageId: 'page_xyz'
   │   - notionPageUrl: 'https://notion.so/...'
   └─ Links to discussion and thread

8. STAGE 6: Notification (2 seconds)
   ├─ FigmaAdapter.postReply(fileKey, commentId,
   │     "✅ Task created: Make login button bigger\n🔗 https://notion.so/...")
   └─ FigmaAdapter.updateStatus(fileKey, commentId, 'completed')
       └─ Adds ✅ reaction to comment

9. STAGE 7: Completion (instant)
   ├─ jobs.status = 'completed'
   ├─ jobs.completedAt = now
   ├─ jobs.processingTime = 15000ms
   └─ discussions.status = 'completed'

Total time: 15 seconds
```

---

## Security Architecture

### 1. Webhook Signature Verification

All webhooks must implement cryptographic signature verification:

#### Figma (Mailgun)
```typescript
// server/api/webhook/figma.post.ts
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  const signature = getHeader(event, 'x-mailgun-signature')
  const timestamp = getHeader(event, 'x-mailgun-timestamp')
  const token = getHeader(event, 'x-mailgun-token')

  const config = useRuntimeConfig()
  const signingKey = config.mailgunSigningKey

  // Verify HMAC-SHA256 signature
  const data = timestamp + token
  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(data)
    .digest('hex')

  // Constant-time comparison (prevent timing attacks)
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    throw createError({ statusCode: 401, message: 'Invalid signature' })
  }

  // Timestamp check (prevent replay attacks)
  const age = Date.now() / 1000 - parseInt(timestamp)
  if (age > 300) { // 5 minutes
    throw createError({ statusCode: 401, message: 'Request too old' })
  }

  // Process webhook...
})
```

#### Slack
```typescript
// server/api/webhook/slack.post.ts
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  const signature = getHeader(event, 'x-slack-signature')
  const timestamp = getHeader(event, 'x-slack-request-timestamp')
  const rawBody = await readRawBody(event)

  const config = useRuntimeConfig()
  const signingSecret = config.slackSigningSecret

  // Check timestamp (prevent replay attacks)
  const currentTime = Math.floor(Date.now() / 1000)
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    throw createError({ statusCode: 401, message: 'Request too old' })
  }

  // Build signature base string
  const sigBaseString = `v0:${timestamp}:${rawBody}`

  // Calculate expected signature
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBaseString, 'utf8')
    .digest('hex')

  // Constant-time comparison
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    throw createError({ statusCode: 401, message: 'Invalid signature' })
  }

  // Process webhook...
})
```

### 2. API Token Encryption ⏳ *Deferred to Phase 6*

**MVP Approach:** Store tokens in plain text in D1 database

**Why deferred:**
- D1 is already encrypted at rest (Cloudflare infrastructure)
- Environment variables (encryption key) have same access as database
- Adds complexity without significant security benefit for MVP
- Can add when pursuing SOC2/ISO27001 compliance

**Future implementation (Phase 6):**
```typescript
// server/utils/encryption.ts - FOR LATER
import crypto from 'crypto'

const config = useRuntimeConfig()
const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(config.encryptionKey, 'hex') // 32 bytes

export async function encryptToken(plainText: string): Promise<string> {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)

  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export async function decryptToken(encrypted: string): Promise<string> {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

**When to implement:**
- Pursuing SOC2 or ISO27001 certification
- Customer compliance requirements
- Handling highly sensitive data
- Database breach concerns

### 3. Rate Limiting

Prevent abuse with per-team and global rate limits:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nuxtHubRateLimit: {
    routes: {
      // Webhooks - generous limit
      '/api/webhook/*': {
        maxRequests: 100,
        intervalSeconds: 60
      },

      // Team APIs - per-team limit
      '/api/teams/:teamId/*': {
        maxRequests: 60,
        intervalSeconds: 60,
        keyGenerator: (event) => {
          const teamId = getRouterParam(event, 'teamId')
          return `team:${teamId}`
        }
      },

      // Admin APIs - strict limit
      '/api/admin/*': {
        maxRequests: 10,
        intervalSeconds: 60
      }
    }
  }
})
```

### 4. Input Validation

All user input must be validated with Zod:

```typescript
// server/api/teams/[id]/source-configs.post.ts
import { z } from 'zod'

const sourceConfigSchema = z.object({
  sourceId: z.string().min(1),
  name: z.string().min(1).max(200),
  apiToken: z.string().min(1),
  notionToken: z.string().min(1),
  notionDatabaseId: z.string().regex(/^[a-f0-9]{32}$/),
  anthropicApiKey: z.string().optional(),
  aiEnabled: z.boolean().default(true),
  autoSync: z.boolean().default(true)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate input
  const validation = sourceConfigSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid input',
      data: validation.error.errors
    })
  }

  const data = validation.data
  // Process validated data...
})
```

### 5. Team-Based Authorization

All operations must verify team membership:

```typescript
// server/utils/auth.ts
export async function requireTeamMember(teamId: string, userId: string) {
  const membership = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, userId),
      eq(teamMembers.status, 'active')
    )
  })

  if (!membership) {
    throw createError({
      statusCode: 403,
      message: 'You are not a member of this team'
    })
  }

  return membership
}

export async function requireTeamAdmin(teamId: string, userId: string) {
  const membership = await requireTeamMember(teamId, userId)

  if (!['owner', 'admin'].includes(membership.role)) {
    throw createError({
      statusCode: 403,
      message: 'You do not have admin permissions for this team'
    })
  }

  return membership
}
```

#### Usage
```typescript
// server/api/teams/[id]/source-configs.post.ts
export default defineEventHandler(async (event) => {
  const teamId = getRouterParam(event, 'id')
  const { user } = await requireUserSession(event)

  // Only admins can create source configs
  await requireTeamAdmin(teamId, user.id)

  // Process request...
})
```

### 6. Environment Variables

Sensitive configuration via runtime config:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Private (server-only)
    encryptionKey: process.env.ENCRYPTION_KEY, // 32-byte hex
    mailgunSigningKey: process.env.MAILGUN_SIGNING_KEY,
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY, // Global fallback
    notionApiKey: process.env.NOTION_API_KEY, // Global fallback

    public: {
      // Public (client-side safe)
      appUrl: process.env.NUXT_PUBLIC_APP_URL
    }
  }
})
```

```bash
# .env (never commit!)
ENCRYPTION_KEY=64-character-hex-string-here
MAILGUN_SIGNING_KEY=your-mailgun-key
SLACK_SIGNING_SECRET=your-slack-secret
ANTHROPIC_API_KEY=sk-ant-api03-...
NOTION_API_KEY=secret_...
```

### Security Checklist

**MVP (Phases 1-5):**
- [x] Webhook signature verification (HMAC-SHA256)
- [x] Timestamp validation (prevent replay attacks)
- [x] Constant-time comparison (prevent timing attacks)
- [x] Rate limiting (per-team + global)
- [x] Input validation (Zod schemas)
- [x] Team-based authorization
- [x] Environment variable isolation
- [x] SQL injection protection (Drizzle ORM)
- [x] XSS prevention (Nuxt UI components)

**Phase 6 (Deferred):**
- [ ] API token encryption (AES-256-GCM) - Deferred until compliance requires it
- [ ] Circuit breaker pattern - Deferred until scale requires it
- [ ] Advanced monitoring/alerting - Basic logging sufficient for MVP

---

## Team Management with SuperSaaS

### SuperSaaS Integration

Discubot leverages the `nuxt-crouton-connector` SuperSaaS integration for team-based multi-tenancy:

```javascript
// crouton.config.mjs
connectors: {
  users: {
    type: 'supersaas',
    autoInstall: true,
    copyFiles: true,
    updateAppConfig: true
  }
}

flags: {
  useTeamUtility: true  // CRITICAL: Enables team-based features
}
```

### What SuperSaaS Provides

#### 1. Automatic Team Scoping

All Crouton-generated collections automatically include:
```typescript
// Auto-added fields (don't manually define!)
{
  id: string          // nanoid()
  teamId: string      // Current user's team
  userId: string      // Current user's ID
  createdAt: Date     // Auto timestamp
  updatedAt: Date     // Auto timestamp
}
```

#### 2. Team-Scoped APIs

All generated endpoints automatically filter by team:

```typescript
// GET /api/teams/:teamId/discussions
// Only returns discussions for this team

// POST /api/teams/:teamId/discussions
// Auto-sets teamId from URL param

// PATCH /api/teams/:teamId/discussions/:id
// Verifies discussion belongs to team before updating
```

#### 3. Team Member References

Collections can reference SuperSaaS users:

```json
{
  "assignedTo": {
    "type": "string",
    "refTarget": ":users",
    "meta": {
      "label": "Assigned To",
      "description": "SuperSaaS team member"
    }
  }
}
```

This generates a `ReferenceSelect` component that shows team members.

### Team Resolution Strategy

For webhook-based sources (where no user is logged in), we need to resolve the team:

#### Figma (Email-Based)
```typescript
// server/adapters/figma.ts
async parseIncoming(payload: MailgunPayload): Promise<ParsedDiscussion> {
  // Extract team slug from email address
  // comments-team1@domain.com → team1
  const recipient = payload.recipient
  const match = recipient.match(/comments-([^@]+)@/)
  const teamSlug = match?.[1]

  if (!teamSlug) {
    throw new Error('Could not resolve team from email')
  }

  // Look up team by slug
  const team = await db.query.teams.findFirst({
    where: eq(teams.slug, teamSlug)
  })

  if (!team) {
    throw new Error(`Team not found: ${teamSlug}`)
  }

  return {
    teamId: team.id,
    // ... other fields
  }
}
```

#### Slack (Workspace-Based)
```typescript
// server/adapters/slack.ts
async parseIncoming(payload: SlackEventPayload): Promise<ParsedDiscussion> {
  // Slack provides team_id in payload
  const slackWorkspaceId = payload.team_id

  // Look up source config by Slack workspace ID
  const config = await db.query.configs.findFirst({
    where: and(
      eq(configs.slackWorkspaceId, slackWorkspaceId),
      eq(configs.active, true)
    )
  })

  if (!config) {
    throw new Error(`No config found for Slack workspace: ${slackWorkspaceId}`)
  }

  return {
    teamId: config.teamId,
    // ... other fields
  }
}
```

### Team Switching

When users switch teams in the SuperSaaS UI:
1. Active team changes in session
2. All Crouton composables automatically re-fetch data
3. Cache is invalidated for old team
4. New team's data is fetched and cached

This happens automatically with no manual code required.

---

## Key Architectural Decisions

### Decision 1: Crouton for CRUD, Manual for Adapters

**Decision:** Use Crouton to generate all collection management code, implement adapters and services manually.

**Rationale:**
- Crouton excels at CRUD boilerplate (forms, tables, APIs)
- Adapter logic is business-specific and unique per source
- Clear boundary: generated = data layer, manual = business logic
- Can upgrade Crouton without affecting adapters

**Alternative Considered:** All manual code
**Why Rejected:** 150+ files of repetitive CRUD code, high maintenance burden

---

### Decision 2: Adapter Pattern Over Monolithic Service

**Decision:** Each source implements a standardized adapter interface.

**Rationale:**
- Isolates source-specific complexity
- Easy to add new sources without touching existing code
- Can disable sources independently (feature flags)
- Testable in isolation with mocks
- Follows Open/Closed Principle (open for extension, closed for modification)

**Alternative Considered:** Single service with switch statements
**Why Rejected:** Becomes unmaintainable as sources grow, violates SRP

---

### Decision 3: Separate Layers for Core, Adapters, Collections

**Decision:** Three-layer architecture: core services, source adapters, Crouton collections.

**Rationale:**
- Core services (AI, Notion) are shared across all sources
- Adapters are isolated and independently deployable
- Collections are regenerable and don't mix with custom code
- Clear dependency graph prevents circular dependencies

**Alternative Considered:** Single layer with everything
**Why Rejected:** Tight coupling, hard to test, regeneration destroys custom code

---

### Decision 4: Fire-and-Forget Webhooks

**Decision:** Webhooks return 200 OK immediately, process in background.

**Rationale:**
- Source platforms timeout after 3-10 seconds
- Processing takes 10-20 seconds (AI + Notion)
- Prevents duplicate webhook deliveries
- Better user experience (no waiting)

**Alternative Considered:** Synchronous processing
**Why Rejected:** Timeouts cause retries, duplicate tasks, poor UX

---

### Decision 5: KV Storage for Job Queue

**Decision:** Use Cloudflare KV (via NuxtHub) for job queue with TTL.

**Rationale:**
- Built into NuxtHub (no extra dependencies)
- TTL-based automatic cleanup (24 hours)
- Fast reads/writes on edge
- Simple API (no message queue complexity)

**Alternative Considered:** Bull/BullMQ with Redis
**Why Rejected:** Extra infrastructure, overkill for use case, not edge-compatible

---

### Decision 6: Encrypt Tokens at Rest

**Decision:** Encrypt all API tokens before database storage using AES-256-GCM.

**Rationale:**
- Compliance requirement (SOC 2, GDPR)
- Protects against database leaks
- Minimal performance overhead
- Standard practice for SaaS

**Alternative Considered:** Store plain text
**Why Rejected:** Security vulnerability, compliance failure

---

### Decision 7: Circuit Breaker for External APIs

**Decision:** Implement circuit breaker pattern for AI, Notion, and source APIs.

**Rationale:**
- Prevents cascade failures during outages
- Fast-fails during known issues
- Automatic recovery when service returns
- Proven pattern from figno (worked well)

**Alternative Considered:** Simple retry logic
**Why Rejected:** Can make outages worse by hammering failing service

---

### Decision 8: AI Response Caching

**Decision:** Cache AI responses for 1 hour using MD5 hash of input.

**Rationale:**
- Dramatically reduces API costs (Claude is expensive)
- Faster responses for duplicate discussions
- Handles webhook retries gracefully
- 1 hour TTL balances freshness vs. cost

**Alternative Considered:** No caching
**Why Rejected:** Cost prohibitive, slower responses

---

### Decision 9: Rate Limit Notion API

**Decision:** Sequential task creation with 200ms delays.

**Rationale:**
- Notion API limit: 3 requests/second
- Prevents 429 rate limit errors
- Ensures all tasks get created
- Simple implementation (no queue needed)

**Alternative Considered:** Parallel creation
**Why Rejected:** Causes rate limit errors, lost tasks

---

### Decision 10: SuperSaaS for Multi-Tenancy

**Decision:** Use SuperSaaS template + nuxt-crouton-connector for team management.

**Rationale:**
- Battle-tested team management (auth, permissions, billing)
- Automatic team scoping in Crouton
- No need to build user management from scratch
- Follows your existing pattern

**Alternative Considered:** Custom team management
**Why Rejected:** Reinventing the wheel, high maintenance burden

---

## Technology Stack

### Core Framework
- **Nuxt 4**: Modern Vue framework with SSR, SSG, and edge deployment
- **Vue 3**: Composition API for reactive UI components
- **TypeScript**: Type safety across entire codebase

### CRUD Generation
- **@friendlyinternet/nuxt-crouton**: Auto-generates collections, forms, tables, APIs
- **@friendlyinternet/nuxt-crouton-connector**: SuperSaaS team integration

### Database & ORM
- **D1 (Cloudflare)**: SQLite database via NuxtHub
- **Drizzle ORM**: Type-safe database queries and migrations
- **Zod**: Runtime validation and type inference

### External APIs
- **Claude AI (Anthropic)**: Summarization and task detection
- **Notion API**: Task creation and management
- **Figma API**: Comment threading and reactions
- **Slack API**: Thread fetching and message posting

### Infrastructure (NuxtHub)
- **Cloudflare Workers**: Edge serverless functions
- **Cloudflare KV**: Key-value storage for job queue and caching
- **Cloudflare D1**: Distributed SQLite database
- **Cloudflare R2**: Blob storage for attachments (future)

### Authentication
- **SuperSaaS**: Team-based auth and user management
- **Nuxt Auth Utils**: Session management

### UI Components
- **Nuxt UI 4**: Component library (NOT v2/v3!)
- **Tailwind CSS**: Utility-first styling
- **Headless UI**: Accessible components

### Development Tools
- **pnpm**: Fast package manager
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Vitest**: Unit testing
- **Playwright**: E2E testing

### Package Dependencies

```json
{
  "dependencies": {
    "@friendlyinternet/nuxt-crouton": "^1.2.0",
    "@friendlyinternet/nuxt-crouton-connector": "^0.1.0",
    "@anthropic-ai/sdk": "^0.27.0",
    "@notionhq/client": "^2.2.15",
    "nuxt": "^3.13.0",
    "drizzle-orm": "^0.33.0",
    "zod": "^3.23.0",
    "nanoid": "^5.0.0",
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "@nuxthub/core": "^0.7.0",
    "vitest": "^2.0.0",
    "playwright": "^1.47.0"
  }
}
```

### Environment Requirements

```bash
# Required
Node.js >= 20
pnpm >= 9

# Optional (for local development)
Docker (for local D1 emulation)
```

---

## Summary

Discubot v2 represents a complete architectural evolution from the figno proof-of-concept, built with a **lean, pragmatic approach**:

**From:** Figma-specific monolith with 10+ tables and tight coupling
**To:** Generic adapter-based system with **5 collections** and clear separation

**From:** Manual CRUD code for every entity
**To:** Crouton-generated collections with auto-generated forms, tables, APIs

**From:** Single-source limitation
**To:** Multi-source support via standardized adapter interface

**From:** Complex 4-layer structure with premature abstractions
**To:** Simple 2-layer structure: generated + manual code

**From:** Over-engineered for imagined scale
**To:** Right-sized for MVP, extensible when needed

### What We're Building (MVP)

The result is a lean system that:
- ✅ Supports multiple discussion sources (Figma, Slack, easily add more)
- ✅ Leverages Crouton for rapid development (~100 generated files)
- ✅ Maintains essential security (signatures, rate limiting, validation)
- ✅ Scales horizontally on Cloudflare edge
- ✅ Easy to extend with new sources (implement one adapter)
- ✅ Production-ready error handling (retry logic, 7-stage pipeline)
- ✅ Team-based multi-tenancy via SuperSaaS

### What We're Deferring (Phase 6)

Advanced features to add when scale/compliance demands:
- ⏳ Circuit breaker pattern (when API outages become a problem)
- ⏳ Token encryption (when pursuing SOC2/ISO27001)
- ⏳ KV-based caching (when deploying multi-region)

### Philosophy

This architecture follows the KISS principle from CLAUDE.md:
> "Start simple, add complexity only when proven necessary"

We're building for **current needs** (2 sources, 0 users) not **imagined future scale** (10+ sources, 1000+ users). We can always add complexity later when real problems emerge.

**Next steps:**
- See `discubot-crouton-schemas.md` for exact collection definitions
- See `discubot-implementation-roadmap.md` for phased implementation plan
- See `discubot-architecture-decisions.md` for detailed rationale

---

**Document Version**: 2.1 (Revised - Lean Architecture + User Mappings)
**Last Updated**: 2025-11-12
**Author**: Architecture Planning for Discubot v2
**Changes**: Added userMappings collection for Notion @mentions, documented mention resolution workflow
**Next Review**: After Phase 5 completion

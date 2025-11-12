# Discubot: Crouton Configuration & Schemas

**Project**: Discubot - Nuxt-Crouton Collection Generator Configuration
**Date**: 2025-11-11 (Revised - Lean Architecture)
**Purpose**: Complete specifications for generating Discubot collections
**Generator Version**: nuxt-crouton-collection-generator v1.2.0+
**Collections**: 4 (reduced from 6 for simplicity)

---

## Table of Contents

1. [Overview](#overview)
2. [Crouton Configuration File](#crouton-configuration)
3. [Collection Schemas](#collection-schemas)
   - [Discussions](#discussions-collection) (with embedded thread data)
   - [Source Configs](#source-configs-collection)
   - [Sync Jobs](#sync-jobs-collection)
   - [Tasks](#tasks-collection)
4. [Generation Commands](#generation-commands)
5. [Post-Generation Steps](#post-generation-steps)

**Note**: Threads and Sources collections have been removed for simplicity.

---

## Overview

Discubot uses **4 core collections** managed by Nuxt-Crouton (reduced from 6 for simplicity). This document provides the complete configuration and schema definitions needed to generate these collections.

### Collections Summary

| Collection | Purpose | Records | Auto-Generated |
|------------|---------|---------|----------------|
| **discussions** | Raw discussion data + embedded thread | ~100-1000/month | Yes |
| **configs** | Team-specific source settings | ~10-50/team | No |
| **jobs** | Job queue and status tracking | ~100-1000/month | Yes |
| **tasks** | Created Notion tasks (audit trail) | ~100-2000/month | Yes |

### Removed Collections (Simplified)

| Collection | Reason | Alternative |
|------------|--------|-------------|
| **threads** | Redundant with discussions | Embedded as JSON in `discussions.threadData` |
| **sources** | Static data, only 2 entries | Hardcoded constants in adapter files |

### Key Features

- **Team Scoping**: All collections auto-scoped by `teamId` (SuperSaaS)
- **Auto Timestamps**: `createdAt` and `updatedAt` added automatically
- **Relations**: Reference fields link collections
- **JSON Fields**: Flexible metadata storage
- **External Connectors**: SuperSaaS user references

---

## Crouton Configuration

### File: `crouton.config.mjs`

Place this file in your project root.

```javascript
export default {
  // Define all collections (4 total - lean approach)
  collections: [
    { name: 'discussions', fieldsFile: './schemas/discussion-schema.json' },
    { name: 'configs', fieldsFile: './schemas/config-schema.json' },
    { name: 'jobs', fieldsFile: './schemas/job-schema.json' },
    { name: 'tasks', fieldsFile: './schemas/task-schema.json' }
  ],

  // Organize into layers
  targets: [
    {
      layer: 'discubot',
      collections: [
        'discussions',
        'configs',
        'jobs',
        'tasks'
      ]
    }
  ],

  // Database dialect
  dialect: 'sqlite',

  // External connectors for :referenced collections
  connectors: {
    users: {
      type: 'supersaas',        // SuperSaaS team-based user management
      autoInstall: true,         // Install @friendlyinternet/nuxt-crouton-connector
      copyFiles: true,           // Copy connector files to project
      updateAppConfig: true      // Auto-register in app.config.ts
    }
  },

  // Generation flags
  flags: {
    useTeamUtility: true,    // CRITICAL: Enable team-based multi-tenancy
    useMetadata: true,       // Add createdAt/updatedAt timestamps
    autoRelations: true,     // Generate relation stubs
    autoConnectors: true,    // Auto-configure connectors without prompting
    force: false,            // Don't overwrite existing files
    noTranslations: false,   // Enable i18n (optional, can set to true)
    noDb: false,             // Generate database schema
    dryRun: false,           // Actually generate files
    useMaps: false           // No geocoding needed
  }
}
```

### Configuration Explanation

#### Collections Array
Defines all collections to generate. Each entry:
- `name`: Collection name (camelCase)
- `fieldsFile`: Path to JSON schema file

#### Targets Array
Organizes collections into Nuxt layers. All 4 collections go into `discubot` layer.

#### Connectors Object
**CRITICAL**: Configures SuperSaaS integration for team-based multi-tenancy.

- `autoInstall: true`: Automatically installs `@friendlyinternet/nuxt-crouton-connector`
- `copyFiles: true`: Copies connector files to your project
- `updateAppConfig: true`: Registers connector in app.config.ts

#### Flags Object

**Must-Have Flags:**
- `useTeamUtility: true`: Adds `teamId`, `userId`, `createdAt`, `updatedAt` to ALL collections
- `useMetadata: true`: Enables timestamp tracking
- `autoRelations: true`: Generates relation stubs for `refTarget` fields

**Optional Flags:**
- `noTranslations: true`: Set if you don't need i18n (faster generation)
- `force: true`: DANGER - Overwrites existing files (use carefully)

---

---

## Collection Schemas

### IMPORTANT: Auto-Generated Fields

**DO NOT MANUALLY DEFINE THESE FIELDS** (Crouton adds them automatically when `useTeamUtility: true`):

```json
// ❌ NEVER INCLUDE THESE IN YOUR SCHEMAS
{
  "id": { "type": "string" },           // Auto-added
  "teamId": { "type": "string" },       // Auto-added
  "userId": { "type": "string" },       // Auto-added
  "createdAt": { "type": "date" },      // Auto-added (useMetadata: true)
  "updatedAt": { "type": "date" }       // Auto-added (useMetadata: true)
}
```

These fields are automatically injected by Crouton. Manually defining them causes duplicate key errors.

---

## Discussions Collection

### Purpose
Store raw incoming discussions from any source (Figma, Slack, etc.) **with embedded thread data and AI analysis**. This consolidates what was previously split across discussions and threads collections.

### File: `schemas/discussion-schema.json`

```json
{
  "sourceType": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source Type",
      "description": "figma, slack, linear, etc.",
      "area": "sidebar",
      "group": "source"
    }
  },
  "sourceThreadId": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source Thread ID",
      "description": "Unique ID in the source system",
      "area": "sidebar",
      "group": "source"
    }
  },
  "sourceUrl": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source URL",
      "description": "Deep link to the discussion",
      "area": "main",
      "group": "details"
    }
  },
  "sourceConfigId": {
    "type": "string",
    "refTarget": "configs",
    "meta": {
      "required": true,
      "label": "Source Configuration",
      "description": "Which source config processed this",
      "area": "sidebar",
      "group": "source"
    }
  },
  "title": {
    "type": "string",
    "meta": {
      "required": true,
      "maxLength": 500,
      "label": "Title",
      "description": "Subject or first line of discussion",
      "area": "main",
      "group": "details"
    }
  },
  "content": {
    "type": "text",
    "meta": {
      "required": true,
      "label": "Content",
      "description": "Main discussion content",
      "area": "main",
      "group": "details"
    }
  },
  "authorHandle": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Author Handle",
      "description": "Username or handle of author",
      "area": "main",
      "group": "details"
    }
  },
  "participants": {
    "type": "array",
    "meta": {
      "label": "Participants",
      "description": "Array of participant handles",
      "area": "sidebar",
      "group": "metadata"
    }
  },
  "status": {
    "type": "string",
    "meta": {
      "required": true,
      "default": "pending",
      "label": "Status",
      "description": "pending, processing, completed, failed",
      "area": "sidebar",
      "group": "status",
      "displayAs": "badge"
    }
  },
  "threadData": {
    "type": "json",
    "meta": {
      "label": "Thread Data",
      "description": "Full thread with rootMessage and replies (embedded)",
      "area": "main",
      "group": "thread"
    }
  },
  "totalMessages": {
    "type": "number",
    "meta": {
      "default": 1,
      "label": "Total Messages",
      "description": "Count of messages in thread",
      "area": "sidebar",
      "group": "thread"
    }
  },
  "aiSummary": {
    "type": "text",
    "meta": {
      "label": "AI Summary",
      "description": "Claude-generated discussion summary",
      "area": "main",
      "group": "ai"
    }
  },
  "aiKeyPoints": {
    "type": "array",
    "meta": {
      "label": "AI Key Points",
      "description": "Array of key discussion points",
      "area": "main",
      "group": "ai"
    }
  },
  "aiTasks": {
    "type": "json",
    "meta": {
      "label": "Detected Tasks",
      "description": "Array of AI-detected task objects",
      "area": "main",
      "group": "ai"
    }
  },
  "isMultiTask": {
    "type": "boolean",
    "meta": {
      "default": false,
      "label": "Is Multi-Task",
      "description": "Whether AI detected multiple tasks",
      "area": "sidebar",
      "group": "ai"
    }
  },
  "syncJobId": {
    "type": "string",
    "refTarget": "jobs",
    "meta": {
      "label": "Sync Job",
      "description": "Reference to processing job",
      "area": "sidebar",
      "group": "relations"
    }
  },
  "notionTaskIds": {
    "type": "array",
    "meta": {
      "label": "Notion Task IDs",
      "description": "Array of created task IDs (references tasks collection)",
      "area": "sidebar",
      "group": "results"
    }
  },
  "rawPayload": {
    "type": "json",
    "meta": {
      "label": "Raw Payload",
      "description": "Original webhook/email payload",
      "area": "sidebar",
      "group": "debug"
    }
  },
  "metadata": {
    "type": "json",
    "meta": {
      "label": "Metadata",
      "description": "Source-specific metadata",
      "area": "sidebar",
      "group": "debug"
    }
  },
  "processedAt": {
    "type": "date",
    "meta": {
      "label": "Processed At",
      "description": "When processing completed",
      "area": "sidebar",
      "group": "status"
    }
  }
}
```

### Field Notes

- **sourceType**: Enum-like string (figma, slack, linear) - validated in code
- **sourceThreadId**: Format varies by source (e.g., `file_abc:comment_123` for Figma)
- **sourceUrl**: Deep link users can click to return to source
- **participants**: JSON array of strings (handles/usernames)
- **status**: State machine values (validated in code)
- **threadData**: JSON object `{ rootMessage: {...}, replies: [...] }` - previously separate collection
- **aiSummary**: Claude-generated text summary - moved from threads collection
- **aiKeyPoints**: Array of strings - moved from threads collection
- **aiTasks**: Array of task objects `{ title, description, priority }` - moved from threads collection
- **isMultiTask**: Boolean flag for multi-task detection - moved from threads collection
- **notionTaskIds**: Array of task IDs created (references tasks collection)
- **rawPayload**: Full webhook/email for debugging
- **metadata**: Flexible storage for source-specific data

### Example threadData Structure

```json
{
  "rootMessage": {
    "id": "msg_123",
    "authorHandle": "user@example.com",
    "content": "We should redesign the login page",
    "timestamp": "2025-11-11T10:00:00Z",
    "attachments": []
  },
  "replies": [
    {
      "id": "msg_124",
      "authorHandle": "designer@example.com",
      "content": "Agreed, the current design is outdated",
      "timestamp": "2025-11-11T10:05:00Z"
    }
  ]
}
```

---

## Configs Collection

### Purpose
Team-specific configuration for each source. Each team can have multiple source configs (e.g., different Figma projects, Slack workspaces).

### File: `schemas/config-schema.json`

```json
{
  "sourceType": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source Type",
      "description": "figma, slack, linear, etc. (hardcoded in adapters)",
      "area": "main",
      "group": "basic"
    }
  },
  "name": {
    "type": "string",
    "meta": {
      "required": true,
      "maxLength": 200,
      "label": "Configuration Name",
      "description": "Friendly name (e.g., 'Main Figma Project')",
      "area": "main",
      "group": "basic"
    }
  },
  "emailAddress": {
    "type": "string",
    "meta": {
      "label": "Email Address",
      "description": "For email-based sources (Figma)",
      "area": "main",
      "group": "email"
    }
  },
  "emailSlug": {
    "type": "string",
    "meta": {
      "label": "Email Slug",
      "description": "team1, team2, etc. (comments-{slug}@domain.com)",
      "area": "main",
      "group": "email"
    }
  },
  "webhookUrl": {
    "type": "string",
    "meta": {
      "label": "Webhook URL",
      "description": "For webhook-based sources (Slack)",
      "area": "main",
      "group": "webhook"
    }
  },
  "webhookSecret": {
    "type": "string",
    "meta": {
      "label": "Webhook Secret",
      "description": "For signature verification (encrypted)",
      "area": "main",
      "group": "webhook"
    }
  },
  "apiToken": {
    "type": "string",
    "meta": {
      "label": "API Token",
      "description": "Encrypted source API token",
      "area": "main",
      "group": "credentials"
    }
  },
  "notionToken": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Notion Token",
      "description": "Encrypted Notion API token",
      "area": "main",
      "group": "credentials"
    }
  },
  "notionDatabaseId": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Notion Database ID",
      "description": "Target Notion database (32-char hex)",
      "area": "main",
      "group": "notion"
    }
  },
  "notionFieldMapping": {
    "type": "json",
    "meta": {
      "label": "Notion Field Mapping",
      "description": "Custom field mapping config",
      "area": "main",
      "group": "notion"
    }
  },
  "anthropicApiKey": {
    "type": "string",
    "meta": {
      "label": "Claude API Key",
      "description": "Encrypted Anthropic API key (optional, uses global if empty)",
      "area": "main",
      "group": "credentials"
    }
  },
  "aiEnabled": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "AI Enabled",
      "description": "Use Claude AI for summarization",
      "area": "sidebar",
      "group": "features"
    }
  },
  "aiSummaryPrompt": {
    "type": "text",
    "meta": {
      "label": "AI Summary Prompt",
      "description": "Custom prompt template for summaries",
      "area": "main",
      "group": "ai"
    }
  },
  "aiTaskPrompt": {
    "type": "text",
    "meta": {
      "label": "AI Task Detection Prompt",
      "description": "Custom task detection prompt",
      "area": "main",
      "group": "ai"
    }
  },
  "autoSync": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "Auto Sync",
      "description": "Automatically process incoming discussions",
      "area": "sidebar",
      "group": "features"
    }
  },
  "postConfirmation": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "Post Confirmation",
      "description": "Post back to source when done",
      "area": "sidebar",
      "group": "features"
    }
  },
  "active": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "Active",
      "description": "Is this configuration active?",
      "area": "sidebar",
      "group": "status"
    }
  },
  "onboardingComplete": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": false,
      "label": "Onboarding Complete",
      "description": "Has user completed setup wizard?",
      "area": "sidebar",
      "group": "status"
    }
  },
  "sourceMetadata": {
    "type": "json",
    "meta": {
      "label": "Source Metadata",
      "description": "Source-specific configuration data",
      "area": "sidebar",
      "group": "debug"
    }
  }
}
```

### Security Note

**CRITICAL**: All credential fields (`apiToken`, `notionToken`, `anthropicApiKey`, `webhookSecret`) must be encrypted before storage using the encryption utility:

```typescript
// Before saving
config.apiToken = await encryptToken(plainTextToken)
config.notionToken = await encryptToken(plainTextNotionToken)
config.anthropicApiKey = await encryptToken(plainTextAnthropicKey)

// When using
const figmaToken = await decryptToken(config.apiToken)
const notionToken = await decryptToken(config.notionToken)
```

---

## Jobs Collection

### Purpose
Job queue and processing status tracking. Each discussion gets a sync job that tracks progress through the 7-stage pipeline.

### File: `schemas/job-schema.json`

```json
{
  "discussionId": {
    "type": "string",
    "refTarget": "discussions",
    "meta": {
      "required": true,
      "label": "Discussion",
      "description": "Discussion being processed",
      "area": "sidebar",
      "group": "relations"
    }
  },
  "sourceConfigId": {
    "type": "string",
    "refTarget": "configs",
    "meta": {
      "required": true,
      "label": "Source Config",
      "description": "Which config is processing this",
      "area": "sidebar",
      "group": "relations"
    }
  },
  "status": {
    "type": "string",
    "meta": {
      "required": true,
      "default": "pending",
      "label": "Status",
      "description": "pending, processing, completed, failed, retrying",
      "area": "main",
      "group": "status",
      "displayAs": "badge"
    }
  },
  "stage": {
    "type": "string",
    "meta": {
      "label": "Current Stage",
      "description": "ingestion, thread_building, ai_analysis, task_creation, notification",
      "area": "main",
      "group": "status"
    }
  },
  "attempts": {
    "type": "number",
    "meta": {
      "required": true,
      "default": 0,
      "label": "Attempts",
      "description": "Number of processing attempts",
      "area": "sidebar",
      "group": "retry"
    }
  },
  "maxAttempts": {
    "type": "number",
    "meta": {
      "required": true,
      "default": 3,
      "label": "Max Attempts",
      "description": "Maximum retry attempts",
      "area": "sidebar",
      "group": "retry"
    }
  },
  "error": {
    "type": "text",
    "meta": {
      "label": "Error Message",
      "description": "Last error encountered",
      "area": "main",
      "group": "error"
    }
  },
  "errorStack": {
    "type": "text",
    "meta": {
      "label": "Error Stack",
      "description": "Full stack trace",
      "area": "sidebar",
      "group": "error"
    }
  },
  "startedAt": {
    "type": "date",
    "meta": {
      "label": "Started At",
      "description": "When processing began",
      "area": "sidebar",
      "group": "timing"
    }
  },
  "completedAt": {
    "type": "date",
    "meta": {
      "label": "Completed At",
      "description": "When processing finished",
      "area": "sidebar",
      "group": "timing"
    }
  },
  "processingTime": {
    "type": "number",
    "meta": {
      "label": "Processing Time (ms)",
      "description": "Total processing duration",
      "area": "sidebar",
      "group": "timing"
    }
  },
  "taskIds": {
    "type": "array",
    "meta": {
      "label": "Created Task IDs",
      "description": "Array of created task IDs",
      "area": "sidebar",
      "group": "results"
    }
  },
  "metadata": {
    "type": "json",
    "meta": {
      "label": "Metadata",
      "description": "Stage-specific data and logs",
      "area": "sidebar",
      "group": "debug"
    }
  }
}
```

### Field Notes

- **status**: State machine values
  - `pending`: Queued, not started
  - `processing`: Currently running
  - `completed`: Successfully finished
  - `failed`: Permanently failed (maxAttempts exceeded)
  - `retrying`: Failed but will retry

- **stage**: Processing pipeline stages
  - `ingestion`: Webhook received
  - `thread_building`: Fetching full thread
  - `ai_analysis`: Running Claude AI
  - `task_creation`: Creating Notion tasks
  - `notification`: Posting confirmations

- **taskIds**: Array of task IDs created (for multi-task discussions)
- **metadata**: Structured logs per stage for debugging

---

## Tasks Collection

### Purpose
Local cache of created Notion tasks. Stores essential task data for quick lookups without hitting Notion API.

### File: `schemas/task-schema.json`

```json
{
  "discussionId": {
    "type": "string",
    "refTarget": "discussions",
    "meta": {
      "required": true,
      "label": "Discussion",
      "description": "Source discussion",
      "area": "sidebar",
      "group": "relations"
    }
  },
  "syncJobId": {
    "type": "string",
    "refTarget": "jobs",
    "meta": {
      "required": true,
      "label": "Sync Job",
      "description": "Job that created this task",
      "area": "sidebar",
      "group": "relations"
    }
  },
  "notionPageId": {
    "type": "string",
    "meta": {
      "required": true,
      "unique": true,
      "label": "Notion Page ID",
      "description": "UUID of Notion page",
      "area": "sidebar",
      "group": "notion"
    }
  },
  "notionPageUrl": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Notion Page URL",
      "description": "Public URL to Notion page",
      "area": "main",
      "group": "notion"
    }
  },
  "title": {
    "type": "string",
    "meta": {
      "required": true,
      "maxLength": 500,
      "label": "Task Title",
      "description": "Notion page title",
      "area": "main",
      "group": "task"
    }
  },
  "description": {
    "type": "text",
    "meta": {
      "label": "Task Description",
      "description": "Task details",
      "area": "main",
      "group": "task"
    }
  },
  "status": {
    "type": "string",
    "meta": {
      "required": true,
      "default": "todo",
      "label": "Status",
      "description": "todo, in_progress, done (synced from Notion)",
      "area": "sidebar",
      "group": "task",
      "displayAs": "badge"
    }
  },
  "priority": {
    "type": "string",
    "meta": {
      "label": "Priority",
      "description": "low, medium, high (from AI or Notion)",
      "area": "sidebar",
      "group": "task"
    }
  },
  "assignee": {
    "type": "string",
    "meta": {
      "label": "Assignee Handle",
      "description": "Username or handle of assignee",
      "area": "sidebar",
      "group": "task"
    }
  },
  "summary": {
    "type": "text",
    "meta": {
      "label": "AI Summary",
      "description": "AI-generated task summary",
      "area": "main",
      "group": "ai"
    }
  },
  "sourceUrl": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source URL",
      "description": "Deep link back to source discussion",
      "area": "main",
      "group": "source"
    }
  },
  "isMultiTaskChild": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": false,
      "label": "Is Multi-Task Child",
      "description": "Created as part of multi-task detection",
      "area": "sidebar",
      "group": "metadata"
    }
  },
  "taskIndex": {
    "type": "number",
    "meta": {
      "label": "Task Index",
      "description": "Order in multi-task sequence (0, 1, 2...)",
      "area": "sidebar",
      "group": "metadata"
    }
  },
  "metadata": {
    "type": "json",
    "meta": {
      "label": "Metadata",
      "description": "Additional task data from Notion",
      "area": "sidebar",
      "group": "debug"
    }
  }
}
```

### Field Notes

- **notionPageId**: Unique identifier in Notion (UUID format)
- **notionPageUrl**: Human-readable URL for sharing
- **status**: Can be synced from Notion via webhook (future enhancement)
- **isMultiTaskChild**: Tracks tasks created from multi-task detection
- **taskIndex**: Preserves order when multiple tasks created from one discussion

---

## Generation Commands

### 1. Create Directory Structure

```bash
# From project root
mkdir -p crouton/schemas
mkdir -p layers/discubot
```

### 2. Create Schema Files

Save each collection schema JSON to `crouton/schemas/` directory:

```bash
crouton/schemas/
├── discussion-schema.json
├── config-schema.json
├── job-schema.json
└── task-schema.json
```

### 3. Create Crouton Config

Save `crouton.config.mjs` to project root.

### 4. Run Generator

```bash
# Install Crouton (if not already installed)
pnpm add -D @friendlyinternet/nuxt-crouton

# Run generator
npx crouton-generate --config ./crouton.config.mjs

# Or with explicit flags
npx crouton-generate \
  --config ./crouton.config.mjs \
  --team-utility \
  --metadata \
  --auto-relations \
  --auto-connectors
```

### 5. Verify Generation

Generator should create:

```
layers/discubot/
├── collections/
│   ├── discussions/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── Form.vue
│   │   │   │   ├── List.vue
│   │   │   │   ├── Table.vue
│   │   │   │   └── CardMini.vue
│   │   │   ├── composables/
│   │   │   │   ├── useDiscussions.ts
│   │   │   │   ├── useDiscussionsCreate.ts
│   │   │   │   └── useDiscussionsUpdate.ts
│   │   │   └── pages/
│   │   │       └── dashboard/[team]/discussions/
│   │   │           ├── index.vue
│   │   │           └── [id].vue
│   │   ├── server/
│   │   │   ├── api/
│   │   │   │   └── teams/[id]/discussions/
│   │   │   │       ├── index.get.ts
│   │   │   │       ├── index.post.ts
│   │   │   │       └── [discussionId].patch.ts
│   │   │   └── database/
│   │   │       └── schema.ts
│   │   └── types/
│   │       └── index.ts
│   ├── configs/
│   │   └── (... same structure)
│   ├── jobs/
│   │   └── (... same structure)
│   └── tasks/
│       └── (... same structure)
└── nuxt.config.ts
```

**Total files**: ~100 (4 collections × ~25 files each)

### 6. Run Typecheck

```bash
npx nuxt typecheck
```

Should pass with no errors. If you see "duplicate key" errors, you likely manually defined auto-generated fields (`id`, `teamId`, `userId`, `createdAt`, `updatedAt`).

---

## Post-Generation Steps

### 1. Extend Main Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    './layers/discubot'  // Add this line
  ],

  // ... rest of config
})
```

### 2. Run Database Migrations

```bash
# Generate migration
npx drizzle-kit generate

# Apply migration
npx drizzle-kit push
```

### 3. Seed Sources Collection

```bash
# Create seed script
npx nuxt db:seed sources

# Or manually insert via API
POST /api/teams/:teamId/sources
```

### 4. Verify APIs

```bash
# Test generated endpoints
curl http://localhost:3000/api/teams/team_abc/discussions
curl http://localhost:3000/api/teams/team_abc/sources
```

### 5. Test UI

```bash
# Start dev server
pnpm dev

# Visit dashboard
http://localhost:3000/dashboard/team_abc/discussions
http://localhost:3000/dashboard/team_abc/sources
```

### 6. Manual Additions

Now add manual code:
1. Core services (`layers/discussion-core/server/services/`)
2. Adapters (`layers/discussion-figma/server/adapters/`)
3. Webhook endpoints (`layers/discussion-figma/server/api/webhook/`)
4. Processor service (`layers/discussion-core/server/services/processor.ts`)

---

## Troubleshooting

### Duplicate Key Errors

```
Error: Duplicate key 'id' in schema
```

**Cause**: Manually defined auto-generated field
**Fix**: Remove `id`, `teamId`, `userId`, `createdAt`, `updatedAt` from schemas

### Type Errors

```
Property 'teamId' does not exist on type 'Discussion'
```

**Cause**: `useTeamUtility: false` in config
**Fix**: Set `useTeamUtility: true`

### Missing APIs

```
404 Not Found: /api/teams/:teamId/discussions
```

**Cause**: Layer not extended in main config
**Fix**: Add to `extends` array in `nuxt.config.ts`

### SuperSaaS Not Working

```
Cannot find module '@friendlyinternet/nuxt-crouton-connector'
```

**Cause**: `autoInstall: false` or connector not installed
**Fix**: Set `autoInstall: true` and re-run generator

---

## Summary

This document provides complete, ready-to-use configuration for generating Discubot's 4 core collections with Nuxt-Crouton:

✅ **Crouton Config**: `crouton.config.mjs` with all settings
✅ **4 Schemas**: Complete JSON schemas for all collections
✅ **SuperSaaS Integration**: Team-based multi-tenancy enabled
✅ **Auto Fields**: `teamId`, `userId`, timestamps handled automatically
✅ **Relations**: Reference fields between collections
✅ **Security**: Encryption notes for sensitive fields

**Next Steps**:
1. Create schema files in `crouton/schemas/` directory
2. Create `crouton.config.mjs` in `crouton/` directory
3. Run `pnpm crouton generate` from the crouton directory
4. Verify with `npx nuxt typecheck`
5. Begin implementing manual adapters and services

See `discubot-implementation-roadmap.md` for detailed phase-by-phase implementation plan.

---

**Document Version**: 2.0
**Last Updated**: 2025-11-12 (Updated for new naming convention)
**Generated Files**: ~100
**Estimated Generation Time**: 2-3 minutes

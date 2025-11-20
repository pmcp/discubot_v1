# Flows Redesign Briefing

**Date**: 2025-11-20
**Status**: Planning
**Goal**: Transform single-input/single-output configs into flexible multi-input/multi-output flows with AI domain-based routing

---

## Executive Summary

This redesign transforms Discubot from a simple 1:1 configuration model to a flexible flow-based architecture:

**Before**: One config = One input source (Slack OR Figma) → One output (Notion DB)
**After**: One flow = Multiple inputs (Slack + Figma + ...) → AI domain detection → Multiple outputs (Notion DBs, GitHub, Linear) with smart routing

### Key Benefits
- ✅ **Flexibility**: Mix multiple input sources in one flow
- ✅ **Smart routing**: AI detects domain (design/dev/product), routes to appropriate outputs
- ✅ **Scalability**: Easy to add new input/output types without changing core logic
- ✅ **User control**: Configure domain filters per output
- ✅ **Clean architecture**: Separation of concerns (inputs, processing, outputs)

---

## Current Architecture (Configs)

### Data Model
```
discubot_configs (single table)
├─ Input fields: sourceType, apiToken, webhookUrl, emailSlug
├─ AI fields: aiEnabled, aiSummaryPrompt, aiTaskPrompt, anthropicApiKey
├─ Output fields: notionToken, notionDatabaseId, notionFieldMapping
└─ Metadata: teamId, owner, active, sourceMetadata
```

### Flow
1. Webhook arrives (Slack/Figma) → `/api/webhooks/[source]`
2. Adapter parses event → `ParsedDiscussion`
3. Processor finds config by `teamId + sourceType`
4. AI analyzes discussion → Summary + Tasks
5. Create tasks in Notion (single database)
6. Reply to source (optional)

### Limitations
- ❌ Can't combine multiple Slack workspaces in one workflow
- ❌ Can't combine Slack + Figma in one workflow
- ❌ Can't route tasks to different Notion DBs based on type
- ❌ Can't output to GitHub Issues or Linear
- ❌ One-size-fits-all: design tasks and dev tasks go to same place

---

## New Architecture (Flows)

### Data Model
```
discubot_flows (main configuration)
├─ Flow metadata: name, description, teamId, owner
├─ AI settings: aiEnabled, aiSummaryPrompt, aiTaskPrompt, anthropicApiKey
└─ Status: active, onboardingComplete

discubot_flow_inputs (one-to-many with flows)
├─ flowId (references flows)
├─ Input config: sourceType, name, apiToken, webhookUrl, emailSlug
└─ Source metadata: JSON (Slack workspace ID, Figma file key, etc.)

discubot_flow_outputs (one-to-many with flows)
├─ flowId (references flows)
├─ Output config: outputType, name, domainFilter[], isDefault
└─ Output-specific config: JSON (notionToken, databaseId, fieldMapping, etc.)

discubot_user_mappings (enhanced for multi-workspace)
├─ sourceType, sourceWorkspaceId (NEW!), sourceUserId
└─ notionUserId, active
```

### Flow
1. Webhook arrives → Processor finds flow by matching input (workspace ID or email slug)
2. Load flow with all inputs and outputs
3. AI analyzes discussion → Summary + Tasks (with **domain** field)
4. For each task:
   - Check task.domain (e.g., "design")
   - Find outputs with matching domainFilter (e.g., ["design", "frontend"])
   - Create task in all matching outputs
   - If no match, use default output (isDefault: true)
5. Reply to source

### Example Flow
```
Product Team Flow
├─ Inputs:
│  ├─ Slack Workspace A (Product team)
│  └─ Figma (Design files)
├─ AI: Detects domain per task
└─ Outputs:
   ├─ Notion DB 1 (Design Tasks) - domainFilter: ["design", "frontend"]
   ├─ Notion DB 2 (Dev Backlog) - domainFilter: ["backend", "infrastructure"]
   └─ Notion DB 3 (All Tasks) - isDefault: true (catch-all)
```

---

## Key Design Decisions

### 1. Domain Detection: User-Defined Per Flow ✅

**Decision**: Domains are user-defined per flow (not hardcoded globally)

**Rationale**:
- Marketing teams need: "campaign", "content", "social"
- Dev teams need: "frontend", "backend", "infrastructure"
- Design teams need: "design", "ui", "ux"
- Flexibility > Convention

**Implementation**:
```json
// flow-schema.json
{
  "availableDomains": {
    "type": "array",
    "meta": {
      "default": ["design", "frontend", "backend", "product", "infrastructure", "docs"],
      "description": "Custom domain tags for this flow"
    }
  }
}
```

AI picks from the flow's available domains. Users can customize per flow.

---

### 2. Default Output: Required ✅

**Decision**: Every flow must have one default output (isDefault: true)

**Rationale**:
- Tasks with unknown/unmatched domains need somewhere to go
- Prevents silent failures (task detected but not created)
- User explicitly chooses fallback behavior

**Implementation**:
```json
// flow-outputs-schema.json
{
  "isDefault": {
    "type": "boolean",
    "meta": {
      "default": false,
      "description": "Fallback for tasks without matching domain"
    }
  }
}
```

**Routing Logic**:
1. Task domain = "design" → Match outputs with "design" in domainFilter
2. Task domain = "unknown" → No match → Send to default output
3. No default output configured → Log error, skip task creation

---

### 3. Output Config: JSON Blob (Flexible) ✅

**Decision**: Store output-specific configuration in single JSON column

**Rationale**:
- ✅ Flexible: Easy to add GitHub, Linear without schema migration
- ✅ Clean: No 20+ nullable columns for each output type
- ✅ Type-safe: TypeScript union types handle different configs

**Implementation**:
```typescript
// Output types
type NotionOutputConfig = {
  notionToken: string
  databaseId: string
  fieldMapping: Record<string, any>
}

type GitHubOutputConfig = {
  githubToken: string
  repo: string  // "org/repo"
  labels: string[]
}

type OutputConfig = NotionOutputConfig | GitHubOutputConfig | ...

// Database column
outputConfig: jsonColumn('outputConfig').$default(() => ({}))
```

---

### 4. User Mappings: Scoped by Workspace ✅

**Decision**: Add `sourceWorkspaceId` to user mappings (not input-scoped)

**Problem**: Multiple Slack workspaces can have same user IDs:
- Workspace A: User "U12345" = John Doe
- Workspace B: User "U12345" = Jane Smith ❌ Collision!

**Solution**: Scope mappings by source workspace ID
```json
{
  "sourceType": "slack",
  "sourceWorkspaceId": "T_WORKSPACE_A",  // ← Unique per workspace
  "sourceUserId": "U12345",
  "notionUserId": "abc-notion-id"
}
```

**Benefits**:
- ✅ No collisions between workspaces
- ✅ Mappings reusable across flows (same workspace → same mappings)
- ✅ Simple: One table, no complex user registry

**Lookup**:
```typescript
const input = getFlowInput(inputId)
const mapping = getUserMapping({
  sourceType: 'slack',
  sourceWorkspaceId: input.sourceMetadata.slackTeamId,
  sourceUserId: 'U12345'
})
```

---

## Schema Designs

### 1. flows-schema.json

```json
{
  "name": {
    "type": "string",
    "meta": {
      "required": true,
      "maxLength": 200,
      "label": "Flow Name",
      "description": "Friendly name (e.g., 'Product Team Workflow')",
      "area": "main",
      "group": "basic"
    }
  },
  "description": {
    "type": "text",
    "meta": {
      "label": "Description",
      "description": "What does this flow do?",
      "area": "main",
      "group": "basic"
    }
  },
  "availableDomains": {
    "type": "array",
    "meta": {
      "label": "Available Domains",
      "description": "Domain tags for task routing (e.g., ['design', 'dev', 'product'])",
      "area": "main",
      "group": "routing",
      "default": ["design", "frontend", "backend", "product", "infrastructure", "docs"]
    }
  },
  "aiEnabled": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "AI Enabled",
      "description": "Use Claude AI for summarization and domain detection",
      "area": "sidebar",
      "group": "features"
    }
  },
  "anthropicApiKey": {
    "type": "string",
    "meta": {
      "label": "Claude API Key",
      "description": "Optional override (uses global if empty)",
      "area": "main",
      "group": "credentials"
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
  "active": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "Active",
      "description": "Is this flow enabled?",
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
  }
}
```

---

### 2. flow-inputs-schema.json

```json
{
  "flowId": {
    "type": "string",
    "refTarget": "flows",
    "meta": {
      "required": true,
      "label": "Flow",
      "description": "Parent flow this input belongs to",
      "area": "sidebar",
      "group": "relations"
    }
  },
  "sourceType": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source Type",
      "description": "slack, figma, linear, etc.",
      "area": "main",
      "group": "basic"
    }
  },
  "name": {
    "type": "string",
    "meta": {
      "required": true,
      "maxLength": 200,
      "label": "Input Name",
      "description": "User-friendly name (e.g., 'Design Team Slack')",
      "area": "main",
      "group": "basic"
    }
  },
  "apiToken": {
    "type": "string",
    "meta": {
      "label": "API Token",
      "description": "Source API token (Slack bot token, Figma token, etc.)",
      "area": "main",
      "group": "credentials"
    }
  },
  "webhookUrl": {
    "type": "string",
    "meta": {
      "label": "Webhook URL",
      "description": "For webhook-based sources",
      "area": "main",
      "group": "webhook"
    }
  },
  "webhookSecret": {
    "type": "string",
    "meta": {
      "label": "Webhook Secret",
      "description": "For signature verification",
      "area": "main",
      "group": "webhook"
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
      "description": "Unique identifier for email routing (e.g., 'team1')",
      "area": "main",
      "group": "email"
    }
  },
  "sourceMetadata": {
    "type": "json",
    "meta": {
      "label": "Source Metadata",
      "description": "Source-specific config (Slack: { slackTeamId, botUserId }, Figma: { fileKey })",
      "area": "sidebar",
      "group": "metadata"
    }
  },
  "active": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "Active",
      "description": "Is this input enabled?",
      "area": "sidebar",
      "group": "status"
    }
  }
}
```

---

### 3. flow-outputs-schema.json

```json
{
  "flowId": {
    "type": "string",
    "refTarget": "flows",
    "meta": {
      "required": true,
      "label": "Flow",
      "description": "Parent flow this output belongs to",
      "area": "sidebar",
      "group": "relations"
    }
  },
  "outputType": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Output Type",
      "description": "notion, github, linear, etc.",
      "area": "main",
      "group": "basic"
    }
  },
  "name": {
    "type": "string",
    "meta": {
      "required": true,
      "maxLength": 200,
      "label": "Output Name",
      "description": "User-friendly name (e.g., 'Design Tasks DB')",
      "area": "main",
      "group": "basic"
    }
  },
  "domainFilter": {
    "type": "array",
    "meta": {
      "label": "Domain Filter",
      "description": "Only accept tasks with these domains (empty = all)",
      "area": "main",
      "group": "routing"
    }
  },
  "isDefault": {
    "type": "boolean",
    "meta": {
      "default": false,
      "label": "Default Output",
      "description": "Fallback for tasks without matching domain",
      "area": "sidebar",
      "group": "routing"
    }
  },
  "outputConfig": {
    "type": "json",
    "meta": {
      "label": "Output Configuration",
      "description": "Output-specific settings (Notion: { notionToken, databaseId, fieldMapping }, GitHub: { githubToken, repo })",
      "area": "main",
      "group": "config"
    }
  },
  "active": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "Active",
      "description": "Is this output enabled?",
      "area": "sidebar",
      "group": "status"
    }
  }
}
```

---

### 4. Updated user-mapping-schema.json

```json
{
  "sourceType": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source Type",
      "description": "slack, figma, etc.",
      "area": "main",
      "group": "source"
    }
  },
  "sourceWorkspaceId": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source Workspace ID",
      "description": "Slack team ID, Figma org ID (prevents collisions)",
      "area": "main",
      "group": "source"
    }
  },
  "sourceUserId": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Source User ID",
      "description": "User ID in source system",
      "area": "main",
      "group": "source"
    }
  },
  "sourceUserEmail": {
    "type": "string",
    "meta": {
      "label": "Source User Email",
      "description": "User email for fallback matching",
      "area": "main",
      "group": "source"
    }
  },
  "notionUserId": {
    "type": "string",
    "meta": {
      "required": true,
      "label": "Notion User ID",
      "description": "Mapped Notion user ID",
      "area": "main",
      "group": "target"
    }
  },
  "active": {
    "type": "boolean",
    "meta": {
      "required": true,
      "default": true,
      "label": "Active",
      "description": "Is this mapping enabled?",
      "area": "sidebar",
      "group": "status"
    }
  }
}
```

---

## Migration Strategy

### Approach: Fresh Start (Archive Old Configs)

**Decision**: No automatic migration. Users create new flows from scratch.

**Rationale**:
- ✅ Clean slate: No legacy baggage, correct patterns from day 1
- ✅ User understands new model (forced learning through setup)
- ✅ Simpler implementation (no complex migration logic)
- ❌ User effort required (but OAuth makes it quick)

**Implementation**:
1. Create `discubot_configs_archived` table (copy of current schema + `archivedAt` timestamp)
2. Copy all existing configs to archived table
3. Show banner in UI: "Configs have been archived. Please create new flows."
4. Provide read-only view of archived configs for reference
5. Keep old webhook endpoints working during transition (redirect to archived notice)

**Timeline**:
- Announce migration 1 week in advance
- Archive on deployment day
- Support old webhooks for 2 weeks (grace period)
- Full cutover after 2 weeks

---

## Component Architecture

### Temporary Structure (During Development)

Protect custom components from crouton regeneration:

```
layers/discubot/
├── collections/          # Generated by crouton (regenerates)
│   ├── flows/
│   ├── flow-inputs/
│   └── flow-outputs/
│
├── components/          # TEMPORARY - Safe zone
│   ├── flows/          # Custom components
│   │   ├── FlowBuilder.vue         # Multi-step wizard
│   │   ├── InputManager.vue        # Add/edit inputs
│   │   ├── OutputManager.vue       # Add/edit outputs
│   │   └── PromptPreviewModal.vue  # Reused from configs
│   └── shared/
│       └── OAuthButton.vue
│
└── composables/        # Extracted logic (permanent)
    ├── useFlowOAuth.ts
    ├── useFieldMapping.ts
    ├── usePromptPreview.ts
    └── useNotionSchema.ts
```

### Final Structure (After Stabilization)

Once schema is stable, move components into collections:

```
layers/discubot/
├── collections/
│   ├── flows/
│   │   └── app/components/
│   │       ├── FlowBuilder.vue      # ← Moved
│   │       ├── Form.vue
│   │       └── List.vue
│   ├── flow-inputs/
│   │   └── app/components/
│   │       ├── InputManager.vue     # ← Moved
│   │       └── Form.vue
│   └── flow-outputs/
│       └── app/components/
│           ├── OutputManager.vue    # ← Moved
│           └── Form.vue
│
├── components/          # Only shared components
│   └── shared/
│       └── PromptPreviewModal.vue
│
└── composables/        # Shared logic
    └── ...
```

---

## Technical Challenges & Solutions

### Challenge 1: Finding Flow from Webhook

**Problem**: Webhook arrives, need to find which flow to process

**Solution**: Use input identifiers with indexed lookup

⚠️ **Performance Optimization**: Querying JSON columns (`sourceMetadata`) is slow and can't be indexed. After generating collections with Crouton, add a `sourceWorkspaceId` indexed field to `flow_inputs` for fast webhook lookups.

```typescript
// Initial approach (works but slower - JSON query)
const slackTeamId = body.team_id
const input = await getFlowInput({
  sourceType: 'slack',
  sourceMetadata: { slackTeamId }
})
const flow = await getFlow(input.flowId)

// Figma email webhook
const emailSlug = extractSlugFromEmail(to)
const input = await getFlowInput({ emailSlug })
const flow = await getFlow(input.flowId)
```

**Post-Generation Optimization** (add after Task 1 - Generate Collections):

```typescript
// In flow-inputs schema, add indexed field:
export const discubotFlowInputs = sqliteTable('discubot_flow_inputs', {
  // ... existing fields
  sourceType: text('sourceType').notNull(),
  sourceWorkspaceId: text('sourceWorkspaceId'),  // ← ADD: Extracted from sourceMetadata
  sourceMetadata: text('sourceMetadata', { mode: 'json' }),
  // ... rest of fields
}, (table) => ({
  // ADD: Composite index for fast webhook lookup
  sourceWorkspaceLookup: uniqueIndex('idx_source_workspace_lookup')
    .on(table.sourceType, table.sourceWorkspaceId),
}))

// Now webhook lookup is 10-100x faster (indexed query):
const input = await db
  .select()
  .from(discubotFlowInputs)
  .where(
    and(
      eq(discubotFlowInputs.sourceType, 'slack'),
      eq(discubotFlowInputs.sourceWorkspaceId, slackTeamId)
    )
  )
  .get()
```

### Challenge 2: Domain Routing Logic

**Problem**: One task might match multiple outputs, or no outputs

**Solution**: Confidence-based routing with clear winner detection

**Key Principle**: Each task goes to exactly ONE output. If multiple outputs match, use confidence scoring based on output specificity (narrower filters = higher confidence). Only use default output when no match or ambiguous (top candidates too close).

```typescript
/**
 * Calculate confidence score for an output matching a task
 * Confidence = inverse of filter breadth (narrower = more specific = higher confidence)
 */
function calculateOutputConfidence(task: DetectedTask, output: FlowOutput): number {
  // If domain doesn't match, confidence = 0
  if (!output.domainFilter.includes(task.domain)) {
    return 0
  }

  // Confidence = inverse of filter breadth
  // Examples:
  // - domainFilter: ["design"]                    → confidence = 1.0 (100%)
  // - domainFilter: ["design", "frontend"]        → confidence = 0.5 (50%)
  // - domainFilter: ["design", "ui", "backend"]   → confidence = 0.33 (33%)
  const specificity = 1 / output.domainFilter.length

  return specificity
}

/**
 * Route a single task to a single output using confidence-based matching
 */
async function routeTaskToOutput(task: DetectedTask, outputs: FlowOutput[]): FlowOutput {
  // Calculate confidence for each output (exclude default from scoring)
  const matches = outputs
    .filter(o => o.active && !o.isDefault)
    .map(output => ({
      output,
      confidence: calculateOutputConfidence(task, output)
    }))
    .filter(m => m.confidence > 0)  // Only keep matches
    .sort((a, b) => b.confidence - a.confidence)  // Highest confidence first

  // No matches → use default
  if (matches.length === 0) {
    return getDefaultOutput(outputs)
  }

  const best = matches[0]
  const secondBest = matches[1]

  // Single match → use it (confidence doesn't matter)
  if (!secondBest) {
    return best.output
  }

  // Multiple matches: Check if there's a clear winner
  const CONFIDENCE_GAP_THRESHOLD = 0.5  // Require 50% better confidence
  const confidenceGap = (best.confidence - secondBest.confidence) / secondBest.confidence

  if (confidenceGap >= CONFIDENCE_GAP_THRESHOLD) {
    // Clear winner: best is 50%+ better than runner-up
    console.log(
      `Task "${task.title}" domain="${task.domain}": ` +
      `${best.output.name} (${(best.confidence * 100).toFixed(0)}%) beats ` +
      `${secondBest.output.name} (${(secondBest.confidence * 100).toFixed(0)}%)`
    )
    return best.output
  }

  // Ambiguous: Top candidates too close → use default
  console.warn(
    `Task "${task.title}" domain="${task.domain}" is ambiguous: ` +
    `${best.output.name} (${(best.confidence * 100).toFixed(0)}%) vs ` +
    `${secondBest.output.name} (${(secondBest.confidence * 100).toFixed(0)}%). ` +
    `Using default.`
  )
  return getDefaultOutput(outputs)
}

function getDefaultOutput(outputs: FlowOutput[]): FlowOutput {
  const defaultOutput = outputs.find(o => o.isDefault && o.active)
  if (!defaultOutput) {
    throw new Error('No default output configured')
  }
  return defaultOutput
}

/**
 * Process all tasks from a discussion
 */
async function processDiscussionTasks(parsed: ParsedDiscussion, flow: Flow) {
  const detectedTasks = await detectTasks(parsed, flow.aiSettings)

  for (const task of detectedTasks) {
    const targetOutput = routeTaskToOutput(task, flow.outputs)
    await createTaskInOutput(task, targetOutput)
  }
}
```

**Routing Examples**:

```typescript
// Example 1: Clear winner (90% vs 5%)
Task: domain="design"
Outputs:
  - Design DB: domainFilter=["design"]           → confidence = 1.0 (100%)
  - All Tasks: domainFilter=["design", "dev", "product", "backend", ...]
                                                 → confidence = 0.05 (5%)
Gap = (1.0 - 0.05) / 0.05 = 19 (1900%) → Clear winner
✅ Result: Send to Design DB

// Example 2: Ambiguous (too close)
Task: domain="frontend"
Outputs:
  - Frontend DB: domainFilter=["frontend", "ui"]      → confidence = 0.5 (50%)
  - Dev DB:      domainFilter=["frontend", "backend"] → confidence = 0.5 (50%)
Gap = (0.5 - 0.5) / 0.5 = 0% → Too close
⚠️ Result: Send to Default Output

// Example 3: Single match
Task: domain="design"
Outputs:
  - Design DB: domainFilter=["design"] → confidence = 1.0 (100%)
Only one match
✅ Result: Send to Design DB

// Example 4: No matches
Task: domain="unknown"
Outputs:
  - Design DB: domainFilter=["design"]   → confidence = 0 (no match)
  - Dev DB:    domainFilter=["backend"]  → confidence = 0 (no match)
No matches
✅ Result: Send to Default Output
```

### Challenge 3: OAuth Flow Integration

**Problem**: OAuth creates configs, now needs to create flows + inputs

**Solution**: Update OAuth callback
```typescript
// Old: Create config
await createDiscubotConfig({ sourceType, apiToken, ... })

// New: Create flow + input
const flow = await createDiscubotFlow({ name, teamId, aiEnabled: true })
await createDiscubotFlowInput({
  flowId: flow.id,
  sourceType,
  apiToken,
  sourceMetadata: { slackTeamId, botUserId }
})
```

### Challenge 4: Backward Compatibility

**Problem**: Existing webhooks pointing to old configs

**Solution**: Support both during transition
```typescript
// Check if flow-based or config-based
const flow = await findFlowByInput(inputId)
if (flow) {
  // New flow-based processing
  await processWithFlow(parsed, flow)
} else {
  // Legacy config-based processing
  const config = await findConfig(teamId, sourceType)
  await processWithConfig(parsed, config)
}
```

After transition period, remove config-based logic.

---

## Success Metrics

### Technical Metrics
- [ ] Zero data loss during migration
- [ ] All existing webhooks continue working (via compatibility layer)
- [ ] API response times < 500ms (same as current)
- [ ] Type checking passes: `npx nuxt typecheck`
- [ ] Test coverage maintained at 80%+

### User Experience Metrics
- [ ] Flow creation time < 5 minutes (including OAuth)
- [ ] User can add 2nd input to existing flow in < 2 minutes
- [ ] Domain-based routing accuracy > 90% (AI correctly assigns domains)
- [ ] Zero production errors during first week post-launch

### Business Metrics
- [ ] 80% of users create at least one flow within 1 week
- [ ] Average flow has 2+ inputs (proving multi-input value)
- [ ] 50% of flows use domain-based routing (2+ outputs with filters)

---

## Risks & Mitigations

### Risk 1: Schema Changes After Generation
**Impact**: High - Would lose custom components
**Mitigation**: Keep components in temp location during development, move after stabilization
**Timeline**: 2-3 iterations expected before schema locks

### Risk 2: User Confusion During Migration
**Impact**: Medium - Support tickets, frustrated users
**Mitigation**:
- Clear documentation and migration guide
- Video walkthrough of flow creation
- In-app tooltips and wizard
- 1:1 support for early users

### Risk 3: Performance Degradation
**Impact**: Medium - Slower processing with multiple queries
**Mitigation**:
- Load flow + inputs + outputs in single query (JOIN)
- Cache flow configuration per request
- Monitor performance metrics closely
- Optimize after launch if needed

### Risk 4: AI Domain Detection Inaccuracy
**Impact**: Medium - Tasks routed to wrong outputs
**Mitigation**:
- Provide domain override in UI (user can manually change)
- Show AI confidence score
- Default output as safety net
- Collect feedback and retrain prompts

---

## Timeline & Phases

See `FLOWS_REDESIGN_TRACKER.md` for detailed task breakdown.

**Summary**:
- **Phase 1**: Schema Design & Generation (2-3h)
- **Phase 2**: Backend Updates (5-7h)
- **Phase 3**: Custom UI Components (8-10h)
- **Phase 4**: Testing & Migration (4-6h)
- **Phase 5**: Cleanup & Organization (2-3h)

**Total**: 21-29 hours (3-4 days)

---

## Open Questions

1. **Domain vocabulary**: Start with default list or completely freeform?
   - **Decision**: Start with default list, allow customization per flow
2. ~~**Output priority**: If task matches multiple outputs, create in all or first match?~~
   - **✅ RESOLVED**: Use confidence-based routing. Each task goes to ONE output. If multiple matches, calculate confidence scores (narrower filter = higher confidence). Pick clear winner (50%+ gap), otherwise use default. See Challenge 2 for implementation.
3. **Input deduplication**: If same Slack workspace added to 2 flows, how to handle?
   - Allow it for now, can add validation later if issues arise
4. **Config import**: Provide tool to convert archived config → flow + input + output?
   - Not needed (solo developer, no existing users)
5. **Crouton custom components**: Does crouton support marking components as custom (don't regenerate)?
   - Use temporary components folder during schema stabilization, move after

---

## Next Steps

1. **Review & Approve**: Team reviews this briefing, provides feedback
2. **Create Tracker**: Set up `FLOWS_REDESIGN_TRACKER.md` with task breakdown
3. **Schema Finalization**: Lock down schemas, no more changes
4. **Kickoff Phase 1**: Begin schema design and collection generation

---

**Document Version**: 1.1
**Last Updated**: 2025-11-20 (Architecture review with Nuxt Architect)
**Owner**: Development Team
**Reviewers**: Product, Engineering

**Changelog**:
- v1.1 (2025-11-20): Added confidence-based routing logic for domain matching, added webhook lookup performance optimization notes, resolved open questions
- v1.0 (2025-11-20): Initial briefing

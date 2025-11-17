# Phase 14: Smart Field Mapping - Execution Briefing

## Context

**Project**: Discubot v1 - Discussion tracking bot (Figma/Slack → Notion)
**Current Phase**: Phase 14 - Smart Field Mapping with User Integration
**Status**: Ready for execution (0/4 tasks complete)
**Estimated Time**: 6-8 hours
**Dependencies**: Phase 12 (Custom AI Prompts) ✅ Complete

**Goal**: Connect existing infrastructure to intelligently populate Notion task properties using AI-detected data, user mappings, and fuzzy value matching - all while maintaining data quality through confidence-based filling.

## What Already Exists (Verified)

### ✅ AI Detection Infrastructure
- `DetectedTask` interface (`/layers/discubot/types/index.ts` lines 53-60)
- Already supports null values via TypeScript optionals (?)
- Fields: title, description, priority, assignee, dueDate, tags
- AI service at `/layers/discubot/server/services/ai.ts` (492 lines)
- Custom prompts already wired (Phase 12 complete)

### ✅ User Mapping System
- Table: `discubot_usermappings` with complete schema
- Service: `/layers/discubot/server/services/userMapping.ts` (387 lines)
- Key functions ready: `resolveToNotionUser()`, `syncFromSlack()`, `syncFromFigma()`
- Production-ready with confidence scoring and email matching

### ✅ Notion Integration
- Service: `/layers/discubot/server/services/notion.ts` (598 lines)
- `buildTaskProperties()` exists (lines 64-74) - simple, ready to enhance
- `formatNotionProperty()` exists (lines 520-597) - handles 11 property types
- **Missing**: 'people' case (needs 5 min fix in Task 14.3A)

### ✅ Database Schema
- `notionFieldMapping` column exists (jsonColumn type, default {})
- Located in `/layers/discubot/collections/configs/server/database/schema.ts` line 34
- Already in use in config form (JSON textarea)

### ✅ Processor Integration
- File: `/layers/discubot/server/services/processor.ts` (1066 lines)
- Line 171: `notionFieldMapping` already loaded from config
- Line 713-726: Custom prompts passed to AI
- Line 748-805: Task creation flow ready for field mapping integration

### ✅ Existing UI
- Form: `/layers/discubot/collections/configs/app/components/Form.vue`
- Line 269-279: `notionFieldMapping` field with JSON textarea
- Ready to enhance with structured Nuxt UI 4 components

## What Needs to Be Built

### 🔴 Missing Components (Task 14.2)

1. **Schema Introspection API** - `/layers/discubot/server/api/notion/schema/[databaseId].get.ts`
   - Calls `notion.databases.retrieve()`
   - Returns parsed schema with property types and options

2. **Field Mapping Utilities** - `/layers/discubot/server/utils/field-mapping.ts`
   - `generateDefaultMapping()` - fuzzy matches AI fields → Notion properties
   - `transformValue()` - simple string matching for value transformation

### ⚠️ Gaps to Fix

1. `formatNotionProperty()` - Add missing 'people' case (5 min fix)
2. `buildTaskProperties()` - Enhance to accept field mappings and user mappings
3. Processor - Wire user mappings into task creation flow
4. UI - Replace JSON textarea with structured Nuxt UI 4 form

## Task Breakdown (Sequential Execution)

### Task 14.1: Standardize AI Output & Add Confidence Rules (1-2h)

**Goal**: Make AI return null when uncertain, standardize vocabulary

**Actions**:
1. Open `/layers/discubot/server/services/ai.ts`
2. Update `detectTasks()` prompt (around line 304-331):
   - Add rule: "Only fill fields if confident, otherwise return null"
   - Standardize: `priority: 'low'|'medium'|'high'|'urgent'|null`
   - Standardize: `type: 'bug'|'feature'|'question'|'improvement'|null`
   - For assignee: "Return Slack user ID (U...) or email, NOT display name"
3. Test with vague discussions (e.g., "maybe we should look into this sometime")
4. Verify AI returns null for uncertain fields
5. Run `npx nuxt typecheck`

**Files Modified**:
- `/layers/discubot/server/services/ai.ts`
- `/layers/discubot/types/ai.ts` (if DetectedTask needs explicit null types)

**Success Criteria**:
- AI returns null when uncertain about priority/type/assignee
- Standardized vocabulary in responses
- No type errors

---

### Task 14.2: Schema Introspection + Auto-Mapping (3-4h)

**Goal**: Fetch Notion schema, generate smart default mappings, transform values

#### Subtask A: Schema Fetching API (1.5h)

**Actions**:
1. Create `/layers/discubot/server/api/notion/schema/[databaseId].get.ts`
2. Get database ID from route params
3. Use existing `getNotionClient()` pattern from notion.ts
4. Call `notion.databases.retrieve({ database_id })`
5. Parse properties: extract name, type, select/multi-select options
6. Return JSON: `{ properties: { Priority: { type: 'select', options: ['P1','P2','P3'] } } }`
7. Store in `config.sourceMetadata.notionSchema` (column already exists)

**Example Response**:
```json
{
  "properties": {
    "Priority": { "type": "select", "options": ["P1", "P2", "P3"] },
    "Assignee": { "type": "people" },
    "Type": { "type": "select", "options": ["Bug", "Feature", "Question"] }
  }
}
```

#### Subtask B: Auto-Mapping Logic (1h)

**Actions**:
1. Create `/layers/discubot/server/utils/field-mapping.ts`
2. Implement `generateDefaultMapping()`:
   - Input: Notion schema from API
   - Fuzzy match AI fields → Notion properties by name
   - Simple string similarity (e.g., "priority" matches "Priority", "Pri", "Task Priority")
   - Include property type from schema
   - Return mapping object

**Example Output**:
```typescript
{
  priority: {
    notionProperty: "Priority",
    propertyType: "select",
    valueMap: { high: "P1", medium: "P2", low: "P3", urgent: "P0" }
  },
  assignee: {
    notionProperty: "Assignee",
    propertyType: "people",
    valueMap: {}
  }
}
```

#### Subtask C: Value Transformation (0.5-1h)

**Actions**:
1. In same file, implement `transformValue(aiValue, selectOptions, valueMap?)`
2. Case-insensitive partial matching: "high" → "P1"
3. Check valueMap first (if provided), then fuzzy match options
4. Fallback: return original value if no match (graceful degradation)
5. No AI service needed - just string matching

**Files Created**:
- `/layers/discubot/server/api/notion/schema/[databaseId].get.ts`
- `/layers/discubot/server/utils/field-mapping.ts`

**Success Criteria**:
- API returns valid Notion schema
- `generateDefaultMapping()` matches common field names
- `transformValue()` handles case-insensitive matching
- No type errors

---

### Task 14.3: Integrate User Mapping for People Fields (2-3h)

**Goal**: Wire user mappings into task property building

#### Subtask A: Fix formatNotionProperty() - Add 'people' case (0.5h) ⚠️ DO THIS FIRST

**Actions**:
1. Open `/layers/discubot/server/services/notion.ts`
2. Find `formatNotionProperty()` function (lines 520-597)
3. Add 'people' case before the default case (around line 586):
```typescript
case 'people': {
  const userIds = Array.isArray(value) ? value : [value]
  return {
    people: userIds
      .filter(id => id) // Remove null/undefined
      .map(id => ({ object: 'user', id: String(id) }))
  }
}
```
4. Handle arrays and null values properly
5. Run `npx nuxt typecheck`

#### Subtask B: Update buildTaskProperties() (1.5-2h)

**Actions**:
1. Open `/layers/discubot/server/services/notion.ts`
2. Find `buildTaskProperties()` (lines 64-74)
3. Modify function signature:
```typescript
function buildTaskProperties(
  task: DetectedTask,
  fieldMapping?: Record<string, any>,
  userMappings?: any[]
): Record<string, any>
```
4. For each DetectedTask field (priority, type, assignee, etc.):
   - Check if field is non-null
   - Look up mapping in fieldMapping config
   - If property type is 'people':
     - Use `resolveToNotionUser()` with userMappings
     - Pass Slack/Figma user ID from task.assignee
   - If property type is 'select':
     - Apply `transformValue()` with valueMap from field mapping
   - Format with `formatNotionProperty(propertyType, transformedValue)`
   - Skip fields with null values (don't force when AI uncertain)
5. Return enhanced properties object

#### Subtask C: Update Discussion Processor (0.5h)

**Actions**:
1. Open `/layers/discubot/server/services/processor.ts`
2. Around line 748-805 (task creation flow):
   - Load user mappings for team/source using existing `getUserMappings()` composable
   - Pass to `buildTaskProperties()` along with `config.notionFieldMapping`
3. Add logging:
   - Log warning when assignee has no user mapping (skip field gracefully)
   - Log successful field mapping applications
4. Ensure graceful degradation (missing mappings = skip field, don't crash)

**Files Modified**:
- `/layers/discubot/server/services/notion.ts`
- `/layers/discubot/server/services/processor.ts`

**Success Criteria**:
- `formatNotionProperty()` handles 'people' type
- `buildTaskProperties()` populates Notion fields correctly
- User mappings resolve assignee to Notion user ID
- Graceful handling when mappings missing
- No type errors

---

### Task 14.4: Field Mapper UI with Nuxt UI Components (1.5-2h)

**Goal**: Build clean, accessible UI for field mapping configuration

#### Subtask A: Schema Fetch Button (0.5h)

**Actions**:
1. Open `/layers/discubot/collections/configs/app/components/Form.vue`
2. Find `notionFieldMapping` section (around line 269-279)
3. Add button above JSON textarea:
   - Text: "Fetch Notion Schema & Auto-Generate Mappings"
   - Use `UButton` component
   - Click handler:
     - Calls `/api/notion/schema/${config.notionDatabaseId}`
     - Calls `generateDefaultMapping(schema)`
     - Pre-fills form with suggested mappings
4. Show loading state during fetch

#### Subtask B: Field Mapping Form (1-1.5h)

**Actions**:
1. Replace or enhance JSON textarea with structured form
2. For each AI field (priority, type, assignee):
   - Row layout:
     - Label: AI field name (e.g., "Priority")
     - `USelectMenu`: Select Notion property from fetched schema
     - `UBadge`: Show property type (select/people/text/etc)
     - `UInput`: Value mapping (e.g., "high → P1, medium → P2")
3. Use Nuxt UI 4 components:
   - `UForm` for form wrapper
   - `UFormField` for each field
   - `USelectMenu` for property selection
   - `UBadge` for type display
   - `UInput` for value transformations
4. Keep JSON textarea in `UCollapsible` labeled "Advanced: JSON Editor" (fallback for power users)
5. Use semantic form layout, not custom tables

#### Subtask C: User Mapping Integration Hint (0.5h)

**Actions**:
1. When user maps 'assignee' field to a 'people' property type:
   - Show `UAlert` (info variant): "Assignee mapping requires user mappings to be configured"
   - Add link/button to user mapping management page (/user-mappings or similar)
2. Check if team has any user mappings:
   - If none exist, show warning `UAlert`
   - Suggest running "Sync Users" from Slack/Figma

**Files Modified**:
- `/layers/discubot/collections/configs/app/components/Form.vue`

**Success Criteria**:
- "Fetch Notion Schema" button works
- Auto-generated mappings are reasonable
- Form allows manual field mapping adjustments
- `UAlert` shows when user mappings needed
- JSON editor available as fallback
- No type errors

---

## Execution Workflow (MANDATORY)

For each task:

1. **Mark in Progress**:
   - Edit `/docs/PROGRESS_TRACKER.md`
   - Change `[ ]` to `🔄` for current task
   - Use `TodoWrite` to track the 5 steps

2. **Do The Work**:
   - Follow task actions above
   - Keep it simple (KISS principle)

3. **Run Type Checking**:
   - Run: `npx nuxt typecheck`
   - Fix any errors immediately

4. **Update Progress Tracker**:
   - Edit `/docs/PROGRESS_TRACKER.md`
   - Change `🔄` to `[x] ✅`
   - Update "Quick Stats" table
   - Update phase progress percentage
   - Add notes in Daily Log

5. **Git Commit**:
   - Stage ONLY task-related files: `git add <specific-files>`
   - NEVER use `git add .`
   - Commit format: `feat: [description] (Task 14.X)`
   - Example: `feat: add AI confidence rules (Task 14.1)`

## Key Technical Patterns

### Nuxt UI 4 Components (MANDATORY)
- Use `UForm`, `UFormField`, `USelectMenu`, `UBadge`, `UInput`, `UButton`, `UAlert`, `UCollapsible`
- NEVER use v2/v3 components (`UDropdown` → `UDropdownMenu`, `UDivider` → `USeparator`)
- Always use Composition API with `<script setup lang="ts">`

### Error Handling
```typescript
try {
  const data = await $fetch('/api/endpoint')
  return { data, error: null }
} catch (error) {
  console.error('Operation failed:', error)
  return { data, null, error }
}
```

### Graceful Degradation
- If user mapping missing → skip assignee field, log warning
- If value transformation fails → use original value
- If schema fetch fails → allow manual JSON editing

## Success Criteria (Phase 14 Complete)

- All 4 tasks marked complete in PROGRESS_TRACKER.md
- AI returns null when uncertain (high data quality)
- Field mappings configured via clean Nuxt UI form
- Assignees properly resolved to Notion users
- Simple fuzzy matching transforms values (no AI overhead)
- All data persists in existing database columns
- Graceful degradation ensures nothing breaks
- `npx nuxt typecheck` passes
- All commits follow conventional format
- Quick Stats updated in PROGRESS_TRACKER.md

## Expected Output

After Phase 14 completion, users will be able to:
1. Click "Fetch Schema" to auto-generate field mappings
2. Customize mappings in a clean UI (or use JSON for advanced cases)
3. Have AI-detected tasks create Notion items with:
   - Mapped priority values (e.g., "high" → "P1")
   - Mapped task types (e.g., "bug" → "Bug")
   - Assigned people (e.g., Slack user U123 → Notion user via mapping)
4. See null values when AI is uncertain (maintaining data quality)
5. Get warnings when user mappings are missing

## Files You'll Touch

**Create**:
- `/layers/discubot/server/api/notion/schema/[databaseId].get.ts`
- `/layers/discubot/server/utils/field-mapping.ts`

**Modify**:
- `/layers/discubot/server/services/ai.ts` (Task 14.1)
- `/layers/discubot/server/services/notion.ts` (Tasks 14.3A, 14.3B)
- `/layers/discubot/server/services/processor.ts` (Task 14.3C)
- `/layers/discubot/collections/configs/app/components/Form.vue` (Task 14.4)
- `/docs/PROGRESS_TRACKER.md` (after each task)

## Critical Reminders

- ✅ ALWAYS run `npx nuxt typecheck` after code changes
- ✅ ALWAYS update PROGRESS_TRACKER.md before committing
- ✅ ONLY stage task-related files - Use `git add <specific-files>`
- ✅ Sequential execution - Task 14.1 → 14.2 → 14.3 → 14.4
- ❌ NEVER use `git add .` - always specify exact files
- ❌ NEVER skip the commit step - Every task = One commit

## Questions to Ask User (If Needed)

1. Should value mappings be case-sensitive or case-insensitive? (Recommend: insensitive)
2. Should we validate that mapped Notion properties actually exist? (Recommend: yes, warn in UI)
3. Should we support mapping multiple AI fields to same Notion property? (Recommend: no, keep 1:1)

---

**Ready to execute**: Start with Task 14.1, follow the 5-step workflow, and proceed sequentially through all 4 tasks. The codebase is ready, infrastructure exists, and Phase 12 (dependency) is complete.

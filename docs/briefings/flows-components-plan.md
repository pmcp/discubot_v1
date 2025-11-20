# Flows Component Migration Plan

**Date**: 2025-11-20
**Status**: Planning
**Related**: Task 1.4 - Flows Redesign Pre-Migration

---

## Executive Summary

This document maps existing custom features from the configs components to the new flows architecture. It provides a detailed checklist of components to build, feature-by-feature mapping, implementation priorities, and reusable patterns.

**Goal**: Rebuild config management UI as flow-based UI while preserving all custom functionality.

---

## Component Checklist

### Phase 6: Custom UI Components (8-10h)

- [ ] **FlowBuilder.vue** (3-4h) - Main wizard component
- [ ] **InputManager.vue** (2h) - Add/edit inputs
- [ ] **OutputManager.vue** (2-3h) - Add/edit outputs
- [ ] **FlowList.vue** (1h) - Table of flows
- [ ] **FlowForm.vue** (Optional) - Standalone form if wizard too complex

### Shared/Reusable Components

- [x] **PromptPreviewModal.vue** - Already in `components/shared/`
- [ ] **OAuthButton.vue** - Extract if needed for reuse
- [ ] **NotionFieldMapper.vue** - Could extract field mapping UI
- [ ] **DomainFilterSelector.vue** - Multi-select for domain filters

---

## Feature Mapping Matrix

### From configs Form.vue → To flows Components

| Feature | Current (configs Form.vue) | New Component | Priority | Notes |
|---------|---------------------------|---------------|----------|-------|
| **OAuth Integration** | `openOAuthPopup()` | FlowBuilder.vue (Step 2) + InputManager.vue | High | Reuse `useFlowOAuth` composable |
| **Notion Schema Fetch** | `fetchNotionSchema()` button | OutputManager.vue | High | Reuse `useNotionSchema` composable |
| **Field Mapping UI** | Priority/Type/Assignee cards | OutputManager.vue | High | Reuse `useFieldMapping` composable |
| **Prompt Preview** | `openPromptPreview()` button | FlowBuilder.vue (Step 1) | Medium | Reuse existing `PromptPreviewModal` |
| **Preset Examples** | Dropdown with templates | FlowBuilder.vue (Step 1) | Medium | Copy preset data, adapt UI |
| **User Mapping Hint** | UAlert when assignee mapped | OutputManager.vue | Medium | Copy UAlert logic |
| **Advanced JSON Editor** | UCollapsible with JSON | OutputManager.vue | Low | Copy UCollapsible pattern |
| **Source-Specific Sections** | Dynamic v-show sections | InputManager.vue | High | Adapt for Slack/Figma/email |

### From configs List.vue → To FlowList.vue

| Feature | Current (configs List.vue) | New Component | Priority | Notes |
|---------|---------------------------|---------------|----------|-------|
| **OAuth Status Cell** | Green badge with checkmark | FlowList.vue | High | Show OAuth status per input |
| **Workspace Name Cell** | Extract from sourceMetadata | FlowList.vue | High | Show primary workspace name |
| **Enhanced Columns** | Custom column definitions | FlowList.vue | High | Add Input Count, Output Count |
| **Table Layout** | CroutonCollection | FlowList.vue | High | Use same pattern |

### Shared Components

| Feature | Current Location | New Location | Priority | Notes |
|---------|-----------------|--------------|----------|-------|
| **Prompt Preview Modal** | configs/components/ | components/shared/ | Done ✅ | Already copied in Task 1.2 |
| **OAuth Popup Logic** | Inline in Form.vue | useFlowOAuth.ts | Done ✅ | Extracted in Task 1.1 |
| **Field Mapping Logic** | Inline in Form.vue | useFieldMapping.ts | Done ✅ | Extracted in Task 1.1 |
| **Schema Fetching** | Inline in Form.vue | useNotionSchema.ts | Done ✅ | Extracted in Task 1.1 |

---

## Component Specifications

### 1. FlowBuilder.vue (Main Wizard)

**Location**: `layers/discubot/components/flows/FlowBuilder.vue` (temporary)
**Final Location**: `layers/discubot/collections/flows/app/components/FlowBuilder.vue`

#### Purpose
Multi-step wizard for creating/editing flows with guided UX.

#### Steps
1. **Flow Settings** (Step 1)
   - Flow name and description
   - AI enabled toggle
   - Custom AI prompts (summary, task detection)
   - Prompt preview button → PromptPreviewModal
   - Preset examples dropdown
   - Available domains (multi-input for custom tags)
   - Default domains: `["design", "frontend", "backend", "product", "infrastructure", "docs"]`

2. **Add Inputs** (Step 2)
   - List of current inputs (if editing)
   - "Add Input" button → Dropdown: Slack, Figma, Email
   - For Slack: OAuth button using `useFlowOAuth`
   - For Figma/Email: Manual form (email slug, address)
   - Input cards showing: name, source type, status
   - Edit/delete actions per input

3. **Add Outputs** (Step 3)
   - List of current outputs (if editing)
   - "Add Output" button → Dropdown: Notion, GitHub, Linear
   - Output form (see OutputManager.vue spec)
   - Output cards showing: name, type, domain filters, default badge
   - Edit/delete actions per output
   - Validation: At least one default output required

#### Features to Implement

**From configs Form.vue:**
- ✅ AI prompts configuration (Step 1)
- ✅ Prompt preview button → Modal (Step 1)
- ✅ Preset examples dropdown (Step 1)
- ✅ OAuth popup for Slack (Step 2)
- ✅ Source-specific forms (Step 2)

**New Features:**
- Multi-step wizard navigation (UStepper)
- Available domains configuration
- Multiple inputs management
- Multiple outputs management
- Validation: Require at least one default output

#### Composables Used
- `useFlowOAuth` - OAuth popup handling
- `usePromptPreview` - Prompt preview modal
- `useNotionSchema` - Schema fetching (passed to outputs)
- `useFieldMapping` - Field mapping (passed to outputs)

#### UI Components
- `UStepper` - Wizard navigation
- `UForm` - Form validation
- `UFormField` - Field wrappers
- `UInput` - Text inputs
- `UTextarea` - Description, prompts
- `USwitch` - AI enabled toggle
- `UButton` - Actions, navigation
- `UCard` - Input/output cards
- `UBadge` - Status indicators

---

### 2. InputManager.vue

**Location**: `layers/discubot/components/flows/InputManager.vue` (temporary)
**Final Location**: `layers/discubot/collections/flow-inputs/app/components/InputManager.vue`

#### Purpose
Standalone component for managing inputs in a flow. Can be used in FlowBuilder or as standalone page.

#### Features to Implement

**From configs Form.vue:**
- ✅ OAuth popup for Slack using `useFlowOAuth`
- ✅ Source-specific forms (Slack vs Figma vs Email)
- ✅ Input validation

**New Features:**
- List of inputs with cards
- Add input button → Type selector (Slack/Figma/Email)
- Edit input modal/slideover
- Delete input confirmation
- Show input status:
  - OAuth connection status (for Slack)
  - Webhook URL (copyable)
  - Active/inactive toggle
  - Workspace name/identifier

#### Input Types & Fields

**Slack Input:**
- Name (user-friendly, e.g., "Product Team Slack")
- OAuth button → Popup flow
- Shows: Workspace name, team ID, bot user ID
- Webhook URL (generated, read-only)

**Figma Input:**
- Name (e.g., "Design Files")
- Email slug (unique identifier)
- Email address (full address for display)
- Shows: Figma file key (optional)

**Email Input (Generic):**
- Name
- Email slug
- Email address

#### Composables Used
- `useFlowOAuth` - OAuth handling

#### UI Components
- `UCard` - Input cards
- `UButton` - Add, edit, delete
- `UModal` or `USlideover` - Edit form
- `UBadge` - Status indicators
- `UInput` - Form fields
- `UAlert` - Warnings, info

---

### 3. OutputManager.vue

**Location**: `layers/discubot/components/flows/OutputManager.vue` (temporary)
**Final Location**: `layers/discubot/collections/flow-outputs/app/components/OutputManager.vue`

#### Purpose
Manage outputs in a flow. Handles Notion, GitHub, Linear configurations with domain-based routing.

#### Features to Implement

**From configs Form.vue:**
- ✅ Notion schema fetching with auto-mapping (`fetchNotionSchema()`)
- ✅ Field mapping UI (Priority, Type, Assignee cards)
- ✅ Property type badges with colors
- ✅ Value mapping inputs (AI → Notion transformations)
- ✅ User mapping integration hint (UAlert for assignee)
- ✅ Advanced JSON editor (UCollapsible)

**New Features:**
- Output type selector (Notion/GitHub/Linear)
- Domain filter selector (multi-select from flow.availableDomains)
- isDefault checkbox (with validation: exactly one required)
- Output-specific configuration forms
- Output cards showing: name, type, domain filters, status

#### Output Configuration Forms

**Notion Output:**
- Name (e.g., "Design Tasks DB")
- Domain filter (multi-select: ["design", "frontend"])
- isDefault checkbox
- Notion token (password field)
- Database ID
- "Fetch Schema & Auto-Map" button
- Field mapping UI:
  - Priority → Notion property (USelectMenu)
  - Type → Notion property (USelectMenu)
  - Assignee → Notion property (USelectMenu)
  - Property type badges (select/status/people)
  - Value mapping inputs for select/status
  - User mapping hint UAlert for people
- Advanced: JSON editor (UCollapsible)

**GitHub Output (Future):**
- Name
- Domain filter
- isDefault checkbox
- GitHub token
- Repository (org/repo)
- Labels (multi-input)

**Linear Output (Future):**
- Name
- Domain filter
- isDefault checkbox
- Linear API key
- Team ID
- Project ID (optional)
- Labels/tags

#### Validation Rules
- At least one output must have `isDefault: true`
- Domain filters can be empty (accepts all)
- Cannot have multiple outputs with `isDefault: true`

#### Composables Used
- `useNotionSchema` - Schema fetching
- `useFieldMapping` - Auto-mapping, fuzzy matching, value transformation

#### UI Components
- `UCard` - Output cards
- `USelectMenu` - Property selection, domain filter
- `UBadge` - Property types, status
- `UInput` - Name, tokens, value mappings
- `UButton` - Fetch schema, save
- `UCheckbox` - isDefault
- `UAlert` - User mapping hint
- `UCollapsible` - Advanced JSON editor
- `UFormField` - Field wrappers

---

### 4. FlowList.vue

**Location**: `layers/discubot/components/flows/FlowList.vue` (temporary)
**Final Location**: `layers/discubot/collections/flows/app/components/FlowList.vue`

#### Purpose
Display table of flows with status, input/output counts, and actions.

#### Features to Implement

**From configs List.vue:**
- ✅ Custom table cells (OAuth status, workspace name)
- ✅ Enhanced columns beyond Crouton defaults
- ✅ CroutonCollection layout
- ✅ CroutonTableHeader with create button

**New Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Name | Text | Flow name |
| Description | Text | Truncated description |
| Inputs | Badge | Count of inputs (e.g., "2 inputs") |
| Outputs | Badge | Count of outputs (e.g., "3 outputs") |
| OAuth Status | Custom Cell | Green badge if any input has OAuth |
| Active | Badge | Active/inactive status |
| Last Updated | Date | Formatted timestamp |
| Actions | Buttons | Edit, Delete |

#### Custom Cells

**Inputs Cell:**
- Show count: "2 inputs"
- Badge color based on count (gray if 0, blue if 1+)
- Hover tooltip: List input names

**Outputs Cell:**
- Show count: "3 outputs"
- Badge color based on count (gray if 0, green if 1+)
- Hover tooltip: List output names
- Show warning badge if no default output

**OAuth Status Cell:**
- Check if any input has OAuth connection
- Green "OAuth Connected" badge if yes
- Gray "Not Connected" if no
- Reuse logic from configs List.vue

**Active Cell:**
- Green "Active" or gray "Inactive" badge

#### Composables Used
- None specific (uses Crouton composables)

#### UI Components
- `CroutonCollection` - Table layout
- `CroutonTableHeader` - Header with create button
- `UBadge` - Status indicators, counts
- Custom cell templates - OAuth status, input/output counts

---

## Implementation Priority

### Phase 1: Core Functionality (High Priority)

1. **FlowBuilder.vue - Step 1 (Flow Settings)** - 1h
   - Flow name, description, AI toggle
   - AI prompts with preview button
   - Available domains input

2. **InputManager.vue - Basic** - 1h
   - Add Slack input with OAuth
   - Add Figma input with email slug
   - List inputs with cards

3. **OutputManager.vue - Notion Only** - 2h
   - Add Notion output form
   - Schema fetching with auto-mapping
   - Field mapping UI (Priority, Type, Assignee)
   - Domain filter selector
   - isDefault checkbox

4. **FlowList.vue - Basic** - 0.5h
   - Table with name, inputs count, outputs count
   - Edit/delete actions

### Phase 2: Enhanced UX (Medium Priority)

5. **FlowBuilder.vue - Steps 2-3** - 1.5h
   - Integrate InputManager into Step 2
   - Integrate OutputManager into Step 3
   - Wizard navigation with UStepper
   - Validation between steps

6. **InputManager.vue - Enhanced** - 0.5h
   - Edit input modal
   - Delete confirmation
   - Webhook URL display
   - Status indicators

7. **OutputManager.vue - Enhanced** - 0.5h
   - User mapping hint UAlert
   - Advanced JSON editor
   - Value mapping UI improvements

8. **FlowList.vue - Enhanced** - 0.5h
   - OAuth status cell
   - Hover tooltips
   - Active status badges

### Phase 3: Nice-to-Haves (Low Priority)

9. **Preset Examples** - 0.5h
   - Dropdown in FlowBuilder Step 1
   - One-click preset insertion

10. **GitHub/Linear Outputs** - 1-2h
    - Add output type selector
    - GitHub output form
    - Linear output form

11. **Testing Mode** - 1h
    - Test routing button
    - Show which tasks would route where
    - Preview without creating tasks

---

## Reusable Patterns

### 1. OAuth Popup Pattern

**From**: configs Form.vue `openOAuthPopup()`
**To**: `useFlowOAuth` composable (already extracted)
**Usage**: InputManager.vue, FlowBuilder.vue

```vue
<script setup>
import { useFlowOAuth } from '#layers/discubot/app/composables/useFlowOAuth'

const { openOAuthPopup, listenForOAuthSuccess } = useFlowOAuth()

// Open popup
const connectSlack = () => {
  openOAuthPopup('/api/oauth/slack')
}

// Listen for success
onMounted(() => {
  listenForOAuthSuccess((data) => {
    toast.add({ title: 'OAuth successful!' })
    // Refresh flow data
  })
})
</script>
```

---

### 2. Schema Fetching & Auto-Mapping

**From**: configs Form.vue `fetchNotionSchema()`
**To**: `useNotionSchema` composable (already extracted)
**Usage**: OutputManager.vue

```vue
<script setup>
import { useNotionSchema } from '#layers/discubot/app/composables/useNotionSchema'
import { useFieldMapping } from '#layers/discubot/app/composables/useFieldMapping'

const { fetchSchema, schemaProperties } = useNotionSchema()
const { generateDefaultMapping } = useFieldMapping()

const autoMapFields = async () => {
  await fetchSchema(notionToken, databaseId)
  const mappings = generateDefaultMapping(schemaProperties.value)
  // Apply mappings to form
  fieldMappings.value = mappings
}
</script>
```

---

### 3. Field Mapping UI

**From**: configs Form.vue field mapping cards
**To**: OutputManager.vue (reuse exact UI)

**Pattern**: For each AI field (priority, type, assignee):
1. USelectMenu for Notion property selection
2. UBadge showing property type
3. Value mapping inputs (for select/status types)
4. User mapping hint (for people type)

```vue
<template>
  <UCard>
    <template #header>
      <h4>Priority Mapping</h4>
    </template>

    <!-- Property selection -->
    <UFormField label="Notion Property">
      <USelectMenu
        v-model="fieldMappings.priority.notionProperty"
        :items="schemaProperties"
        placeholder="Select property..."
      />
    </UFormField>

    <!-- Property type badge -->
    <div v-if="fieldMappings.priority.notionProperty" class="flex items-center gap-2">
      <UBadge :color="getPropertyTypeColor(fieldMappings.priority.propertyType)">
        {{ fieldMappings.priority.propertyType }}
      </UBadge>
    </div>

    <!-- Value mappings (for select/status) -->
    <div v-if="isSelectType(fieldMappings.priority.propertyType)" class="space-y-2">
      <div v-for="aiValue in ['low', 'medium', 'high', 'urgent']" :key="aiValue">
        <UFormField :label="`AI: ${aiValue} →`">
          <UInput
            v-model="fieldMappings.priority.valueMap[aiValue]"
            :placeholder="`Notion value for ${aiValue}`"
          />
        </UFormField>
      </div>
    </div>
  </UCard>
</template>
```

---

### 4. Custom Table Cells

**From**: configs List.vue custom cells
**To**: FlowList.vue

**Pattern**: Template slot override in CroutonCollection

```vue
<template>
  <CroutonCollection
    collection="discubotFlows"
    :columns="enhancedColumns"
    :rows="flows"
  >
    <!-- OAuth Status Cell -->
    <template #oauthStatus-cell="{ row }">
      <div class="flex items-center gap-2">
        <span
          v-if="hasOAuthConnection(row)"
          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success text-xs font-medium"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          OAuth Connected
        </span>
        <span v-else class="text-xs text-muted-foreground">
          Not Connected
        </span>
      </div>
    </template>

    <!-- Inputs Count Cell -->
    <template #inputsCount-cell="{ row }">
      <UBadge :color="row.inputs?.length > 0 ? 'blue' : 'gray'">
        {{ row.inputs?.length || 0 }} input{{ row.inputs?.length === 1 ? '' : 's' }}
      </UBadge>
    </template>
  </CroutonCollection>
</template>
```

---

### 5. Prompt Preview

**From**: configs Form.vue + PromptPreviewModal.vue
**To**: FlowBuilder.vue + shared/PromptPreviewModal.vue

**Pattern**: Button opens modal with prompt data

```vue
<script setup>
import { usePromptPreview } from '#layers/discubot/app/composables/usePromptPreview'
import PromptPreviewModal from '~/layers/discubot/components/shared/PromptPreviewModal.vue'

const { buildPreview } = usePromptPreview()
const showPromptPreview = ref(false)
const promptPreview = ref(buildPreview())

const openPromptPreview = () => {
  promptPreview.value = buildPreview({
    summaryPrompt: state.aiSummaryPrompt,
    taskPrompt: state.aiTaskPrompt
  })
  showPromptPreview.value = true
}
</script>

<template>
  <UButton @click="openPromptPreview">
    Preview Final Prompt
  </UButton>

  <PromptPreviewModal
    v-model="showPromptPreview"
    :preview="promptPreview"
  />
</template>
```

---

## Dependencies & Prerequisites

### Before Starting Phase 6 (Custom UI)

**Phase 2 Must Be Complete:**
- ✅ Schemas designed and finalized
- ✅ Collections generated with Crouton
- ✅ API endpoints available
- ✅ Types generated

**Phase 3-5 Should Be Complete (or parallel):**
- Backend supports flows (processor, routing)
- AI detects domains
- Webhooks find flows by input
- OAuth creates flows + inputs

### External Dependencies

**Nuxt UI 4 Components:**
- UStepper (wizard)
- UForm, UFormField (forms)
- USelectMenu (dropdowns)
- UBadge (status indicators)
- UInput, UTextarea (form fields)
- UButton (actions)
- UCard (containers)
- UModal, USlideover (overlays)
- UAlert (notifications)
- UCollapsible (advanced sections)
- UCheckbox, USwitch (toggles)

**Composables (Already Created):**
- ✅ `useFlowOAuth` - OAuth handling
- ✅ `useFieldMapping` - Field mapping logic
- ✅ `useNotionSchema` - Schema fetching
- ✅ `usePromptPreview` - Prompt preview

**Crouton Components:**
- CroutonCollection (table layout)
- CroutonTableHeader (header)
- CroutonFormLayout (form layout, if needed)

---

## Testing Strategy

### Component Testing

**FlowBuilder.vue:**
- Test wizard navigation (prev/next)
- Test form validation per step
- Test OAuth popup flow
- Test prompt preview modal
- Test preset examples dropdown

**InputManager.vue:**
- Test add input (Slack, Figma)
- Test OAuth success handling
- Test edit/delete input
- Test webhook URL display

**OutputManager.vue:**
- Test Notion schema fetching
- Test field mapping auto-generation
- Test value mapping inputs
- Test domain filter selector
- Test isDefault validation (exactly one)

**FlowList.vue:**
- Test table rendering
- Test custom cells (OAuth status, counts)
- Test edit/delete actions
- Test empty state

### Integration Testing

- Create flow end-to-end (wizard → save)
- Add 2nd input to existing flow
- Add 2nd output to existing flow
- Edit flow settings
- Delete flow

---

## Migration Checklist

### Pre-Migration

- [x] Task 1.1: Extract composables ✅
- [x] Task 1.2: Create temp components directory ✅
- [x] Task 1.3: Backup existing components ✅
- [x] Task 1.4: Document migration plan ✅ (this doc)
- [ ] Task 1.5: Run type checking

### Phase 2: Schema & Generation

- [ ] Task 2.1-2.6: Design schemas, generate collections

### Phase 6: Component Development

- [ ] Task 6.1: FlowBuilder.vue (3-4h)
- [ ] Task 6.2: InputManager.vue (2h)
- [ ] Task 6.3: OutputManager.vue (2-3h)
- [ ] Task 6.4: FlowList.vue (1h)
- [ ] Task 6.5: Update dashboard pages (1h)

### Phase 9: Organization

- [ ] Task 9.1: Move components to collections
- [ ] Task 9.2: Update documentation
- [ ] Task 9.3: Final cleanup

---

## Success Criteria

### Functionality Parity

- ✅ All features from configs Form.vue implemented
- ✅ All features from configs List.vue implemented
- ✅ OAuth flow works (popup pattern)
- ✅ Field mapping works (auto-mapping, manual)
- ✅ Prompt preview works
- ✅ Domain-based routing configured

### UX Improvements

- ✅ Wizard flow guides users through setup
- ✅ Clear indication of OAuth connection status
- ✅ Input/output counts visible at a glance
- ✅ Domain filter configuration intuitive
- ✅ Validation prevents invalid configurations

### Technical Quality

- ✅ Type checking passes
- ✅ No console errors
- ✅ Follows Nuxt UI 4 patterns
- ✅ Composables reused correctly
- ✅ Components in correct locations (after Phase 9)

---

## Open Questions

1. **FlowBuilder vs FlowForm**: Should we use a wizard (UStepper) or a single long form?
   - **Recommendation**: Wizard for better UX, especially for first-time users

2. **Input/Output Editing**: Edit in modal or slideover?
   - **Recommendation**: Slideover for more space, especially for Notion field mapping

3. **Domain Filter UI**: Multi-select dropdown or tags input?
   - **Recommendation**: Multi-select with option to add custom tags

4. **OAuth in InputManager**: Inline button or separate page?
   - **Recommendation**: Inline popup (same pattern as configs Form.vue)

5. **Advanced JSON Editor**: Keep or remove?
   - **Recommendation**: Keep as fallback for power users

---

## Next Steps

1. ✅ Complete Task 1.4 (this document)
2. [ ] Task 1.5: Run type checking
3. [ ] Phase 2: Schema design and generation
4. [ ] Phase 3-5: Backend updates
5. [ ] Phase 6: Begin component development (follow priority order)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-20
**Related Documents**:
- `/docs/briefings/flows-redesign-brief.md` - Architecture overview
- `/docs/backups/BACKUP_DOCUMENTATION.md` - Feature reference
- `/docs/FLOWS_REDESIGN_TRACKER.md` - Task tracker

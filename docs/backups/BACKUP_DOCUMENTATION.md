# Custom Components Backup Documentation

**Date**: 2025-11-20
**Purpose**: Backup existing custom components before flows redesign
**Related**: Task 1.3 - Flows Redesign Pre-Migration

---

## Backed Up Components

### 1. configs-Form.vue.backup

**Location**: `layers/discubot/collections/configs/app/components/Form.vue`
**Backup**: `docs/backups/configs-Form.vue.backup`

#### Custom Features

1. **OAuth Integration (Slack)**
   - `openOAuthPopup()` - Opens OAuth flow in popup window
   - Popup-based OAuth to preserve form state
   - Listens for `postMessage` from OAuth success page
   - Auto-refreshes OAuth status after successful connection
   - Shows OAuth connection status with badges

2. **Notion Schema Fetching & Auto-Mapping**
   - `fetchNotionSchema()` - Fetches Notion database schema
   - Auto-generates field mappings using fuzzy matching
   - Smart property type detection (select, status, people, etc.)
   - Client-side similarity scoring for field matching

3. **Field Mapping Configuration**
   - `fieldMappings` reactive object with priority, type, assignee
   - USelectMenu for Notion property selection
   - UBadge showing property types with color coding
   - Value mapping inputs for select/status fields (AI → Notion)
   - Real-time property type detection and updates
   - Watches for property changes to auto-populate metadata

4. **Prompt Preview Modal**
   - `openPromptPreview()` - Shows complete AI prompts
   - Displays final prompt sent to Claude API
   - Highlights custom text insertions
   - Character count and token estimates
   - Preview for both Summary and Task Detection prompts

5. **Source-Specific Sections**
   - Dynamic sections based on source type (Slack vs Figma)
   - Conditional rendering of email fields for Figma
   - Conditional rendering of OAuth for Slack
   - Source metadata handling (workspace IDs, file keys)

6. **Preset Examples Library**
   - Dropdown with pre-built prompt templates
   - One-click insertion of preset prompts
   - Templates for different team types (design, engineering, product)

7. **User Mapping Integration Hints**
   - UAlert shown when assignee mapped to people field
   - Link to user mapping management page
   - Explains Slack/Figma → Notion user connection

8. **Advanced JSON Editor**
   - UCollapsible for raw JSON field mapping editing
   - Fallback for power users

#### Composables Used

- `usePromptPreview` - Prompt preview logic
- Extracted to standalone composables in Task 1.1:
  - `useFlowOAuth` - OAuth popup handling
  - `useFieldMapping` - Field mapping utilities
  - `useNotionSchema` - Schema fetching

#### Component Structure

- Uses Nuxt UI 4 components (UForm, UFormField, USelectMenu, UBadge, UInput, UAlert, UCollapsible)
- Tab-based layout with CroutonFormLayout
- Sections: basic, email, credentials, ai, notion, advanced
- Validation with Zod schema

---

### 2. configs-List.vue.backup

**Location**: `layers/discubot/collections/configs/app/components/List.vue`
**Backup**: `docs/backups/configs-List.vue.backup`

#### Custom Features

1. **Custom Table Cells**
   - **OAuth Status Cell**: Shows connection status with badge
     - Green "OAuth Connected" badge with checkmark icon
     - "Not Connected" gray text for unconnected configs
     - `hasOAuthConnection()` utility function

   - **Workspace Name Cell**: Displays Slack/Figma workspace
     - Extracts workspace name from sourceMetadata
     - `getWorkspaceName()` utility function
     - Shows "—" for missing data

   - **Last Updated Cell**: Formatted timestamp (likely)
     - Human-readable date formatting

2. **Enhanced Columns**
   - Custom column definitions beyond Crouton defaults
   - Adds OAuth status, workspace name to standard columns
   - Better visual representation of config status

3. **Table Layout**
   - Uses CroutonCollection with custom layout
   - CroutonTableHeader with create button
   - Responsive design

#### Component Structure

- Uses Nuxt UI 4 components
- Template slot overrides for custom cells
- Integrates with Crouton's table system

---

### 3. PromptPreviewModal.vue.backup

**Location**: `layers/discubot/collections/configs/app/components/PromptPreviewModal.vue`
**Backup**: `docs/backups/PromptPreviewModal.vue.backup`

#### Custom Features

1. **Prompt Display**
   - Shows complete AI prompt as sent to Claude API
   - Syntax highlighting for prompt structure
   - Separate views for Summary and Task Detection prompts

2. **Metadata Display**
   - Character count per prompt
   - Token estimate (for API cost estimation)
   - Prompt type indicators

3. **Custom Text Highlighting**
   - Highlights where user's custom prompt text is inserted
   - Shows distinction between default and custom parts
   - Visual indication of prompt composition

4. **Modal UI**
   - Built with Nuxt UI 4 components (UModal, UCard)
   - Close button and keyboard shortcuts
   - Responsive design

#### Usage

- Imported and used in Form.vue
- Triggered by "Preview Final Prompt" button
- Receives `PromptPreview` object from `usePromptPreview` composable

#### Note

**Already Copied**: This component was already copied to `layers/discubot/components/shared/PromptPreviewModal.vue` in Task 1.2. The backup here is for historical reference during flows redesign.

---

## Migration Plan

### Components to Build for Flows

1. **FlowBuilder.vue** (replaces Form.vue)
   - Multi-step wizard (Flow → Inputs → Outputs)
   - Reuse OAuth integration from useFlowOAuth
   - Reuse prompt preview functionality
   - New: Multiple inputs management
   - New: Multiple outputs with domain filters

2. **InputManager.vue** (new component)
   - Add/edit/delete inputs for a flow
   - OAuth flow for Slack inputs
   - Manual config for Figma inputs
   - Show input status and webhook URLs

3. **OutputManager.vue** (new component)
   - Add/edit/delete outputs for a flow
   - Notion schema fetching (reuse useNotionSchema)
   - Field mapping (reuse useFieldMapping)
   - Domain filter configuration
   - isDefault checkbox

4. **FlowList.vue** (replaces List.vue)
   - Table of flows with input/output counts
   - Status badges for OAuth connections
   - Edit/delete actions

5. **Reusable Components**
   - PromptPreviewModal.vue (already in shared/)
   - OAuthButton.vue (extract if needed)

### Custom Logic Preserved

All custom logic has been extracted to composables in Task 1.1:
- ✅ `useFlowOAuth.ts` - OAuth popup handling
- ✅ `useFieldMapping.ts` - Field mapping and fuzzy matching
- ✅ `useNotionSchema.ts` - Schema fetching and parsing
- ✅ `usePromptPreview.ts` - Already existed

These composables are safe from Crouton regeneration and can be reused in new flow components.

---

## Key Insights

### What Worked Well

1. **OAuth Popup Pattern**: Preserves form state, great UX
2. **Auto-Mapping**: Fuzzy matching saves users time
3. **Field Mapping UI**: Clear, visual, easy to understand
4. **Prompt Preview**: Transparency builds trust in AI features
5. **Component Composition**: Nuxt UI 4 components compose well

### What to Improve in Flows

1. **Simplify Multi-Input Setup**: Wizard flow should guide users
2. **Better Domain Configuration**: Make domain filters intuitive
3. **Output Routing Clarity**: Show users how tasks will route
4. **Testing Mode**: Allow users to test routing without creating tasks
5. **Migration Help**: Provide clear path from old configs to flows

### Technical Debt Avoided

- ✅ Custom logic in composables (reusable, testable)
- ✅ Components in temporary location (safe from regeneration)
- ✅ Clear documentation of features
- ✅ Type-safe with TypeScript
- ✅ Follows Nuxt UI 4 patterns

---

## Next Steps

1. ✅ Complete Task 1.3 (this backup)
2. [ ] Task 1.4: Document component migration plan
3. [ ] Task 1.5: Run type checking
4. [ ] Phase 2: Begin schema design and generation

---

**Document Version**: 1.0
**Last Updated**: 2025-11-20
**Related Files**:
- `/docs/briefings/flows-redesign-brief.md`
- `/docs/FLOWS_REDESIGN_TRACKER.md`
- `/layers/discubot/composables/README.md`

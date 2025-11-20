# Flows Redesign Progress Tracker

**Project Start Date**: 2025-11-20
**Expected Completion**: TBD (21-29 hours estimated)
**Current Phase**: Phase 1 - Pre-Migration Preparation ✅ Complete
**Overall Progress**: 14% (5/35 tasks complete)

> **📋 Reference Documentation**: See [flows-redesign-brief.md](./briefings/flows-redesign-brief.md) for complete architecture, decisions, and schema designs.

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Tasks Completed | 5 / 35 |
| Remaining Tasks | 30 |
| Hours Logged | 2.65 / 21-29 |
| Current Phase | Phase 1 - Pre-Migration Preparation |
| Days Elapsed | 0 |
| Blockers | 0 |
| Tests Passing | TBD |

---

## Project Goal

Transform Discubot from single-input/single-output configs into flexible multi-input/multi-output flows with AI domain-based routing.

**Before**: One config = One source (Slack OR Figma) → One output (Notion DB)
**After**: One flow = Multiple sources (Slack + Figma) → AI domain detection → Multiple outputs (Notion DBs, GitHub, Linear)

---

## Phase 1: Pre-Migration Preparation 📦

**Status**: Complete ✅
**Progress**: 5/5 tasks (100%)
**Time**: 2.65h / 2-3h estimated
**Goal**: Extract and preserve custom components before schema changes

- [x] Task 1.1: Extract Custom Logic to Composables (1.5h) ✅
  - ✅ Extract OAuth logic from configs Form.vue → `composables/useFlowOAuth.ts`
  - ✅ Extract field mapping logic → `composables/useFieldMapping.ts`
  - ✅ Extract prompt preview logic → Already existed in `composables/usePromptPreview.ts`
  - ✅ Extract Notion schema fetching → `composables/useNotionSchema.ts`
  - ✅ Document each composable's purpose and API in README.md
  - ✅ Test composables work independently (npx nuxt typecheck - no errors)
  - Files: `layers/discubot/composables/*.ts`

- [x] Task 1.2: Create Temporary Components Directory (0.5h) ✅
  - Create `layers/discubot/components/flows/` (temporary home)
  - Add README.md: "These components are temporary during development. Will move to collection folders after schema stabilizes."
  - Copy PromptPreviewModal.vue to `components/shared/`
  - Files: `layers/discubot/components/flows/README.md`

- [x] Task 1.3: Backup Existing Custom Components (0.25h) ✅
  - ✅ Backup configs Form.vue to `docs/backups/configs-Form.vue.backup`
  - ✅ Backup configs List.vue to `docs/backups/configs-List.vue.backup`
  - ✅ Backup PromptPreviewModal.vue to `docs/backups/PromptPreviewModal.vue.backup`
  - ✅ Document what custom features exist in `docs/backups/BACKUP_DOCUMENTATION.md`
  - Custom features documented: OAuth integration, field mapping, Notion schema fetching, prompt preview, custom table cells
  - Files: `docs/backups/*.backup`, `docs/backups/BACKUP_DOCUMENTATION.md`

- [x] Task 1.4: Document Component Migration Plan (0.5h) ✅
  - ✅ Create checklist of components to build (4 main components + 4 shared)
  - ✅ Map existing features to new components (feature mapping matrix)
  - ✅ Document which features move where (detailed specifications)
  - ✅ Implementation priorities (Phase 1: Core → Phase 2: Enhanced → Phase 3: Nice-to-have)
  - ✅ Reusable patterns documented (OAuth, schema fetching, field mapping, custom cells, prompt preview)
  - ✅ Dependencies and prerequisites identified
  - ✅ Testing strategy outlined
  - Files: `docs/briefings/flows-components-plan.md` (comprehensive 500+ line migration guide)

- [x] Task 1.5: Run Type Checking (0.25h) ✅
  - ✅ Run `npx nuxt typecheck` - Found 388 pre-existing errors
  - ✅ Document baseline state in `docs/BASELINE_STATE.md`
  - ✅ Analyze error distribution: 82% base app, 4.6% discubot layer, 13.4% server
  - ✅ Document test coverage: 366+/440+ passing (83%+), 42 expected API key failures
  - ✅ Assessment: Pre-existing issues do NOT block flows redesign
  - ✅ Recommendation: Proceed with Phase 2 (schema design)
  - Discubot layer errors are minor and isolated
  - Flows will work in isolation with fresh generated code
  - Files: `docs/BASELINE_STATE.md`

**Checkpoint**: ✅ **Phase 1 Complete!** Custom logic preserved, backups complete, migration plan documented, baseline state cataloged. Ready to begin Phase 2 - Schema Design & Collection Generation.

---

## Phase 2: Schema Design & Collection Generation 🏗️

**Status**: In Progress
**Progress**: 5/6 tasks (83%)
**Time**: 1h / 2-3h estimated
**Goal**: Design schemas, generate collections with Crouton

- [x] Task 2.1: Create flow-schema.json (0.5h) ✅
  - ✅ Define flow fields: name, description, availableDomains
  - ✅ AI settings: aiEnabled, anthropicApiKey, aiSummaryPrompt, aiTaskPrompt
  - ✅ Status: active, onboardingComplete
  - ✅ Audit fields: createdAt/By, updatedAt/By (via crouton metadata)
  - Files: `crouton/schemas/flow-schema.json`

- [x] Task 2.2: Create flow-inputs-schema.json (0.5h) ✅
  - ✅ Define flowId with refTarget: "flows" (relationship)
  - ✅ Input fields: sourceType, name, apiToken
  - ✅ Webhook fields: webhookUrl, webhookSecret
  - ✅ Email fields: emailAddress, emailSlug
  - ✅ Source metadata: JSON column
  - ✅ Status: active
  - Files: `crouton/schemas/flow-inputs-schema.json`

- [x] Task 2.3: Create flow-outputs-schema.json (0.5h) ✅
  - ✅ Define flowId with refTarget: "flows"
  - ✅ Output fields: outputType, name
  - ✅ Routing: domainFilter (array), isDefault (boolean)
  - ✅ Output config: JSON column (Notion/GitHub/Linear configs)
  - ✅ Status: active
  - Files: `crouton/schemas/flow-outputs-schema.json`

- [x] Task 2.4: Update user-mapping-schema.json (0.25h) ✅
  - ✅ Add sourceWorkspaceId field (required)
  - ✅ Update description: "Prevents user ID collisions across workspaces"
  - ✅ Keep existing fields: sourceType, sourceUserId, sourceUserEmail, notionUserId
  - Files: `crouton/schemas/user-mapping-schema.json`

- [x] Task 2.5: Update crouton.config.mjs (0.25h) ✅
  - ✅ Add flows, flowInputs, flowOutputs to collections array
  - ✅ Update targets to include new collections in discubot layer
  - ✅ Ensure autoRelations: true (enables refTarget)
  - Files: `crouton/crouton.config.mjs`

- [ ] Task 2.6: Generate Collections (0.5h)
  - Run: `npx crouton-generate config crouton/crouton.config.mjs`
  - Verify generation:
    - `layers/discubot/collections/flows/` created
    - `layers/discubot/collections/flow-inputs/` created
    - `layers/discubot/collections/flow-outputs/` created
    - Schema, queries, composables generated
    - API endpoints created
  - Run: `npx nuxt typecheck`
  - Fix any generation errors
  - Commit generated files

**Checkpoint**: ✅ Collections generated, API endpoints available, types generated, ready for backend integration.

---

## Phase 3: Backend Updates - AI & Types 🤖

**Status**: Not Started
**Progress**: 0/5 tasks (0%)
**Time**: 0h / 2-3h estimated
**Goal**: Update AI service to detect domains, update type definitions

- [ ] Task 3.1: Update DetectedTask Interface (0.5h)
  - Add `domain?: string | null` field
  - Update JSDoc: "AI-detected domain (design/frontend/backend/etc.) or null if uncertain"
  - Update all usage sites
  - Files: `layers/discubot/types/index.ts`

- [ ] Task 3.2: Update AI Summary Prompt (0.5h)
  - Modify `generateSummary()` in ai.ts
  - Add instruction: "Detect the primary domain for this discussion"
  - Provide domain examples from flow's availableDomains
  - Return null if uncertain
  - Files: `layers/discubot/server/services/ai.ts`

- [ ] Task 3.3: Update AI Task Detection Prompt (1h)
  - Modify `detectTasks()` in ai.ts
  - Add instruction: "For each task, determine the domain"
  - Provide domain vocabulary from flow
  - Example output: `{ title: "...", domain: "design", ... }`
  - Ensure AI returns null for uncertain domains
  - Files: `layers/discubot/server/services/ai.ts`

- [ ] Task 3.4: Update Flow Types (0.5h)
  - Create Flow, FlowInput, FlowOutput interfaces
  - Update SourceConfig → Flow mapping logic
  - Add domain routing types
  - Update NotionTaskConfig to support output configs
  - Files: `layers/discubot/types/index.ts`

- [ ] Task 3.5: Test AI Domain Detection (0.5h)
  - Test with sample discussions (design, dev, product)
  - Verify domain field populated correctly
  - Test with ambiguous discussions (returns null?)
  - Log domain detection accuracy
  - Files: `tests/services/ai.test.ts`

**Checkpoint**: ✅ AI detects domains, types updated, ready for processor changes.

---

## Phase 4: Backend Updates - Processor & Routing 🔄

**Status**: Not Started
**Progress**: 0/6 tasks (0%)
**Time**: 0h / 3-4h estimated
**Goal**: Update processor to support flows, implement domain routing

- [ ] Task 4.1: Update loadSourceConfig() → loadFlow() (1h)
  - Rename function to loadFlow()
  - Load flow by input identifier (slackTeamId or emailSlug)
  - Join flow with inputs and outputs
  - Return flow object with all related data
  - Update all call sites
  - Files: `layers/discubot/server/services/processor.ts`

- [ ] Task 4.2: Implement Domain Routing Logic (1.5h)
  - Create `routeTaskToOutputs()` utility
  - Match task.domain with output.domainFilter
  - Handle multiple matching outputs (create in all)
  - Handle no matches (use default output)
  - Throw error if no default configured
  - Log routing decisions
  - Files: `layers/discubot/server/utils/domain-routing.ts`

- [ ] Task 4.3: Update createNotionTask() for Multiple Outputs (0.5h)
  - Accept output config instead of global config
  - Extract notionToken, databaseId from output.outputConfig
  - Support per-output field mappings
  - Handle output-specific errors gracefully
  - Files: `layers/discubot/server/services/notion.ts`

- [ ] Task 4.4: Update Processor to Use Flows (1h)
  - Replace config loading with flow loading
  - For each detected task:
    - Call routeTaskToOutputs()
    - Create task in all matched outputs
    - Log successes/failures per output
  - Update discussion record with flow info
  - Update job tracking
  - Files: `layers/discubot/server/services/processor.ts`

- [ ] Task 4.5: Update User Mapping Resolution (0.5h)
  - Modify resolveToNotionUser() to accept sourceWorkspaceId
  - Load user mappings with workspace filter
  - Handle missing workspace ID gracefully
  - Update all call sites
  - Files: `layers/discubot/server/services/notion.ts`, `processor.ts`

- [ ] Task 4.6: Test End-to-End Processing (0.5h)
  - Test: Slack webhook → Flow with 2 outputs → Tasks created in both
  - Test: Domain routing (design task → design output)
  - Test: Default output fallback
  - Test: User mapping with workspace ID
  - Files: `tests/integration/flow-processing.test.ts`

**Checkpoint**: ✅ Processor supports flows, domain routing works, tasks created in multiple outputs.

---

## Phase 5: API Endpoints & OAuth Integration 🔌

**Status**: Not Started
**Progress**: 0/4 tasks (0%)
**Time**: 0h / 2-3h estimated
**Goal**: Update APIs to work with flows, integrate OAuth

- [ ] Task 5.1: Update Webhook Endpoints (1h)
  - Slack webhook: Find flow by slackTeamId (from input)
  - Figma/email webhook: Find flow by emailSlug
  - Support backward compatibility (check config if no flow found)
  - Update error messages
  - Files: `layers/discubot/server/api/webhooks/slack.post.ts`, `layers/discubot/server/api/webhooks/resend.post.ts`

- [ ] Task 5.2: Update OAuth Callback (1h)
  - Create flow + input instead of config
  - Set flow name from Slack workspace name
  - Store slackTeamId in input.sourceMetadata
  - Create default Notion output if user provides DB
  - Redirect to flow edit page (not config page)
  - Files: `layers/discubot/server/api/oauth/slack/callback.get.ts`

- [ ] Task 5.3: Create Flow Management Endpoints (0.5h)
  - Verify generated endpoints work:
    - GET/POST `/api/teams/[id]/flows`
    - GET/PATCH/DELETE `/api/teams/[id]/flows/[flowId]`
  - Add custom logic if needed (authorization, validation)
  - Test with Postman/curl
  - Files: Check generated files in `layers/discubot/collections/flows/server/api/`

- [ ] Task 5.4: Test OAuth Flow (0.5h)
  - Test: OAuth → Create flow + input
  - Verify: slackTeamId stored correctly
  - Verify: Redirect to correct page
  - Test: Can add 2nd input to existing flow
  - Files: Manual testing + `tests/integration/oauth-flow.test.ts`

**Checkpoint**: ✅ Webhooks work with flows, OAuth creates flows, endpoints functional.

---

## Phase 6: Custom UI Components 🎨

**Status**: Not Started
**Progress**: 0/5 tasks (0%)
**Time**: 0h / 8-10h estimated
**Goal**: Build custom UI in temporary location (safe from regeneration)

- [ ] Task 6.1: Build FlowBuilder Wizard (3-4h)
  - Multi-step wizard component (3 steps)
  - Step 1: Flow settings (name, AI prompts, domains)
  - Step 2: Add inputs (select source type, OAuth or manual)
  - Step 3: Add outputs (Notion DB, domain filters, default)
  - Use Nuxt UI 4 components (UForm, UStepper, UCard)
  - Save flow + inputs + outputs on completion
  - Files: `layers/discubot/components/flows/FlowBuilder.vue`

- [ ] Task 6.2: Build InputManager Component (2h)
  - List of inputs for a flow
  - Add input button (dropdown: Slack, Figma)
  - OAuth flow for Slack (reuse useFlowOAuth composable)
  - Manual form for Figma (email slug)
  - Edit/delete input
  - Show input status (active, webhook URL)
  - Files: `layers/discubot/components/flows/InputManager.vue`

- [ ] Task 6.3: Build OutputManager Component (2-3h)
  - List of outputs for a flow
  - Add output button (dropdown: Notion, GitHub, Linear)
  - Output form:
    - Name, output type
    - Domain filter (multi-select from flow.availableDomains)
    - isDefault checkbox
    - Output-specific config (Notion: token, DB, field mapping)
  - Edit/delete output
  - Show output status
  - Files: `layers/discubot/components/flows/OutputManager.vue`

- [ ] Task 6.4: Build FlowList Component (1h)
  - Table of flows for team
  - Columns: Name, Inputs (count), Outputs (count), Status, Actions
  - Badges for input/output counts
  - Edit/delete actions
  - Create new flow button
  - Files: `layers/discubot/components/flows/FlowList.vue`

- [ ] Task 6.5: Update Dashboard Pages (1h)
  - Update `/dashboard/[team]/flows` to use FlowList
  - Update `/dashboard/[team]/flows/[id]/edit` to use FlowBuilder
  - Update navigation: "Configs" → "Flows"
  - Add breadcrumbs
  - Test routing
  - Files: `app/pages/dashboard/[team]/flows/*.vue`

**Checkpoint**: ✅ Custom UI built, flows manageable via UI, inputs/outputs configurable.

---

## Phase 7: Testing & Validation ✅

**Status**: Not Started
**Progress**: 0/4 tasks (0%)
**Time**: 0h / 3-4h estimated
**Goal**: Comprehensive testing, fix bugs, validate architecture

- [ ] Task 7.1: Integration Testing (1.5h)
  - Test: Create flow with 2 inputs (Slack + Figma)
  - Test: Configure 2 outputs with domain filters
  - Test: Send test webhook → Verify domain routing
  - Test: Tasks created in correct outputs
  - Test: User mappings with workspace ID
  - Test: Default output fallback
  - Files: `tests/integration/flow-end-to-end.test.ts`

- [ ] Task 7.2: Type Checking & Linting (0.5h)
  - Run: `npx nuxt typecheck` - Fix all errors
  - Run: `pnpm lint` - Fix warnings
  - Review type coverage
  - Files: All modified files

- [ ] Task 7.3: Update Existing Tests (1h)
  - Update processor tests to use flows
  - Update webhook tests
  - Update Notion service tests
  - Update adapter tests
  - Ensure all tests pass
  - Files: `tests/**/*.test.ts`

- [ ] Task 7.4: Manual QA Testing (1h)
  - Test OAuth flow end-to-end
  - Test creating flow with wizard
  - Test adding 2nd input to existing flow
  - Test domain routing with real AI
  - Test field mapping with outputs
  - Test error handling (no default output, etc.)
  - Document any bugs found

**Checkpoint**: ✅ All tests passing, typecheck clean, manual QA complete, ready for migration.

---

## Phase 8: Migration & Deployment 🚀

**Status**: Not Started
**Progress**: 0/4 tasks (0%)
**Time**: 0h / 2-3h estimated
**Goal**: Archive old configs, deploy, monitor

- [ ] Task 8.1: Create Config Archive Migration (1h)
  - Create migration script: Copy discubot_configs → discubot_configs_archived
  - Add archivedAt timestamp
  - Test migration locally
  - Run: `npx nuxt typecheck`
  - Files: `server/migrations/archive-configs.ts`

- [ ] Task 8.2: Deploy to Production (0.5h)
  - Run migration script on production DB
  - Deploy new code
  - Verify deployment health
  - Monitor logs for errors
  - Test OAuth flow in production

- [ ] Task 8.3: Add Migration Banner in UI (0.5h)
  - Show banner: "Configs have been archived. Create new flows."
  - Link to archived configs (read-only view)
  - Link to flow creation wizard
  - Add migration guide link
  - Files: `app/components/MigrationBanner.vue`

- [ ] Task 8.4: Monitor & Support (1h)
  - Monitor error logs for 24h
  - Check webhook success rates
  - Respond to user questions
  - Fix any critical bugs immediately
  - Document lessons learned

**Checkpoint**: ✅ Migration complete, flows live in production, users creating flows.

---

## Phase 9: Cleanup & Organization 🧹

**Status**: Not Started
**Progress**: 0/3 tasks (0%)
**Time**: 0h / 2-3h estimated
**Goal**: Move components to proper locations, remove temporary structure

- [ ] Task 9.1: Move Components to Collections (1h)
  - Move FlowBuilder.vue → `layers/discubot/collections/flows/app/components/`
  - Move InputManager.vue → `layers/discubot/collections/flow-inputs/app/components/`
  - Move OutputManager.vue → `layers/discubot/collections/flow-outputs/app/components/`
  - Update all imports in pages
  - Test that everything still works
  - Remove temp `components/flows/` directory
  - Files: Move operations

- [ ] Task 9.2: Update Documentation (1h)
  - Update README.md (Configs → Flows terminology)
  - Create FLOWS_ARCHITECTURE.md (architecture doc)
  - Update PROGRESS_TRACKER.md (add to PROGRESS_MADE.md)
  - Document migration process in MIGRATION.md
  - Add flows examples to docs
  - Files: `docs/*.md`

- [ ] Task 9.3: Final Cleanup (1h)
  - Remove backward compatibility code (config-based processing)
  - Remove archived config UI (after grace period)
  - Clean up unused imports
  - Run final typecheck and tests
  - Create git tag: `v2.0.0-flows-redesign`
  - Files: Various cleanup

**Checkpoint**: ✅ Components in proper locations, documentation complete, codebase clean.

---

## Current Sprint

**Dates**: TBD
**Goal**: Complete schema design and generation

### This Week's Tasks
- [ ] Task 1.1: Extract Custom Logic to Composables
- [ ] Task 1.2: Create Temporary Components Directory
- [ ] Task 2.1-2.6: Schema Design & Collection Generation

### Blockers
- None

### Notes
- Waiting for approval to begin implementation
- Schema designs documented in briefing

---

## Daily Log

### 2025-11-20 - Day 1
**Focus**: Phase 1 - Pre-Migration Preparation (Tasks 1.1-1.5) ✅ COMPLETE
**Hours**: 2.65h / 2-3h estimated
**Completed**:
- [x] Task 1.1: Extract Custom Logic to Composables ✅
  - Created `useFlowOAuth.ts` for OAuth popup handling
  - Created `useFieldMapping.ts` for fuzzy matching and auto-mapping
  - Created `useNotionSchema.ts` for schema fetching
  - Created `composables/README.md` with documentation
  - Verified no type errors in new composables
- [x] Task 1.2: Create Temporary Components Directory ✅
  - Created `layers/discubot/components/flows/` directory
  - Created `layers/discubot/components/shared/` directory
  - Written comprehensive README.md explaining temporary structure
  - Copied PromptPreviewModal.vue to shared components
  - Verified no new type errors in discubot layer
- [x] Task 1.3: Backup Existing Custom Components ✅
  - Backed up configs Form.vue (1,300+ lines with OAuth, field mapping, schema fetching, prompt preview)
  - Backed up configs List.vue (custom OAuth status cell, workspace name cell, enhanced columns)
  - Backed up PromptPreviewModal.vue (already copied to shared in Task 1.2)
  - Created comprehensive `BACKUP_DOCUMENTATION.md` documenting all custom features
  - Documented 8 major custom features in Form.vue
  - Documented 3 custom cell types in List.vue
  - Documented migration plan for flows components
- [x] Task 1.4: Document Component Migration Plan ✅
  - Created comprehensive `flows-components-plan.md` (500+ lines)
  - Component checklist: FlowBuilder, InputManager, OutputManager, FlowList
  - Feature mapping matrix: Every feature from configs → flows mapped
  - Detailed specifications for each component (purpose, features, UI)
  - Implementation priorities: Phase 1 (Core) → Phase 2 (Enhanced) → Phase 3 (Nice-to-have)
  - Reusable patterns: OAuth, schema fetching, field mapping, custom cells, prompt preview
  - Dependencies identified: Nuxt UI 4 components, composables, Crouton
  - Testing strategy: Component tests + integration tests
  - Open questions answered (wizard vs form, modal vs slideover, etc.)
- [x] Task 1.5: Run Type Checking ✅
  - Ran `npx nuxt typecheck` - Found 388 pre-existing type errors
  - Created comprehensive `BASELINE_STATE.md` documenting:
    - Error distribution: 320 base app, 50 server, 18 discubot layer
    - Test coverage: 366+/440+ passing (83%+), 42 expected API key failures
    - Assessment: Pre-existing issues isolated, don't block flows redesign
    - Discubot layer has only 18 minor errors (4.6% of total)
  - Analysis shows flows can proceed in isolation with fresh generated code
  - Recommendation: Proceed with Phase 2 (schema design)

**Notes**:
- `usePromptPreview` already existed, no extraction needed
- All composables documented with examples and usage
- OAuth popup pattern will be reused in flows
- Field mapping utilities ready for flows UI
- Temporary component structure protects custom work from Crouton regeneration
- Components will move to collection folders in Phase 9 after schema stabilizes
- No new type errors introduced (verified with `npx nuxt typecheck`)
- **Backups complete**: All custom work preserved for reference during redesign
- **Key features documented**: OAuth, field mapping, schema fetching, prompt preview, custom cells
- **Migration insights**: Clear understanding of what needs to be rebuilt for flows
- **Migration plan complete**: Detailed roadmap for Phase 6 component development
- **Feature parity ensured**: All existing features mapped to new components
- **Implementation ready**: Priorities set, patterns documented, dependencies identified
- **Baseline documented**: 388 pre-existing type errors cataloged, 83%+ test coverage confirmed
- **No blockers**: Pre-existing issues isolated to base app, flows can proceed safely
- **✅ PHASE 1 COMPLETE**: All 5 tasks done (100%), 2.65h spent, ready for Phase 2

---

## Decisions Log

### Decision 001: User-Defined Domains
**Date**: 2025-11-20
**Context**: Should domains be hardcoded or user-defined?
**Decision**: User-defined per flow with sensible defaults
**Rationale**: Flexibility for different team workflows (marketing vs dev vs design)
**Impact**: `availableDomains` field in flows schema

---

### Decision 002: Default Output Required
**Date**: 2025-11-20
**Context**: How to handle tasks with unmatched domains?
**Decision**: Every flow must have one default output (isDefault: true)
**Rationale**: Prevents silent failures, explicit fallback behavior
**Impact**: `isDefault` boolean in flow-outputs schema

---

### Decision 003: Output Config as JSON
**Date**: 2025-11-20
**Context**: Separate columns vs JSON blob for output configs?
**Decision**: Single JSON column (outputConfig)
**Rationale**: Flexible, clean schema, easy to add new output types
**Impact**: `outputConfig` JSON column in flow-outputs schema

---

### Decision 004: User Mappings Scoped by Workspace
**Date**: 2025-11-20
**Context**: How to prevent user ID collisions across workspaces?
**Decision**: Add sourceWorkspaceId to user mappings
**Rationale**: Simple, allows mapping reuse, prevents collisions
**Impact**: Updated user-mapping schema with sourceWorkspaceId field

---

### Decision 005: Fresh Start Migration
**Date**: 2025-11-20
**Context**: Automatic migration vs fresh start?
**Decision**: Archive old configs, users create new flows from scratch
**Rationale**: Clean architecture, forced learning, simpler implementation
**Impact**: Create discubot_configs_archived table, no migration logic

---

### Decision 006: Temporary Components Location
**Date**: 2025-11-20
**Context**: How to protect custom components from crouton regeneration?
**Decision**: Keep in `components/flows/` during development, move to collections after stabilization
**Rationale**: Safe from regeneration, can iterate on schemas freely
**Impact**: Temporary component directory, move in Phase 9

---

## Issues & Solutions

### Issue 001: [Placeholder]
**Date**: TBD
**Problem**: TBD
**Root Cause**: TBD
**Solution**: TBD
**Status**: TBD
**Time Lost**: TBD

---

## Key Learnings

1. **Schema design is critical** - Get it right upfront, changes are costly
2. **Protect custom work** - Keep components safe from generation during iteration
3. **Crouton relationships** - Use `refTarget` for foreign key relationships
4. **User mappings complexity** - Workspace scoping prevents ID collisions
5. **Migration strategy** - Fresh start > automatic migration for major changes

---

## Test Coverage Progress

| Area | Coverage | Target |
|------|----------|--------|
| Flow Processing | 0% | 80%+ |
| Domain Routing | 0% | 80%+ |
| AI Services | TBD | 80%+ |
| Adapters | TBD | 80%+ |
| Integration Tests | 0% | 10+ tests |
| E2E Tests | 0% | 5+ tests |

**Total**: TBD / TBD passing

---

## Production Readiness Checklist

### Architecture
- [ ] Schemas finalized and generated
- [ ] Collections created with proper relationships
- [ ] Backward compatibility layer implemented
- [ ] Migration script tested

### Backend
- [ ] Processor supports flows
- [ ] Domain routing logic implemented
- [ ] AI detects domains accurately
- [ ] User mappings work with workspace IDs
- [ ] Webhooks find flows correctly
- [ ] OAuth creates flows + inputs

### Frontend
- [ ] FlowBuilder wizard functional
- [ ] InputManager works (add/edit/delete)
- [ ] OutputManager works (add/edit/delete)
- [ ] FlowList displays correctly
- [ ] Migration banner shown

### Testing
- [ ] Unit tests passing (80%+ coverage)
- [ ] Integration tests passing
- [ ] Type checking clean
- [ ] Manual QA complete

### Documentation
- [ ] Briefing document complete
- [ ] Architecture doc written
- [ ] Migration guide created
- [ ] User guide updated

### Deployment
- [ ] Migration script ready
- [ ] Deployment plan documented
- [ ] Rollback plan prepared
- [ ] Monitoring configured

---

## Open Questions & Risks

### Open Questions
1. Does crouton support marking components as "custom" to prevent regeneration?
2. Should we support importing archived configs → flows?
3. What's the grace period for old webhook support?
4. Should flows have a "test mode" for validating routing without creating tasks?
5. How to handle flows with 0 outputs (validation error or allow)?

### Risks
1. **High**: Schema changes after generation (Mitigation: Temporary component location)
2. **Medium**: User confusion during migration (Mitigation: Clear docs, wizard, support)
3. **Medium**: Performance degradation (Mitigation: Monitor, optimize queries)
4. **Medium**: AI domain detection inaccuracy (Mitigation: Default output, manual override)
5. **Low**: OAuth integration bugs (Mitigation: Thorough testing)

---

## Success Criteria

### Phase Completion
- [ ] All 35 tasks completed
- [ ] 0 blockers remaining
- [ ] Type checking passes
- [ ] All tests passing (80%+ coverage)
- [ ] Documentation complete

### User Adoption
- [ ] 80% of users create at least one flow within 1 week
- [ ] Average flow has 2+ inputs (proving multi-input value)
- [ ] 50% of flows use domain routing (2+ outputs)
- [ ] 0 critical bugs in first week
- [ ] User satisfaction score > 4/5

### Technical
- [ ] API response times < 500ms
- [ ] Domain routing accuracy > 90%
- [ ] Zero data loss during migration
- [ ] Webhook success rate > 99%

---

## Timeline

| Phase | Duration | Start | End | Status |
|-------|----------|-------|-----|--------|
| Phase 1: Pre-Migration Prep | 2-3h | TBD | TBD | Not Started |
| Phase 2: Schema Design | 2-3h | TBD | TBD | Not Started |
| Phase 3: Backend - AI & Types | 2-3h | TBD | TBD | Not Started |
| Phase 4: Backend - Processor | 3-4h | TBD | TBD | Not Started |
| Phase 5: API & OAuth | 2-3h | TBD | TBD | Not Started |
| Phase 6: Custom UI | 8-10h | TBD | TBD | Not Started |
| Phase 7: Testing | 3-4h | TBD | TBD | Not Started |
| Phase 8: Migration | 2-3h | TBD | TBD | Not Started |
| Phase 9: Cleanup | 2-3h | TBD | TBD | Not Started |
| **Total** | **21-29h** | TBD | TBD | **0%** |

---

## How to Use This Tracker

### Daily Updates
1. Update "Daily Log" section each day
2. Check off completed tasks
3. Log hours spent
4. Note any blockers

### Phase Completion
1. Mark phase as complete
2. Update checkpoint status
3. Update "Quick Stats" table
4. Move to next phase

### Weekly Updates
1. Review progress vs estimates
2. Identify blockers and risks
3. Adjust timeline if needed
4. Update stakeholders

---

**Last Updated**: 2025-11-20
**Next Review**: TBD
**Status**: Ready to begin once approved

# Discubot - Vibekanban Task Import List

**Project**: Discubot v1 - Universal Discussion-to-Notion Sync
**Total Tasks**: 34
**Total Estimate**: 112 hours (~18-21 days @ 6h/day)
**Vibekanban URL**: http://127.0.0.1:62441/projects/473cb58f-f4f8-4b1d-ab3e-a7efeee40633/tasks

---

## Phase 1: Foundation (Week 1, Days 1-2)
**Goal**: Set up project structure, generate 4 Crouton collections
**Duration**: ~6 hours
**Success**: `npx nuxt typecheck` passes, 4 collections working

### Task 1.1: Create Project Repository
**Estimate**: 1 hour
**Dependencies**: None
**Labels**: `phase-1`, `setup`, `foundation`

**Description**:
Set up the base Discubot project from SuperSaaS template

**Checklist**:
- [ ] Create new repo: discubot_v1
- [ ] Clone SuperSaaS template from NuxtHub
- [ ] Run: `pnpm install`
- [ ] Run: `pnpm dev` (verify it works)
- [ ] Test SuperSaaS auth works
- [ ] Commit initial setup

**Verification**:
- [ ] `pnpm dev` runs without errors
- [ ] Can log in with SuperSaaS account
- [ ] Dashboard loads at /dashboard/:teamId

---

### Task 1.2: Install Crouton Packages
**Estimate**: 0.5 hours
**Dependencies**: Task 1.1
**Labels**: `phase-1`, `setup`, `dependencies`

**Description**:
Install Nuxt Crouton and Crouton Connector packages

**Checklist**:
- [ ] Run: `pnpm add @friendlyinternet/nuxt-crouton`
- [ ] Run: `pnpm add @friendlyinternet/nuxt-crouton-connector`
- [ ] Verify packages in package.json
- [ ] Check for peer dependency warnings

**Verification**:
- [ ] Packages appear in package.json
- [ ] No peer dependency warnings

---

### Task 1.3: Create Collection Schemas
**Estimate**: 1 hour
**Dependencies**: Task 1.2
**Labels**: `phase-1`, `schemas`, `crouton`

**Description**:
Create 4 JSON schema files for Crouton collections

**Checklist**:
- [ ] Create `schemas/` directory
- [ ] Create `schemas/discussion-schema.json` (with threadData embedded)
- [ ] Create `schemas/source-config-schema.json`
- [ ] Create `schemas/sync-job-schema.json`
- [ ] Create `schemas/task-schema.json`
- [ ] Validate JSON syntax (no errors)
- [ ] Reference: `docs/briefings/discubot-crouton-schemas.md`

**Verification**:
- [ ] All 4 schema files exist
- [ ] Valid JSON (no syntax errors)
- [ ] No auto-generated fields (id, teamId, userId, timestamps)
- [ ] discussion-schema includes threadData, aiSummary, aiTasks fields

**Notes**:
- Removed threads collection (embedded in discussions.threadData)
- Removed sources collection (hardcoded in adapters)

---

### Task 1.4: Create Crouton Configuration
**Estimate**: 0.5 hours
**Dependencies**: Task 1.3
**Labels**: `phase-1`, `config`, `crouton`

**Description**:
Create crouton.config.mjs with 4 collections

**Checklist**:
- [ ] Create `crouton.config.mjs` in project root
- [ ] Configure 4 collections: discussions, sourceConfigs, syncJobs, tasks
- [ ] Set target layer: 'discussion-collections'
- [ ] Enable useTeamUtility: true
- [ ] Configure SuperSaaS connector
- [ ] Reference: `docs/briefings/discubot-crouton-schemas.md`

**Verification**:
- [ ] File is valid JavaScript
- [ ] All 4 collections listed
- [ ] useTeamUtility: true
- [ ] SuperSaaS connector configured

---

### Task 1.5: Generate Collections
**Estimate**: 0.75 hours
**Dependencies**: Task 1.4
**Labels**: `phase-1`, `codegen`, `crouton`

**Description**:
Run Crouton generator to create ~100 files

**Checklist**:
- [ ] Run: `npx crouton-generate --config ./crouton.config.mjs`
- [ ] Verify ~100 files generated
- [ ] Check layers/discussion-collections/ exists
- [ ] Verify collections/discussions/ has threadData support
- [ ] Verify collections/sourceConfigs/ exists
- [ ] Verify collections/syncJobs/ exists
- [ ] Verify collections/tasks/ exists

**Verification**:
- [ ] ~100 files generated (4 collections × ~25 files each)
- [ ] No generation errors
- [ ] Forms, Lists, Tables created for each collection
- [ ] Discussions schema includes thread-related fields

---

### Task 1.6: Integrate Collections & Run Migrations
**Estimate**: 1.5 hours
**Dependencies**: Task 1.5
**Labels**: `phase-1`, `database`, `integration`

**Description**:
Integrate generated collections and create database

**Checklist**:
- [ ] Update `nuxt.config.ts` extends array
- [ ] Add: `'./layers/discussion-collections'`
- [ ] Run: `npx drizzle-kit generate`
- [ ] Run: `npx drizzle-kit push`
- [ ] Run: `npx nuxt typecheck`
- [ ] Test generated APIs with curl/Postman

**Verification**:
- [ ] No TypeScript errors
- [ ] 4 database tables created (discussions, sourceConfigs, syncJobs, tasks)
- [ ] Can start dev server
- [ ] Generated APIs respond (test with curl)

**Phase 1 Checkpoint**: ✅ All 4 collections working, database ready, types pass

---

## Phase 2: Core Services (Week 1-2, Days 3-5)
**Goal**: Port and adapt core services from figno
**Duration**: ~15 hours
**Success**: Can process mock discussion end-to-end

### Task 2.1: Create Layer Structure
**Estimate**: 0.5 hours
**Dependencies**: Phase 1 complete
**Labels**: `phase-2`, `setup`, `architecture`

**Description**:
Create manual code layer structure (single layer for all business logic)

**Checklist**:
- [ ] Create: `layers/discussion/server/services/`
- [ ] Create: `layers/discussion/server/adapters/`
- [ ] Create: `layers/discussion/server/api/`
- [ ] Create: `layers/discussion/server/utils/`
- [ ] Create: `layers/discussion/types/`
- [ ] Create: `layers/discussion/components/`
- [ ] Create: `layers/discussion/nuxt.config.ts`
- [ ] Update main nuxt.config.ts extends array

**Verification**:
- [ ] Layer structure exists
- [ ] Can import from layer
- [ ] Simpler than 4-layer approach

---

### Task 2.2: Create Simple Retry Utility
**Estimate**: 1 hour
**Dependencies**: Task 2.1
**Labels**: `phase-2`, `utility`, `error-handling`

**Description**:
Create exponential backoff retry utility (replaces circuit breaker for MVP)

**Checklist**:
- [ ] Create: `layers/discussion/server/utils/retry.ts`
- [ ] Implement `retryWithBackoff<T>()` function
- [ ] Add exponential backoff (2s, 4s, 8s)
- [ ] Create: `tests/utils/retry.test.ts`
- [ ] Run tests

**Verification**:
- [ ] Retries up to 3 times
- [ ] Exponential backoff works
- [ ] Tests pass

---

### Task 2.3: Port AI Service with Map Caching
**Estimate**: 3 hours
**Dependencies**: Task 2.2
**Labels**: `phase-2`, `core-service`, `ai`, `claude`

**Description**:
Port AI service from figno, replace KV with Map-based caching

**Checklist**:
- [ ] Copy from figno: `server/services/ai.ts`
- [ ] Remove Figma-specific prompts
- [ ] Make generic for any discussion source
- [ ] Implement Map-based cache (not KV)
- [ ] Use retry utility instead of circuit breaker
- [ ] Add proper TypeScript types
- [ ] Create: `tests/services/ai.test.ts`
- [ ] Mock Claude API in tests

**Verification**:
- [ ] Can generate summaries
- [ ] Can detect tasks
- [ ] Map caching works (reduces duplicate calls)
- [ ] Retry logic works on failures
- [ ] Tests pass with mocked Claude API

---

### Task 2.4: Port Notion Service
**Estimate**: 3 hours
**Dependencies**: Task 2.2
**Labels**: `phase-2`, `core-service`, `notion`

**Description**:
Port Notion service from figno with configurable field mapping

**Checklist**:
- [ ] Copy from figno: `server/services/notion.ts`
- [ ] Make field mapping configurable
- [ ] Support dynamic database schemas
- [ ] Keep rate limiting (200ms delays)
- [ ] Use retry utility instead of circuit breaker
- [ ] Add proper TypeScript types
- [ ] Create: `tests/services/notion.test.ts`
- [ ] Mock Notion API in tests

**Verification**:
- [ ] Can create Notion pages
- [ ] Rate limiting works (200ms delays)
- [ ] Field mapping configurable
- [ ] Retry logic works on failures
- [ ] Tests pass with mocked Notion API

---

### Task 2.5: Create Base Adapter Interface
**Estimate**: 2 hours
**Dependencies**: Task 2.1
**Labels**: `phase-2`, `architecture`, `interfaces`

**Description**:
Define base adapter interface and types

**Checklist**:
- [ ] Create: `layers/discussion/server/adapters/base.ts`
- [ ] Define `DiscussionSourceAdapter` interface
- [ ] Define `ParsedDiscussion` type
- [ ] Define `DiscussionThread` type (for embedded threadData)
- [ ] Define `ThreadMessage` type
- [ ] Define `SourceConfig` type
- [ ] Define `ValidationResult` type
- [ ] Add comprehensive JSDoc comments

**Verification**:
- [ ] All types exported
- [ ] ThreadData structure matches discussions schema
- [ ] No TypeScript errors
- [ ] Can import in other files

---

### Task 2.6: Create Processor Service
**Estimate**: 6 hours
**Dependencies**: Task 2.3, Task 2.4, Task 2.5
**Labels**: `phase-2`, `core-service`, `orchestration`

**Description**:
Create 7-stage pipeline processor orchestration service

**Checklist**:
- [ ] Create: `layers/discussion/server/services/processor.ts`
- [ ] Implement Stage 1: Ingestion (webhook handling)
- [ ] Implement Stage 2: Job creation
- [ ] Implement Stage 3: Thread building (build threadData, call adapter.fetchThread)
- [ ] Implement Stage 4: AI analysis (call AIService, populate aiSummary/aiTasks)
- [ ] Implement Stage 5: Task creation (call NotionService)
- [ ] Implement Stage 6: Notification (call adapter.postReply)
- [ ] Implement Stage 7: Completion (update discussion status)
- [ ] Add retry logic with exponential backoff
- [ ] Add job status updates at each stage
- [ ] Add detailed error logging
- [ ] Create: `tests/services/processor.test.ts`
- [ ] Mock all services for tests

**Verification**:
- [ ] Can process mock discussion end-to-end
- [ ] Updates job status at each stage (7 stages)
- [ ] Stores thread in discussions.threadData (not separate table)
- [ ] Handles errors gracefully
- [ ] Retry logic works
- [ ] Tests pass with mocked services

**Phase 2 Checkpoint**: ✅ Core services functional, can process discussions in isolation

---

## Phase 3: Figma Adapter (Week 2-3, Days 6-10)
**Goal**: Implement Figma as first discussion source
**Duration**: ~23 hours
**Success**: Email → Notion working end-to-end

### Task 3.1: Port Email Parser
**Estimate**: 3 hours
**Dependencies**: Phase 2 complete
**Labels**: `phase-3`, `figma`, `parser`

**Description**:
Port email parsing utility from figno

**Checklist**:
- [ ] Copy from figno: `server/utils/emailParser.ts`
- [ ] Move to: `layers/discussion/server/utils/`
- [ ] Keep HTML parsing logic (cheerio)
- [ ] Keep file key extraction
- [ ] Keep fuzzy text matching
- [ ] Update TypeScript types
- [ ] Create: `tests/utils/emailParser.test.ts`
- [ ] Test with real email samples

**Verification**:
- [ ] Can parse Figma comment emails
- [ ] Can extract file keys
- [ ] Can handle various email formats
- [ ] Tests pass with real email samples

---

### Task 3.2: Implement Figma Adapter
**Estimate**: 6 hours
**Dependencies**: Task 3.1
**Labels**: `phase-3`, `figma`, `adapter`

**Description**:
Implement Figma adapter with DiscussionSourceAdapter interface

**Checklist**:
- [ ] Create: `layers/discussion/server/adapters/figma.ts`
- [ ] Implement `parseIncoming(mailPayload) → ParsedDiscussion`
- [ ] Implement `fetchThread(fileKey, commentId, config) → DiscussionThread`
- [ ] Implement `postReply(fileKey, commentId, message, config) → boolean`
- [ ] Implement `updateStatus(fileKey, commentId, status, config) → boolean`
- [ ] Implement `validateConfig(config) → ValidationResult`
- [ ] Implement `testConnection(config) → boolean`
- [ ] Add Figma API client methods
- [ ] Create: `tests/adapters/figma.test.ts`
- [ ] Mock Figma API in tests

**Verification**:
- [ ] All interface methods implemented
- [ ] Can call Figma API
- [ ] Error handling works
- [ ] Tests pass with mocked Figma API

---

### Task 3.3: Create Mailgun Webhook Endpoint
**Estimate**: 4 hours
**Dependencies**: Task 3.2
**Labels**: `phase-3`, `figma`, `webhook`

**Description**:
Create Mailgun webhook endpoint with signature verification

**Checklist**:
- [ ] Create: `layers/discussion/server/api/webhook/figma.post.ts`
- [ ] Implement HMAC-SHA256 signature verification
- [ ] Implement timestamp check (< 5 minutes)
- [ ] Call FigmaAdapter.parseIncoming()
- [ ] Create discussion record
- [ ] Create sync job
- [ ] Trigger processor (fire-and-forget)
- [ ] Return 200 OK (< 3 seconds)
- [ ] Create: `tests/api/webhook-figma.test.ts`
- [ ] Test with mocked Mailgun payloads

**Verification**:
- [ ] Verifies Mailgun signatures correctly
- [ ] Rejects old requests (> 5 min)
- [ ] Creates discussion + job
- [ ] Returns quickly (< 3s)
- [ ] Tests pass with mocked payloads

---

### Task 3.4: Create Internal Processor Endpoint
**Estimate**: 3 hours
**Dependencies**: Task 3.3
**Labels**: `phase-3`, `api`, `processor`

**Description**:
Create internal API endpoint for async discussion processing

**Checklist**:
- [ ] Create: `layers/discussion/server/api/internal/process-discussion.post.ts`
- [ ] Accept `{ discussionId, syncJobId }`
- [ ] Load discussion and config from database
- [ ] Initialize adapter (FigmaAdapter)
- [ ] Run Processor.process(discussion, adapter, config)
- [ ] Update job status at each stage
- [ ] Handle errors and retries
- [ ] Create: `tests/api/internal-processor.test.ts`

**Verification**:
- [ ] Processes discussions end-to-end
- [ ] Updates job status correctly
- [ ] Handles errors gracefully
- [ ] Tests pass with mocks

---

### Task 3.5: Integration Testing
**Estimate**: 4 hours
**Dependencies**: Task 3.4
**Labels**: `phase-3`, `testing`, `integration`

**Description**:
End-to-end integration testing for Figma flow

**Checklist**:
- [ ] Configure Mailgun webhook to local tunnel (ngrok)
- [ ] Set up test Figma file
- [ ] Configure test Notion database
- [ ] Set environment variables
- [ ] Test: Mention bot in Figma comment
- [ ] Verify: Email received
- [ ] Verify: Webhook processes
- [ ] Verify: Discussion created
- [ ] Verify: Thread fetched
- [ ] Verify: AI summary generated
- [ ] Verify: Notion task created
- [ ] Verify: Figma confirmation posted

**Verification**:
- [ ] Full flow works end-to-end
- [ ] Notion task contains correct data
- [ ] Figma comment has ✅ reaction
- [ ] No errors in logs

---

### Task 3.6: Documentation
**Estimate**: 1 hour
**Dependencies**: Task 3.5
**Labels**: `phase-3`, `documentation`

**Description**:
Document Figma adapter setup and usage

**Checklist**:
- [ ] Create/update: `layers/discussion/README.md` (Figma section)
- [ ] Document Mailgun configuration
- [ ] Document Figma API token creation
- [ ] Document email routing setup
- [ ] Document testing process
- [ ] Add troubleshooting section

**Verification**:
- [ ] Documentation complete
- [ ] Someone else can follow and set up

**Phase 3 Checkpoint**: ✅ Figma integration working end-to-end

---

## Phase 4: Slack Adapter (Week 3-4, Days 11-15)
**Goal**: Implement Slack as second discussion source
**Duration**: ~23 hours
**Success**: Slack → Notion working end-to-end

### Task 4.1: Implement Slack Adapter
**Estimate**: 6 hours
**Dependencies**: Phase 3 complete
**Labels**: `phase-4`, `slack`, `adapter`

**Description**:
Implement Slack adapter with DiscussionSourceAdapter interface

**Checklist**:
- [ ] Create: `layers/discussion/server/adapters/slack.ts`
- [ ] Implement `parseIncoming(slackPayload) → ParsedDiscussion`
- [ ] Implement `fetchThread(channelId, threadTs, config) → DiscussionThread`
- [ ] Implement `postReply(channelId, threadTs, message, config) → boolean`
- [ ] Implement `updateStatus(channelId, messageTs, status, config) → boolean`
- [ ] Implement `validateConfig(config) → ValidationResult`
- [ ] Implement `testConnection(config) → boolean`
- [ ] Add Slack API methods (conversations.replies, chat.postMessage, reactions.add)
- [ ] Create: `tests/adapters/slack.test.ts`
- [ ] Mock Slack API in tests

**Verification**:
- [ ] All interface methods implemented
- [ ] Can call Slack API
- [ ] Error handling works
- [ ] Tests pass with mocked Slack API

---

### Task 4.2: Create Slack Webhook Endpoint
**Estimate**: 4 hours
**Dependencies**: Task 4.1
**Labels**: `phase-4`, `slack`, `webhook`

**Description**:
Create Slack Events API webhook with signature verification

**Checklist**:
- [ ] Create: `layers/discussion/server/api/webhook/slack.post.ts`
- [ ] Implement HMAC-SHA256 signature verification with timestamp
- [ ] Handle URL verification challenge response
- [ ] Parse app_mention events
- [ ] Call SlackAdapter.parseIncoming()
- [ ] Create discussion record
- [ ] Create sync job
- [ ] Trigger processor
- [ ] Return 200 OK (< 3 seconds)
- [ ] Create: `tests/api/webhook-slack.test.ts`

**Verification**:
- [ ] Verifies Slack signatures
- [ ] Handles URL verification
- [ ] Processes app_mention events
- [ ] Returns quickly (< 3s)
- [ ] Tests pass with mocked payloads

---

### Task 4.3: Create OAuth Endpoints
**Estimate**: 5 hours
**Dependencies**: Task 4.1
**Labels**: `phase-4`, `slack`, `oauth`

**Description**:
Create OAuth flow for Slack app installation

**Checklist**:
- [ ] Create: `layers/discussion/server/api/oauth/install.get.ts`
- [ ] Create: `layers/discussion/server/api/oauth/callback.get.ts`
- [ ] Generate secure state token
- [ ] Store state in database/session
- [ ] Redirect to Slack OAuth page with scopes
- [ ] Verify state parameter in callback
- [ ] Exchange code for access_token
- [ ] Store token in sourceConfigs
- [ ] Delete state
- [ ] Redirect to settings page
- [ ] Create: `tests/api/oauth.test.ts`

**Verification**:
- [ ] OAuth flow works end-to-end
- [ ] Tokens stored securely
- [ ] State parameter prevents CSRF
- [ ] Tests pass

---

### Task 4.4: Integration Testing
**Estimate**: 4 hours
**Dependencies**: Task 4.2, Task 4.3
**Labels**: `phase-4`, `testing`, `integration`

**Description**:
End-to-end integration testing for Slack flow

**Checklist**:
- [ ] Create test Slack app
- [ ] Configure Events API subscription
- [ ] Set up ngrok for local webhooks
- [ ] Configure test Notion database
- [ ] Test: Install app via OAuth
- [ ] Test: Mention bot in Slack thread
- [ ] Verify: Webhook received
- [ ] Verify: Discussion created
- [ ] Verify: Thread fetched
- [ ] Verify: AI summary generated
- [ ] Verify: Notion task created
- [ ] Verify: Slack reply posted

**Verification**:
- [ ] Full flow works end-to-end
- [ ] Notion task contains correct data
- [ ] Slack thread has reply
- [ ] No errors in logs

---

### Task 4.5: Documentation
**Estimate**: 1 hour
**Dependencies**: Task 4.4
**Labels**: `phase-4`, `documentation`

**Description**:
Document Slack adapter setup and usage

**Checklist**:
- [ ] Update: `layers/discussion/README.md` (Slack section)
- [ ] Document OAuth scope configuration
- [ ] Document Events API setup
- [ ] Document webhook URL configuration
- [ ] Document testing process
- [ ] Add troubleshooting section

**Verification**:
- [ ] Documentation complete
- [ ] Someone else can follow and set up

**Phase 4 Checkpoint**: ✅ Slack integration working, adapter pattern proven

---

## Phase 5: Admin UI (Week 4-5, Days 16-20)
**Goal**: Build user-friendly management interface
**Duration**: ~25 hours
**Success**: Teams can self-configure sources

### Task 5.1: Create Dashboard Page
**Estimate**: 4 hours
**Dependencies**: Phase 4 complete
**Labels**: `phase-5`, `ui`, `dashboard`

**Description**:
Create main integrations dashboard

**Checklist**:
- [ ] Create: `app/pages/dashboard/[team]/integrations/index.vue`
- [ ] List all available sources (Figma, Slack)
- [ ] Show source cards with icons
- [ ] Add "Configure" button for each source
- [ ] Show statistics: total configs, jobs, success rate
- [ ] Use Nuxt UI 4 components (UCard, UBadge, UButton)
- [ ] Make responsive

**Verification**:
- [ ] Page loads without errors
- [ ] Shows Figma and Slack sources
- [ ] Cards are clickable
- [ ] Responsive design works

---

### Task 5.2: Create Source Config Form
**Estimate**: 6 hours
**Dependencies**: Task 5.1
**Labels**: `phase-5`, `ui`, `forms`

**Description**:
Create dynamic source configuration forms

**Checklist**:
- [ ] Create: `app/components/integrations/SourceConfigForm.vue`
- [ ] Create: `app/components/integrations/FigmaConfigForm.vue`
- [ ] Create: `app/components/integrations/SlackConfigForm.vue`
- [ ] Implement dynamic form based on source type
- [ ] Add Figma fields: Email, API token, Notion config
- [ ] Add Slack OAuth button + Notion config
- [ ] Implement Zod validation
- [ ] Add "Test Connection" buttons
- [ ] Leverage Crouton generated forms where possible

**Verification**:
- [ ] Can create Figma config
- [ ] Can create Slack config
- [ ] Validation works
- [ ] Test connection buttons functional

---

### Task 5.3: Create Job Monitoring Dashboard
**Estimate**: 5 hours
**Dependencies**: Task 5.1
**Labels**: `phase-5`, `ui`, `monitoring`

**Description**:
Create job monitoring and history interface

**Checklist**:
- [ ] Create: `app/pages/dashboard/[team]/integrations/jobs.vue`
- [ ] Display table of sync jobs
- [ ] Add columns: Status, Source, Discussion, Created, Duration
- [ ] Add filters: Status, Source type, Date range
- [ ] Add search by discussion title
- [ ] Add pagination
- [ ] Make row clickable → job details modal
- [ ] Leverage Crouton generated syncJobs table

**Verification**:
- [ ] Table loads jobs correctly
- [ ] Filters work
- [ ] Pagination works
- [ ] Can view job details

---

### Task 5.4: Create Job Details Modal
**Estimate**: 4 hours
**Dependencies**: Task 5.3
**Labels**: `phase-5`, `ui`, `details`

**Description**:
Create detailed job information modal

**Checklist**:
- [ ] Create: `app/components/integrations/JobDetailsModal.vue`
- [ ] Display full job information
- [ ] Show all 7 processing stages with status
- [ ] Display error details if failed
- [ ] Add link to created tasks
- [ ] Add link to source discussion
- [ ] Add "Retry" button for failed jobs
- [ ] Use Nuxt UI 4 UModal component

**Verification**:
- [ ] Modal opens on row click
- [ ] Shows all job details
- [ ] Retry button works
- [ ] Links navigate correctly

---

### Task 5.5: Create Test Connection Endpoints
**Estimate**: 3 hours
**Dependencies**: Task 5.2
**Labels**: `phase-5`, `api`, `testing`

**Description**:
Create API endpoints for testing source connections

**Checklist**:
- [ ] Create: `server/api/teams/[id]/integrations/test-figma.post.ts`
- [ ] Create: `server/api/teams/[id]/integrations/test-slack.post.ts`
- [ ] Create: `server/api/teams/[id]/integrations/test-notion.post.ts`
- [ ] Accept config data
- [ ] Call adapter.testConnection()
- [ ] Return success/failure with details
- [ ] Add proper error messages

**Verification**:
- [ ] Can test Figma API token
- [ ] Can test Slack bot token
- [ ] Can test Notion database access
- [ ] Returns helpful error messages

---

### Task 5.6: Polish & Responsive Design
**Estimate**: 3 hours
**Dependencies**: All Phase 5 tasks
**Labels**: `phase-5`, `ui`, `polish`

**Description**:
Polish UI and ensure responsive design

**Checklist**:
- [ ] Review all pages for consistency
- [ ] Add proper loading states
- [ ] Add empty states with helpful messages
- [ ] Add error states with recovery actions
- [ ] Test mobile responsive layouts
- [ ] Ensure consistent spacing and typography
- [ ] Add hover states and transitions

**Verification**:
- [ ] Works on mobile
- [ ] Loading states smooth
- [ ] Empty states helpful
- [ ] Error messages clear

**Phase 5 Checkpoint**: ✅ Full admin UI functional, teams can self-serve

---

## Phase 6: Polish & Production (Week 5, Days 21-24)
**Goal**: Production-ready system
**Duration**: ~20 hours
**Success**: Deployed to production, all tests passing

### Task 6.1: Security Hardening
**Estimate**: 6 hours
**Dependencies**: Phase 5 complete
**Labels**: `phase-6`, `security`, `production`

**Description**:
Complete security checklist and hardening

**Checklist**:
- [ ] Review security checklist from architecture brief
- [ ] Add rate limiting to all webhooks
- [ ] Add comprehensive Zod validation to all endpoints
- [ ] Review all inputs for injection vulnerabilities
- [ ] Run: `npm audit`
- [ ] Check for exposed secrets in code
- [ ] Review .env.example file
- [ ] Test webhook signature verification
- [ ] Test timestamp validation
- [ ] Add DEFERRED to backlog: Circuit breaker implementation
- [ ] Add DEFERRED to backlog: Token encryption (AES-256-GCM)

**Verification**:
- [ ] Security checklist items complete (MVP scope)
- [ ] No critical vulnerabilities
- [ ] Secrets not committed
- [ ] Rate limiting working

---

### Task 6.2: Testing & Coverage
**Estimate**: 8 hours
**Dependencies**: Task 6.1
**Labels**: `phase-6`, `testing`, `quality`

**Description**:
Comprehensive testing and coverage

**Checklist**:
- [ ] Write unit tests for all core services
- [ ] Write unit tests for all adapters
- [ ] Write unit tests for all utilities
- [ ] Write integration tests for webhook flows
- [ ] Write integration tests for full pipeline
- [ ] Write E2E tests with Playwright
- [ ] Run: `pnpm test`
- [ ] Run: `pnpm test:e2e`
- [ ] Check coverage: Target >80%

**Verification**:
- [ ] >80% unit test coverage
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] CI pipeline passes

---

### Task 6.3: Logging & Monitoring
**Estimate**: 4 hours
**Dependencies**: Task 6.1
**Labels**: `phase-6`, `observability`, `production`

**Description**:
Implement structured logging and monitoring

**Checklist**:
- [ ] Implement structured logging (JSON format)
- [ ] Add correlation IDs to all logs
- [ ] Log at appropriate levels (info, warn, error)
- [ ] Track job success/failure rates
- [ ] Track processing times (p50, p95, p99)
- [ ] Track API call counts
- [ ] Track error frequency by type
- [ ] Setup error tracking (Sentry or similar)
- [ ] Create alerts for critical errors

**Verification**:
- [ ] Logs are structured and searchable
- [ ] Metrics tracked correctly
- [ ] Alerts trigger on errors

---

### Task 6.4: Documentation & Deployment
**Estimate**: 6 hours
**Dependencies**: Task 6.2, Task 6.3
**Labels**: `phase-6`, `documentation`, `deployment`

**Description**:
Complete documentation and deploy to production

**Checklist**:
- [ ] Create: `docs/README.md` (overview)
- [ ] Create: `docs/SETUP.md` (installation guide)
- [ ] Create: `docs/DEPLOYMENT.md` (production deployment)
- [ ] Create: `docs/CONFIGURATION.md` (environment variables)
- [ ] Create: `docs/TROUBLESHOOTING.md` (common issues)
- [ ] Create NuxtHub project
- [ ] Configure environment variables in NuxtHub
- [ ] Run database migrations
- [ ] Deploy via: `nuxthub deploy`
- [ ] Configure webhook URLs in Mailgun/Slack
- [ ] Test production deployment
- [ ] Monitor logs for errors

**Verification**:
- [ ] Documentation complete
- [ ] Deployment successful
- [ ] Production webhooks working
- [ ] No errors in production logs

**Phase 6 Checkpoint**: ✅ System production-ready and deployed

---

## Deferred Items (Post-MVP)
**Label**: `deferred`, `phase-6-deferred`

These items are intentionally deferred per lean architecture principles. Add when scale/compliance demands:

### Deferred Feature 1: Circuit Breaker Pattern
**Rationale**: Simple retry logic sufficient for MVP
**When to implement**: When monitoring shows API outage patterns
**Estimate**: 4 hours

### Deferred Feature 2: Token Encryption (AES-256-GCM)
**Rationale**: D1 already encrypted at rest, adds complexity before needed
**When to implement**: When pursuing SOC2/ISO27001 compliance
**Estimate**: 6 hours

### Deferred Feature 3: KV-Based AI Caching
**Rationale**: Map-based cache works for single-server deployment
**When to implement**: When deploying multi-region
**Estimate**: 2 hours

---

## Summary Statistics

**Total Tasks**: 34
**Total Estimate**: 112 hours
**Working Days**: 18-21 days @ 6h/day
**Phases**: 6
**Success Criteria**:
- Both Figma and Slack integrations working
- >80% test coverage
- Production deployed and stable
- Teams can self-configure

**Key Milestones**:
- Week 1: Foundation + Core services
- Week 2: Figma integration live
- Week 3: Slack integration live
- Week 4: Admin UI complete
- Week 5: Production deployment

---

## How to Use This Document

1. **Import to Vibekanban**: Copy each task section into Vibekanban
2. **Set up columns**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Done
3. **Add labels**: Use the labels from each task
4. **Track dependencies**: Link tasks that depend on each other
5. **Update estimates**: Adjust as you learn
6. **Mark deferred items**: Tag with `phase-6-deferred` label

**Start here**: Task 1.1 - Create Project Repository

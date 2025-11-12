# Discubot: Implementation Roadmap

**Project**: Discubot - Incremental Build Plan for Vibekanban
**Date**: 2025-11-11 (Revised - Lean Architecture)
**Approach**: Phased, incremental delivery
**Total Estimated Time**: 4-5 weeks (reduced from 6 weeks)
**Architecture**: 4 collections, 2 layers, deferred advanced features
**Project Management**: Vibekanban (http://127.0.0.1:62441/projects/473cb58f-f4f8-4b1d-ab3e-a7efeee40633/tasks)

---

## Table of Contents

1. [Overview](#overview)
2. [Project Phases](#project-phases)
3. [Phase 1: Foundation](#phase-1-foundation)
4. [Phase 2: Core Services](#phase-2-core-services)
5. [Phase 3: Figma Adapter](#phase-3-figma-adapter)
6. [Phase 4: Slack Adapter](#phase-4-slack-adapter)
7. [Phase 5: Admin UI](#phase-5-admin-ui)
8. [Phase 6: Polish & Production](#phase-6-polish-production)
9. [Testing Strategy](#testing-strategy)
10. [Risk Mitigation](#risk-mitigation)

---

## Overview

### Project Structure

This roadmap breaks Discubot into **6 phases** with **~34 tasks** total (reduced from 38). Each phase has clear:
- **Deliverables**: What gets built
- **Success Criteria**: How you know it's done
- **Tasks**: Specific work items for Vibekanban
- **Dependencies**: What must be done first
- **Time Estimates**: How long each task takes

**Lean Architecture Changes:**
- ✅ 4 collections instead of 6 (removed threads, sources)
- ✅ 2 layers instead of 4 (consolidated structure)
- ⏳ Deferred circuit breaker and token encryption to Phase 6
- ✅ Simplified caching (Map instead of KV)

### Incremental Approach

Build in this order to maintain a working system at each phase:

```
Phase 1: Foundation (Week 1)
  └─ Collections + Database ready

Phase 2: Core Services (Week 1-2)
  └─ AI, Notion, Processor working

Phase 3: Figma Adapter (Week 2-3)
  └─ First source functional (Figma → Notion)

Phase 4: Slack Adapter (Week 3-4)
  └─ Second source functional (Slack → Notion)

Phase 5: Admin UI (Week 4-5)
  └─ User-friendly management interface

Phase 6: Polish (Week 5-6)
  └─ Production-ready, secure, tested
```

### Vibekanban Task Structure

Each task below can be directly created in Vibekanban with:
- **Title**: Task name
- **Description**: What to do
- **Estimate**: Time in hours
- **Dependencies**: Blocks/depends on
- **Phase**: Epic/column

---

## Project Phases

### Phase Summary

| Phase | Duration | Tasks | Focus | Success Metric |
|-------|----------|-------|-------|----------------|
| 1. Foundation | 2-3 days | 4 | Setup + Generate 4 Collections | `npx nuxt typecheck` passes |
| 2. Core Services | 3-4 days | 6 | AI, Notion, Processor (simple retry) | Can process mock discussion |
| 3. Figma Adapter | 4-6 days | 7 | Figma integration | Email → Notion working |
| 4. Slack Adapter | 4-6 days | 7 | Slack integration | Slack → Notion working |
| 5. Admin UI | 4-6 days | 6 | Dashboard + Management | Teams can configure |
| 6. Polish | 3-5 days | 4 | Testing + Deferred features | Ready for production |
| **TOTAL** | **4-5 weeks** | **~34** | **Full System (Lean)** | **Live in production** |

**Time Savings**: ~1 week saved by removing unnecessary complexity

---

## Phase 1: Foundation

**Goal**: Set up project structure, generate 4 Crouton collections, verify database and types

**Duration**: 2-3 days (reduced from 3-5 days)

**Deliverables**:
- Project repository created
- 4 Crouton collections generated (discussions, sourceConfigs, syncJobs, tasks)
- Database schema created
- TypeScript types working
- SuperSaaS integration configured

**Success Criteria**:
- [ ] `npx nuxt typecheck` passes with no errors
- [ ] All 4 collections have forms, tables, APIs (~100 files generated)
- [ ] Database migrations run successfully
- [ ] Can create/read records via generated APIs

**Removed** (lean architecture):
- ❌ threads collection (embedded in discussions.threadData)
- ❌ sources collection (hardcoded in adapters)

### Tasks for Vibekanban

#### Task 1.1: Create Project Repository
**Estimate**: 1 hour
**Dependencies**: None

```markdown
# Setup
1. Create new repo: discubot_v1
2. Clone SuperSaaS template from NuxtHub
3. Install dependencies: pnpm install
4. Verify dev server runs: pnpm dev
5. Test SuperSaaS auth works

# Verification
- [ ] pnpm dev runs without errors
- [ ] Can log in with SuperSaaS account
- [ ] Dashboard loads at /dashboard/:teamId
```

#### Task 1.2: Install Crouton Packages
**Estimate**: 30 minutes
**Dependencies**: Task 1.1

```markdown
# Install
pnpm add @friendlyinternet/nuxt-crouton
pnpm add @friendlyinternet/nuxt-crouton-connector

# Verification
- [ ] Packages appear in package.json
- [ ] No peer dependency warnings
```

#### Task 1.3: Create Collection Schemas
**Estimate**: 1 hour (reduced from 2 hours)
**Dependencies**: Task 1.2

```markdown
# Create directory
mkdir -p schemas

# Create 4 schema files from discubot-crouton-schemas.md
schemas/
├── discussion-schema.json       (with embedded threadData - see briefing)
├── source-config-schema.json   (copy from briefing)
├── sync-job-schema.json        (copy from briefing)
└── task-schema.json            (copy from briefing)

# Note: threads and sources collections removed (lean architecture)

# Verification
- [ ] All 4 files exist
- [ ] Valid JSON (no syntax errors)
- [ ] No auto-generated fields (id, teamId, userId, timestamps)
- [ ] discussion-schema includes threadData, aiSummary, aiTasks fields
```

#### Task 1.4: Create Crouton Configuration
**Estimate**: 30 minutes
**Dependencies**: Task 1.3

```markdown
# Create file
touch crouton.config.mjs

# Copy content from discubot-crouton-schemas.md (4 collections)

# Verification
- [ ] File is valid JavaScript
- [ ] All 4 collections listed (discussions, sourceConfigs, syncJobs, tasks)
- [ ] target layer: 'discussion' (renamed from discussion-sync)
- [ ] useTeamUtility: true
- [ ] SuperSaaS connector configured
```

#### Task 1.5: Generate Collections
**Estimate**: 45 minutes (reduced from 1 hour)
**Dependencies**: Task 1.4

```markdown
# Run generator
npx crouton-generate --config ./crouton.config.mjs

# Expected output
layers/discussion/
  collections/
    discussions/     # With embedded threadData
    sourceConfigs/
    syncJobs/
    tasks/

# Verification
- [ ] ~100 files generated (4 collections × ~25 files each)
- [ ] No generation errors
- [ ] Forms, Lists, Tables created for each collection
- [ ] Discussions schema includes thread-related fields
```

#### Task 1.6: Integrate Collections & Run Migrations
**Estimate**: 1.5 hours (reduced from 2 hours)
**Dependencies**: Task 1.5

```markdown
# Update nuxt.config.ts
extends: [
  './layers/discussion'  # Renamed from discussion-sync
]

# Generate database migration
npx drizzle-kit generate

# Apply migration
npx drizzle-kit push

# Run typecheck
npx nuxt typecheck

# Verification
- [ ] No TypeScript errors
- [ ] 4 database tables created (discussions, sourceConfigs, syncJobs, tasks)
- [ ] Can start dev server
- [ ] Generated APIs respond (test with curl)
```

**Phase 1 Checkpoint**: All 4 collections working, database ready, types pass

**Total Phase 1 Time**: ~5-6 hours (reduced from ~7 hours)

---

## Phase 2: Core Services

**Goal**: Port and adapt core services from figno (AI, Notion, Processor)

**Duration**: 3-4 days (reduced from 4-6 days)

**Deliverables**:
- AI service with Claude integration + Map-based caching
- Notion service for task creation
- Processor service for 7-stage pipeline orchestration
- Base adapter interface
- Simple retry utility (exponential backoff)

**Deferred to Phase 6** (lean architecture):
- ⏳ Circuit breaker utility
- ⏳ Token encryption

**Success Criteria**:
- [ ] Can generate AI summaries from mock threads
- [ ] Map-based cache reduces duplicate API calls
- [ ] Can create Notion tasks programmatically
- [ ] Can run full 7-stage pipeline with mock discussion
- [ ] All services have unit tests passing

### Tasks for Vibekanban

#### Task 2.1: Create Layer Structure
**Estimate**: 30 minutes (reduced from 1 hour)
**Dependencies**: Phase 1 complete

```markdown
# Create directories (single layer for all manual code)
mkdir -p layers/discussion/{server/{services,adapters,api,utils},types,components}

# Create layer config
touch layers/discussion/nuxt.config.ts

# Update main config
extends: [
  './layers/discussion',  # Generated
  './layers/discussion'               # Manual
]

# Verification
- [ ] Layer structure exists
- [ ] Can import from layer
- [ ] Simpler than 4-layer approach
```

#### Task 2.2: Create Simple Retry Utility
**Estimate**: 1 hour (replaces circuit breaker)
**Dependencies**: Task 2.1

```markdown
# Create file
layers/discussion/server/utils/retry.ts

# Implement simple exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts) throw error
      await delay(Math.pow(2, attempt) * 1000) // 2s, 4s, 8s
    }
  }
}

# Add tests
tests/utils/retry.test.ts

# Verification
- [ ] Retries up to 3 times
- [ ] Exponential backoff works
- [ ] Tests pass
```

#### Task 2.3: Port AI Service with Map Caching
**Estimate**: 3 hours (reduced from 4 hours)
**Dependencies**: Task 2.2

```markdown
# Copy from figno
cp /path/to/figno/server/services/ai.ts \
   layers/discussion/server/services/

# Adapt
- Remove Figma-specific prompts
- Make generic for any discussion source
- Replace KV caching with Map-based caching
- Use retry utility instead of circuit breaker
- Add proper TypeScript types

# Implement Map cache
const summaryCache = new Map<string, { summary: string, timestamp: number }>()

# Add tests
tests/services/ai.test.ts

# Verification
- [ ] Can generate summaries
- [ ] Can detect tasks
- [ ] Map caching works (reduces duplicate calls)
- [ ] Retry logic works on failures
- [ ] Tests pass with mocked Claude API
```

#### Task 2.4: Port Notion Service
**Estimate**: 3 hours (reduced from 4 hours)
**Dependencies**: Task 2.2

```markdown
# Copy from figno
cp /path/to/figno/server/services/notion.ts \
   layers/discussion/server/services/

# Adapt
- Make field mapping configurable
- Support dynamic database schemas
- Keep rate limiting (200ms delays)
- Use retry utility instead of circuit breaker
- Add proper TypeScript types

# Add tests
tests/services/notion.test.ts

# Verification
- [ ] Can create Notion pages
- [ ] Rate limiting works (200ms delays)
- [ ] Field mapping configurable
- [ ] Retry logic works on failures
- [ ] Tests pass with mocked Notion API
```

#### Task 2.5: Create Base Adapter Interface
**Estimate**: 2 hours (reduced from 3 hours)
**Dependencies**: Task 2.1

```markdown
# Create file
layers/discussion/server/adapters/base.ts

# Define interfaces
- DiscussionSourceAdapter (main interface)
- ParsedDiscussion
- DiscussionThread (structure for embedded threadData)
- ThreadMessage
- SourceConfig
- ValidationResult

# Add JSDoc comments

# Verification
- [ ] All types exported
- [ ] ThreadData structure matches discussions schema
- [ ] No TypeScript errors
- [ ] Can import in other files
```

#### Task 2.6: Create Processor Service
**Estimate**: 6 hours
**Dependencies**: Task 2.3, Task 2.4, Task 2.5

```markdown
# Create file
layers/discussion/server/services/processor.ts

# Implement 7-stage pipeline (kept per user preference)
1. Ingestion (handled by webhook)
2. Job creation
3. Thread building (builds threadData, calls adapter.fetchThread)
4. AI analysis (calls AIService, populates aiSummary/aiTasks)
5. Task creation (calls NotionService, creates tasks)
6. Notification (calls adapter.postReply)
7. Completion (updates discussion status)

# Error handling
- Use retry utility (exponential backoff)
- Job status updates at each stage
- Detailed error logging

# Add tests
tests/services/processor.test.ts

# Verification
- [ ] Can process mock discussion end-to-end
- [ ] Updates job status at each stage (7 stages)
- [ ] Stores thread in discussions.threadData (not separate table)
- [ ] Handles errors gracefully
- [ ] Retry logic works
- [ ] Tests pass with mocked services
```

**Phase 2 Checkpoint**: Core services functional with lean architecture, can process discussions in isolation

**Total Phase 2 Time**: ~15 hours (reduced from ~23 hours)

---

## Phase 3: Figma Adapter

**Goal**: Implement Figma as first discussion source

**Duration**: 5-7 days

**Deliverables**:
- Figma adapter implementation
- Email parsing utility
- Mailgun webhook endpoint
- Figma comment threading logic
- End-to-end flow: Email → Notion

**Success Criteria**:
- [ ] Can receive Figma comment emails
- [ ] Can parse HTML emails correctly
- [ ] Can fetch full threads from Figma API
- [ ] Can create Notion tasks from discussions
- [ ] Can post confirmations back to Figma

### Tasks for Vibekanban

#### Task 3.1: Create Figma Layer Structure
**Estimate**: 1 hour
**Dependencies**: Phase 2 complete

```markdown
# Create directories
mkdir -p layers/discussion-figma/{server/{adapters,api/webhook,utils},types}

# Create layer config
touch layers/discussion-figma/nuxt.config.ts

# Update main config
extends: [
  './layers/discussion-core',
  './layers/discussion-figma',
  './layers/discussion-sync'
]

# Verification
- [ ] Layer structure exists
- [ ] Can import from layer
```

#### Task 3.2: Port Email Parser
**Estimate**: 3 hours
**Dependencies**: Task 3.1

```markdown
# Copy from figno
cp /path/to/figno/server/utils/emailParser.ts \
   layers/discussion-figma/server/utils/

# Review and clean up
- Keep HTML parsing logic (cheerio)
- Keep file key extraction
- Keep fuzzy text matching
- Update types

# Add tests
tests/figma/emailParser.test.ts

# Verification
- [ ] Can parse Figma comment emails
- [ ] Can extract file keys
- [ ] Can handle various email formats
- [ ] Tests pass with real email samples
```

#### Task 3.3: Implement Figma Adapter
**Estimate**: 6 hours
**Dependencies**: Task 3.2

```markdown
# Create file
layers/discussion-figma/server/adapters/figma.ts

# Implement DiscussionSourceAdapter interface
- parseIncoming(mailPayload) → ParsedDiscussion
- fetchThread(fileKey, commentId, config) → DiscussionThread
- postReply(fileKey, commentId, message, config) → boolean
- updateStatus(fileKey, commentId, status, config) → boolean
- validateConfig(config) → ValidationResult
- testConnection(config) → boolean

# Add Figma API client methods
- getFileComments()
- postComment()
- addReaction()

# Add tests
tests/figma/adapter.test.ts

# Verification
- [ ] All interface methods implemented
- [ ] Can call Figma API
- [ ] Error handling works
- [ ] Tests pass with mocked Figma API
```

#### Task 3.4: Create Mailgun Webhook Endpoint
**Estimate**: 4 hours
**Dependencies**: Task 3.3

```markdown
# Create file
layers/discussion-figma/server/api/webhook/figma.post.ts

# Implement
- Signature verification (HMAC-SHA256)
- Timestamp check (< 5 minutes)
- Call FigmaAdapter.parseIncoming()
- Create discussion record
- Create sync job
- Trigger processor (fire-and-forget)
- Return 200 OK (< 3 seconds)

# Add tests
tests/figma/webhook.test.ts

# Verification
- [ ] Verifies Mailgun signatures
- [ ] Rejects old requests
- [ ] Creates discussion + job
- [ ] Returns quickly (< 3s)
- [ ] Tests pass with mocked payloads
```

#### Task 3.5: Create Internal Processor Endpoint
**Estimate**: 3 hours
**Dependencies**: Task 3.4

```markdown
# Create file
layers/discussion-core/server/api/internal/process-discussion.post.ts

# Implement
- Accept { discussionId, syncJobId }
- Load discussion and config
- Initialize adapter (FigmaAdapter)
- Run Processor.process(discussion, adapter, config)
- Update job status
- Handle errors

# Add tests
tests/core/internal-processor.test.ts

# Verification
- [ ] Processes discussions end-to-end
- [ ] Updates job status
- [ ] Handles errors gracefully
- [ ] Tests pass with mocks
```

#### Task 3.6: Integration Testing
**Estimate**: 4 hours
**Dependencies**: Task 3.4, Task 3.5

**Note**: No sources seed needed - source types are hardcoded in adapters (lean architecture)

```markdown
# Setup test environment
- Configure Mailgun webhook to local tunnel (ngrok)
- Set up test Figma file
- Configure test Notion database
- Set environment variables

# Test flow
1. Mention bot in Figma comment
2. Verify email received
3. Verify webhook processes
4. Verify discussion created
5. Verify thread fetched
6. Verify AI summary generated
7. Verify Notion task created
8. Verify Figma confirmation posted

# Verification
- [ ] Full flow works end-to-end
- [ ] Notion task contains correct data
- [ ] Figma comment has ✅ reaction
- [ ] No errors in logs
```

#### Task 3.7: Documentation
**Estimate**: 1 hour (reduced from 2 hours)
**Dependencies**: Task 3.6

```markdown
# Create docs
layers/discussion/README.md (Figma section)

# Document
- Figma adapter setup instructions
- Mailgun configuration
- Figma API token creation
- Email routing setup
- Testing process

# Verification
- [ ] Documentation complete
- [ ] Someone else can follow and set up
```

**Phase 3 Checkpoint**: Figma integration working end-to-end with lean architecture

**Total Phase 3 Time**: ~23 hours (reduced from ~26 hours)

---

## Phase 4: Slack Adapter

**Goal**: Implement Slack as second discussion source

**Duration**: 5-7 days

**Deliverables**:
- Slack adapter implementation
- Slack Events API webhook
- OAuth flow endpoints
- Slack thread fetching logic
- End-to-end flow: Slack → Notion

**Success Criteria**:
- [ ] Can receive Slack app_mention events
- [ ] Can fetch thread messages from Slack
- [ ] Can create Notion tasks from threads
- [ ] Can post confirmations to Slack
- [ ] OAuth installation works

### Tasks for Vibekanban

#### Task 4.1: Create Slack Layer Structure
**Estimate**: 1 hour
**Dependencies**: Phase 3 complete

```markdown
# Create directories
mkdir -p layers/discussion-slack/{server/{adapters,api/{webhook,oauth}},types}

# Create layer config
touch layers/discussion-slack/nuxt.config.ts

# Update main config
extends: [
  './layers/discussion-core',
  './layers/discussion-figma',
  './layers/discussion-slack',
  './layers/discussion-sync'
]

# Verification
- [ ] Layer structure exists
- [ ] Can import from layer
```

#### Task 4.2: Implement Slack Adapter
**Estimate**: 6 hours
**Dependencies**: Task 4.1

```markdown
# Create file
layers/discussion-slack/server/adapters/slack.ts

# Implement DiscussionSourceAdapter interface
- parseIncoming(slackPayload) → ParsedDiscussion
- fetchThread(channelId, threadTs, config) → DiscussionThread
- postReply(channelId, threadTs, message, config) → boolean
- updateStatus(channelId, messageTs, status, config) → boolean
- validateConfig(config) → ValidationResult
- testConnection(config) → boolean

# Add Slack API client methods
- getThreadMessages() (conversations.replies)
- postMessage() (chat.postMessage)
- addReaction() (reactions.add)

# Add tests
tests/slack/adapter.test.ts

# Verification
- [ ] All interface methods implemented
- [ ] Can call Slack API
- [ ] Error handling works
- [ ] Tests pass with mocked Slack API
```

#### Task 4.3: Create Slack Webhook Endpoint
**Estimate**: 4 hours
**Dependencies**: Task 4.2

```markdown
# Create file
layers/discussion-slack/server/api/webhook/slack.post.ts

# Implement
- Signature verification (HMAC-SHA256 with timestamp)
- URL verification challenge response
- Parse app_mention events
- Call SlackAdapter.parseIncoming()
- Create discussion record
- Create sync job
- Trigger processor
- Return 200 OK (< 3 seconds)

# Add tests
tests/slack/webhook.test.ts

# Verification
- [ ] Verifies Slack signatures
- [ ] Handles URL verification
- [ ] Processes app_mention events
- [ ] Returns quickly (< 3s)
- [ ] Tests pass with mocked payloads
```

#### Task 4.4: Create OAuth Endpoints
**Estimate**: 5 hours
**Dependencies**: Task 4.1

```markdown
# Create files
layers/discussion-slack/server/api/oauth/install.get.ts
layers/discussion-slack/server/api/oauth/callback.get.ts

# install.get.ts
- Generate secure state token
- Store in slackOAuthStates table
- Redirect to Slack OAuth page with scopes

# callback.get.ts
- Verify state parameter
- Exchange code for access_token
- Store in sourceConfigs (encrypted!)
- Delete state
- Redirect to settings page

# Add tests
tests/slack/oauth.test.ts

# Verification
- [ ] OAuth flow works end-to-end
- [ ] Tokens stored encrypted
- [ ] State parameter prevents CSRF
- [ ] Tests pass
```

#### Task 4.5: Integration Testing
**Estimate**: 4 hours
**Dependencies**: Task 4.3, Task 4.4

**Note**: No sources seed needed - source types are hardcoded (lean architecture)

```markdown
# Setup test environment
- Create test Slack app
- Configure Events API subscription
- Set up ngrok for local webhooks
- Configure test Notion database

# Test flow
1. Install app via OAuth
2. Mention bot in Slack thread
3. Verify webhook received
4. Verify discussion created
5. Verify thread fetched
6. Verify AI summary generated
7. Verify Notion task created
8. Verify Slack reply posted

# Verification
- [ ] Full flow works end-to-end
- [ ] Notion task contains correct data
- [ ] Slack thread has reply
- [ ] No errors in logs
```

#### Task 4.6: Documentation
**Estimate**: 1 hour (reduced from 2 hours)
**Dependencies**: Task 4.5

```markdown
# Create docs
layers/discussion/README.md (Slack section)

# Document
- Slack adapter setup
- OAuth scope configuration
- Events API setup
- Webhook URL configuration
- Testing process

# Verification
- [ ] Documentation complete
- [ ] Someone else can follow and set up
```

**Phase 4 Checkpoint**: Slack integration working end-to-end, proves adapter pattern works with lean architecture

**Total Phase 4 Time**: ~23 hours (reduced from ~24 hours)

---

## Phase 5: Admin UI

**Goal**: Build user-friendly management interface for teams

**Duration**: 4-6 days

**Deliverables**:
- Source management UI
- Source config CRUD interface
- Job monitoring dashboard
- Test connection buttons
- Onboarding wizards

**Success Criteria**:
- [ ] Teams can view available sources
- [ ] Teams can create/edit source configs
- [ ] Teams can test connections
- [ ] Teams can view job history
- [ ] Teams can retry failed jobs

### Tasks for Vibekanban

#### Task 5.1: Create Dashboard Page
**Estimate**: 4 hours
**Dependencies**: Phase 4 complete

```markdown
# Create file
app/pages/dashboard/[team]/integrations/index.vue

# Implement
- List all available sources (Figma, Slack)
- Show source cards with icons
- "Configure" button for each source
- Statistics: total configs, jobs, success rate

# Use components
- AppContainer (layout)
- UCard (source cards)
- UBadge (status indicators)
- UButton (actions)

# Verification
- [ ] Page loads without errors
- [ ] Shows Figma and Slack sources
- [ ] Cards are clickable
- [ ] Responsive design
```

#### Task 5.2: Create Source Config Form
**Estimate**: 6 hours
**Dependencies**: Task 5.1

```markdown
# Create components
app/components/integrations/SourceConfigForm.vue
app/components/integrations/FigmaConfigForm.vue
app/components/integrations/SlackConfigForm.vue

# Implement
- Dynamic form based on source type
- Figma: Email address, API token, Notion config
- Slack: OAuth button, Notion config
- Token encryption before save
- Validation with Zod
- "Test Connection" buttons

# Use Crouton components
- Leverage generated sourceConfigs form
- Customize for each source

# Verification
- [ ] Can create Figma config
- [ ] Can create Slack config
- [ ] Tokens encrypted on save
- [ ] Validation works
- [ ] Test buttons functional
```

#### Task 5.3: Create Job Monitoring Dashboard
**Estimate**: 5 hours
**Dependencies**: Task 5.1

```markdown
# Create file
app/pages/dashboard/[team]/integrations/jobs.vue

# Implement
- Table of sync jobs
- Columns: Status, Source, Discussion, Created, Duration
- Filters: Status, Source type, Date range
- Search by discussion title
- Pagination
- Row click → job details modal

# Use Crouton components
- Leverage generated syncJobs table
- Customize columns and filters

# Verification
- [ ] Table loads jobs
- [ ] Filters work
- [ ] Pagination works
- [ ] Can view job details
```

#### Task 5.4: Create Job Details Modal
**Estimate**: 4 hours
**Dependencies**: Task 5.3

```markdown
# Create component
app/components/integrations/JobDetailsModal.vue

# Implement
- Display full job information
- Show processing stages
- Display error details if failed
- Link to created tasks
- Link to source discussion
- "Retry" button for failed jobs

# Use components
- UModal (Nuxt UI 4)
- UBadge (status)
- UButton (retry)

# Verification
- [ ] Modal opens on row click
- [ ] Shows all job details
- [ ] Retry button works
- [ ] Links navigate correctly
```

#### Task 5.5: Create Test Connection Endpoints
**Estimate**: 3 hours
**Dependencies**: Task 5.2

```markdown
# Create files
server/api/teams/[id]/integrations/test-figma.post.ts
server/api/teams/[id]/integrations/test-slack.post.ts
server/api/teams/[id]/integrations/test-notion.post.ts

# Implement
- Accept config data (encrypted)
- Decrypt tokens
- Call adapter.testConnection()
- Return success/failure with details

# Verification
- [ ] Can test Figma API token
- [ ] Can test Slack bot token
- [ ] Can test Notion database access
- [ ] Returns helpful error messages
```

#### Task 5.6: Polish & Responsive Design
**Estimate**: 3 hours
**Dependencies**: All Phase 5 tasks

```markdown
# Review all pages
- Dashboard
- Source config forms
- Job monitoring
- Job details modal

# Polish
- Consistent spacing and typography
- Proper loading states
- Empty states with helpful messages
- Error states with recovery actions
- Mobile responsive layouts

# Verification
- [ ] Works on mobile
- [ ] Loading states smooth
- [ ] Empty states helpful
- [ ] Error messages clear
```

**Phase 5 Checkpoint**: Full admin UI functional, teams can self-serve

---

## Phase 6: Polish & Production

**Goal**: Production-ready system with security, testing, and documentation

**Duration**: 4-6 days

**Deliverables**:
- Comprehensive error logging
- Security hardening
- Test coverage >80%
- Production documentation
- Deployment guide

**Success Criteria**:
- [ ] All security checklist items complete
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Documentation complete
- [ ] Successfully deployed to production

### Tasks for Vibekanban

#### Task 6.1: Security Hardening
**Estimate**: 6 hours
**Dependencies**: Phase 5 complete

```markdown
# Review security checklist
- [x] Webhook signature verification
- [x] Timestamp validation
- [x] Constant-time comparison
- [x] Token encryption
- [ ] Rate limiting configured
- [ ] Input validation comprehensive
- [ ] SQL injection protection (via Drizzle)
- [ ] XSS prevention (via Nuxt UI)

# Implement missing items
- Add rate limiting to all webhooks
- Add comprehensive Zod validation
- Review and test all inputs

# Security audit
- Run npm audit
- Check for exposed secrets
- Review .env.example

# Verification
- [ ] Security checklist 100% complete
- [ ] No critical vulnerabilities
- [ ] Secrets not committed
```

#### Task 6.2: Testing & Coverage
**Estimate**: 8 hours
**Dependencies**: Task 6.1

```markdown
# Unit tests
- Core services (AI, Notion, Processor)
- Adapters (Figma, Slack)
- Utilities (encryption, circuit breaker)
- Target: 80% coverage

# Integration tests
- Webhook → Discussion → Job flow
- Full pipeline with mocked external APIs
- Error handling paths

# E2E tests (Playwright)
- User can configure Figma source
- User can configure Slack source
- User can view job history
- User can retry failed job

# Run tests
pnpm test
pnpm test:e2e

# Verification
- [ ] >80% unit test coverage
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] CI pipeline passes
```

#### Task 6.3: Logging & Monitoring
**Estimate**: 4 hours
**Dependencies**: Task 6.1

```markdown
# Implement structured logging
- Use console.log with JSON format
- Add correlation IDs to all logs
- Log at appropriate levels (info, warn, error)

# Add metrics tracking
- Job success/failure rates
- Processing times (p50, p95, p99)
- API call counts
- Error frequency by type

# Setup monitoring
- Configure error tracking (Sentry/similar)
- Setup performance monitoring
- Create alerts for critical errors

# Verification
- [ ] Logs are structured and searchable
- [ ] Metrics tracked correctly
- [ ] Alerts trigger on errors
```

#### Task 6.4: Documentation & Deployment
**Estimate**: 6 hours
**Dependencies**: Task 6.2, Task 6.3

```markdown
# Create documentation
docs/
├── README.md (overview)
├── SETUP.md (installation guide)
├── DEPLOYMENT.md (production deployment)
├── CONFIGURATION.md (environment variables)
└── TROUBLESHOOTING.md (common issues)

# Deployment guide
- NuxtHub deployment steps
- Environment variable setup
- Database migration process
- Domain configuration
- Webhook URL setup

# Deploy to production
1. Create NuxtHub project
2. Configure environment variables
3. Run database migrations
4. Deploy via: nuxthub deploy
5. Configure webhook URLs
6. Test production deployment

# Verification
- [ ] Documentation complete
- [ ] Deployment successful
- [ ] Production webhooks working
- [ ] No errors in production logs
```

**Phase 6 Checkpoint**: System production-ready and deployed

---

## Testing Strategy

### Unit Testing

**Framework**: Vitest

**Coverage Target**: 80%+

**What to Test**:
- All service classes (AI, Notion, Processor)
- All adapter implementations
- All utilities (encryption, circuit breaker)
- All parsers (email parser)

**Mocking Strategy**:
- Mock external APIs (Figma, Slack, Notion, Claude)
- Mock database with in-memory SQLite
- Mock encryption with test keys

```typescript
// Example test
describe('AIService', () => {
  it('generates summary from thread', async () => {
    const mockClaude = vi.fn().mockResolvedValue({
      summary: 'Test summary',
      keyPoints: ['Point 1', 'Point 2']
    })

    const aiService = new AIService(mockApiKey)
    aiService.claude = mockClaude

    const result = await aiService.generateSummary(mockThread)

    expect(result.summary).toBe('Test summary')
    expect(mockClaude).toHaveBeenCalledOnce()
  })
})
```

### Integration Testing

**What to Test**:
- Webhook → Discussion → Job flow
- Discussion → Thread → AI → Notion → Task flow
- Error handling and retry logic
- Circuit breaker activation

**Setup**:
- Use test database
- Mock external APIs but test full pipeline
- Test with realistic data

```typescript
// Example integration test
describe('Figma Integration', () => {
  it('processes email to Notion task', async () => {
    // Setup
    const mailgunPayload = loadTestEmail()
    const mockFigmaApi = setupMockFigmaApi()
    const mockNotionApi = setupMockNotionApi()

    // Execute
    const response = await $fetch('/api/webhook/figma', {
      method: 'POST',
      body: mailgunPayload
    })

    // Wait for async processing
    await waitForJobCompletion()

    // Verify
    expect(response.ok).toBe(true)
    expect(mockNotionApi.createPage).toHaveBeenCalled()

    const discussion = await db.query.discussions.findFirst()
    expect(discussion.status).toBe('completed')
  })
})
```

### E2E Testing

**Framework**: Playwright

**What to Test**:
- User flows through UI
- OAuth flows
- Configuration wizards
- Job monitoring

**Setup**:
- Use separate test database
- Use test Slack/Figma accounts
- Use test Notion database

```typescript
// Example E2E test
test('user can configure Figma source', async ({ page }) => {
  await page.goto('/dashboard/test-team/integrations')

  // Click Figma card
  await page.click('[data-testid="figma-source"]')

  // Fill in config form
  await page.fill('[name="emailAddress"]', 'test@example.com')
  await page.fill('[name="apiToken"]', 'fig_test_token')
  await page.fill('[name="notionToken"]', 'ntn_test_token')
  await page.fill('[name="notionDatabaseId"]', 'abc123')

  // Test connection
  await page.click('[data-testid="test-connection"]')
  await expect(page.locator('.success-message')).toBeVisible()

  // Save
  await page.click('[data-testid="save-config"]')
  await expect(page.locator('.config-saved')).toBeVisible()
})
```

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Crouton breaking changes | High | Low | Pin Crouton version, test upgrades in dev |
| External API rate limits | Medium | Medium | Implement circuit breakers, rate limiting |
| Email parsing failures | Medium | Medium | Comprehensive test suite with real emails |
| Slack signature verification issues | Medium | Low | Follow Slack docs exactly, test thoroughly |
| Token encryption bugs | High | Low | Extensive tests, use standard libraries |

### Schedule Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Phase overruns | Medium | Medium | Build in 20% buffer, prioritize ruthlessly |
| Crouton generation issues | Medium | Low | Test generation early, have fallback plan |
| Integration complexity | High | Medium | Isolate adapters, build incrementally |
| Testing takes longer | Low | High | Start testing early, write tests alongside code |

### Mitigation Strategies

1. **Incremental Delivery**: Each phase delivers working functionality
2. **Early Testing**: Write tests alongside code, not after
3. **Documentation as You Go**: Document decisions and setup immediately
4. **Regular Checkpoints**: Demo at end of each phase
5. **Scope Control**: Defer nice-to-haves to future phases

---

## Summary

### Total Effort Breakdown (Lean Architecture)

| Phase | Tasks | Hours (Original) | Hours (Lean) | Days @ 6h/day |
|-------|-------|------------------|--------------|---------------|
| 1. Foundation | 4 (was 6) | 7 | **~6** | 1 |
| 2. Core Services | 6 (was 7) | 23 | **~15** | 2-3 |
| 3. Figma Adapter | 7 (was 8) | 26 | **~23** | 4 |
| 4. Slack Adapter | 6 (was 7) | 24 | **~23** | 4 |
| 5. Admin UI | 6 | 25 | **~25** | 4-5 |
| 6. Polish & Production | 4 | 24 | **~20** | 3-4 |
| **TOTAL** | **~34** | **129** | **~112** | **18-21 days** |

**Time Savings**: ~17 hours (~1+ week) from lean architecture simplifications

### Key Milestones (Revised)

- **Week 1**: Foundation + Core services complete
- **Week 2**: Figma integration live
- **Week 3**: Slack integration live
- **Week 4**: Admin UI complete
- **Week 5**: Testing, polish, production deployment

**Reduced from 6 weeks to 4-5 weeks** through architectural simplification

### Success Metrics

- ✅ Both Figma and Slack integrations working
- ✅ Team can self-configure without developer help
- ✅ >80% test coverage
- ✅ <5% job failure rate
- ✅ <20 second average processing time
- ✅ Zero security vulnerabilities
- ✅ Production deployed and stable

---

**Ready to Build?**

1. Import tasks into Vibekanban
2. Start with Phase 1, Task 1.1
3. Work incrementally through each phase
4. Demo at end of each phase
5. Deploy to production at Phase 6 completion

Good luck building Discubot! 🚀

---

**Document Version**: 2.0 (Revised - Lean Architecture)
**Last Updated**: 2025-11-11
**Total Tasks**: ~34 (reduced from 38)
**Total Effort**: 18-21 days (reduced from 21-27 days)
**Time Savings**: ~1+ week through simplification
**Confidence**: High (based on proven figno patterns + lean KISS principles)

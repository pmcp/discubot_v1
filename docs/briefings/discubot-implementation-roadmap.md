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

This roadmap breaks Discubot into **7 phases** with **~45 tasks** total. Each phase has clear:
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

Phase 6: Database Persistence (Week 5)
  └─ Historical data tracking, retry mechanism

Phase 7: Polish (Week 6)
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
| 5. Admin UI | 4-6 days | 9 | Dashboard + Management | Teams can configure |
| 6. Database Persistence | 1-2 days | 8 | Job tracking, retry | Historical data working |
| 7. Polish | 3-5 days | 4 | Testing + Deferred features | Ready for production |
| **TOTAL** | **5-6 weeks** | **~45** | **Full System** | **Live in production** |

**Time Savings**: ~1 week saved by removing unnecessary complexity

---

## Phase 1: Foundation

**Goal**: Set up project structure, generate 4 Crouton collections, verify database and types

**Duration**: 2-3 days (reduced from 3-5 days)

**Deliverables**:
- Project repository created
- 4 Crouton collections generated (discussions, configs, jobs, tasks)
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
crouton/schemas/
├── discussion-schema.json       (with embedded threadData - see briefing)
├── config-schema.json   (copy from briefing)
├── job-schema.json        (copy from briefing)
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
- [ ] All 4 collections listed (discussions, configs, jobs, tasks)
- [ ] target layer: 'discussion' (renamed from discubot)
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
layers/discubot/
  collections/
    discussions/     # With embedded threadData
    configs/
    jobs/
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
  './layers/discubot'  # Renamed from discubot
]

# Generate database migration
npx drizzle-kit generate

# Apply migration
npx drizzle-kit push

# Run typecheck
npx nuxt typecheck

# Verification
- [ ] No TypeScript errors
- [ ] 4 database tables created (discussions, configs, jobs, tasks)
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
mkdir -p layers/discubot/{server/{services,adapters,api,utils},types,components}

# Create layer config
touch layers/discubot/nuxt.config.ts

# Update main config
extends: [
  './layers/discubot',  # Generated
  './layers/discubot'               # Manual
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
layers/discubot/server/utils/retry.ts

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
   layers/discubot/server/services/

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
   layers/discubot/server/services/

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
layers/discubot/server/adapters/base.ts

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
layers/discubot/server/services/processor.ts

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
mkdir -p layers/discubot-figma/{server/{adapters,api/webhook,utils},types}

# Create layer config
touch layers/discubot-figma/nuxt.config.ts

# Update main config
extends: [
  './layers/discubot-core',
  './layers/discubot-figma',
  './layers/discubot'
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
   layers/discubot-figma/server/utils/

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
layers/discubot-figma/server/adapters/figma.ts

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
layers/discubot-figma/server/api/webhook/figma.post.ts

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
layers/discubot-core/server/api/internal/process-discussion.post.ts

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
layers/discubot/README.md (Figma section)

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
mkdir -p layers/discubot-slack/{server/{adapters,api/{webhook,oauth}},types}

# Create layer config
touch layers/discubot-slack/nuxt.config.ts

# Update main config
extends: [
  './layers/discubot-core',
  './layers/discubot-figma',
  './layers/discubot-slack',
  './layers/discubot'
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
layers/discubot-slack/server/adapters/slack.ts

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
layers/discubot-slack/server/api/webhook/slack.post.ts

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
layers/discubot-slack/server/api/oauth/install.get.ts
layers/discubot-slack/server/api/oauth/callback.get.ts

# install.get.ts
- Generate secure state token
- Store in slackOAuthStates table
- Redirect to Slack OAuth page with scopes

# callback.get.ts
- Verify state parameter
- Exchange code for access_token
- Store in configs (encrypted!)
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
layers/discubot/README.md (Slack section)

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
- Leverage generated configs form
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
- Leverage generated jobs table
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

## Phase 6: Database Persistence & Job Tracking

**Goal**: Enable historical data tracking, retry mechanisms, and full Admin UI functionality

**Duration**: 1-2 days

**Deliverables**:
- Database operations layer for discussions, jobs, tasks
- Processor service integrated with database
- Manual retry endpoint for failed discussions
- Job cleanup scheduler (30-day retention)
- Admin UI enhancements with retry functionality

**Success Criteria**:
- [ ] All discussions tracked in database (not just task-generating ones)
- [ ] Jobs tracked through all 6 processing stages
- [ ] Tasks stored with bidirectional Notion linking
- [ ] Failed discussions can be manually retried from Admin UI
- [ ] Old jobs auto-cleanup after 30 days
- [ ] Admin UI shows real historical data

### Tasks for Vibekanban

#### Task 6.1: Database Operations Layer
**Estimate**: 1.5 hours
**Dependencies**: Phase 5 complete

```markdown
# Create file
layers/discubot/server/database/operations.ts

# Implement CRUD operations
- createDiscussion(parsed, configId, status)
- updateDiscussionStatus(discussionId, status, error?)
- updateDiscussionResults(discussionId, thread, aiAnalysis, notionTasks)
- getDiscussionById(discussionId)
- createJob(discussionId, configId, teamId)
- updateJob(jobId, { status, stage, error, attempts })
- completeJob(jobId, processingTime, taskIds)
- createTask(discussionId, jobId, notionTask)
- cleanupOldJobs(daysOld = 30)

# Implementation notes
- Track ALL discussions (not just task-generating)
- Bidirectional linking: task.notionPageId for Notion sync
- Use Drizzle ORM for type safety
- Proper error handling and logging

# Verification
- [ ] All operations implemented
- [ ] TypeScript types correct
- [ ] No SQL injection risks (using Drizzle)
```

#### Task 6.2: Processor Service Integration
**Estimate**: 1 hour
**Dependencies**: Task 6.1

```markdown
# Modify file
layers/discubot/server/services/processor.ts

# Replace placeholder code with database calls
- Line 182-215: saveDiscussion() → use createDiscussion()
- Line 220-241: updateDiscussionStatus() → use updateDiscussionStatus()
- Line 246-274: updateDiscussionResults() → use updateDiscussionResults()

# Add job tracking
- Stage 1 (Validation): createJob(status: 'pending')
- Stage 2 (Config Loading): updateJob(stage: 'config_loading')
- Stage 3 (Thread Building): updateJob(stage: 'thread_building')
- Stage 4 (AI Analysis): updateJob(stage: 'ai_analysis')
- Stage 5 (Task Creation): createTask() for each Notion task
- Stage 6 (Finalization): completeJob() with metrics

# Error handling
- On failure: updateJob(status: 'failed', error: errorMessage)
- NO auto-retry (manual retry only per requirements)

# Verification
- [ ] All TODO/placeholder comments removed
- [ ] Database calls working
- [ ] Job tracking through all stages
- [ ] Discussions + tasks saved correctly
```

#### Task 6.3: Manual Retry Implementation
**Estimate**: 0.5 hours
**Dependencies**: Task 6.2

```markdown
# Create file
layers/discubot/server/api/discussions/retry.post.ts

# Implement retry endpoint
- POST /api/discussions/retry
- Accept: { discussionId: string }
- Load discussion using getDiscussionById()
- Reconstruct ParsedDiscussion object
- Create new job record
- Call processDiscussion() again
- Return success/error

# Modify processor.ts
- Implement processDiscussionById() (currently throws "not implemented")
- Load discussion data from database
- Reconstruct thread from threadData field
- Process through normal pipeline

# Verification
- [ ] Retry endpoint works
- [ ] Failed discussions can be reprocessed
- [ ] New job created for retry
- [ ] Original discussion updated
```

#### Task 6.4: Job Cleanup Scheduler
**Estimate**: 0.5 hours
**Dependencies**: Task 6.1

```markdown
# Create file
server/plugins/jobCleanup.ts

# Implement cleanup plugin
export default defineNitroPlugin(() => {
  // Run every 24 hours
  setInterval(async () => {
    const deleted = await cleanupOldJobs(30)
    console.log(`[JobCleanup] Deleted ${deleted} old jobs`)
  }, 24 * 60 * 60 * 1000)
})

# Configuration
- Cleanup interval: 24 hours (configurable via env var)
- Retention period: 30 days for completed/failed jobs
- Log results for monitoring

# Verification
- [ ] Plugin runs on server start
- [ ] Cleanup executes every 24 hours
- [ ] Old jobs deleted correctly
- [ ] Logs show deletion counts
```

#### Task 6.5: Type Safety & Validation
**Estimate**: 0.5 hours
**Dependencies**: Task 6.2

```markdown
# Add Zod schemas
- Schema for createDiscussion input
- Schema for updateJob input
- Schema for retry endpoint payload

# Ensure type compatibility
- Crouton types match processor types
- Database schema matches TypeScript interfaces
- Proper null/undefined handling

# Run typecheck
npx nuxt typecheck

# Verification
- [ ] No new TypeScript errors
- [ ] Zod validation works
- [ ] Types consistent across layers
```

#### Task 6.6: Testing Updates
**Estimate**: 1 hour
**Dependencies**: Task 6.5

```markdown
# Update existing tests
- Mock database operations in processor tests
- Update webhook tests to expect database calls
- Ensure integration tests pass with database layer

# Create new tests
tests/database/operations.test.ts
- Test all CRUD operations
- Test cleanupOldJobs()
- Mock database with in-memory SQLite

tests/api/discussions/retry.test.ts
- Test retry endpoint validation
- Test successful retry flow
- Test retry with missing discussion
- Test retry error handling

# Verification
- [ ] All tests pass
- [ ] Database operations tested
- [ ] Retry endpoint tested
- [ ] Integration tests updated
```

#### Task 6.7: Admin UI Enhancements
**Estimate**: 0.5 hours
**Dependencies**: Task 6.3

```markdown
# Modify file
layers/discubot/app/pages/dashboard/[team]/discubot/jobs.vue

# Add retry functionality
- Add "Retry" button to failed job cards
- Show loading state during retry
- Call /api/discussions/retry endpoint
- Refresh job list after retry completes
- Show success/error toast notification

# Verify data visibility
- Check discussions.vue shows real data
- Check tasks.vue shows real data
- All pages use Crouton viewers correctly

# Verification
- [ ] Retry button appears on failed jobs
- [ ] Retry works and refreshes data
- [ ] Discussion/task pages show data
- [ ] Loading states smooth
```

#### Task 6.8: Documentation
**Estimate**: 0.5 hours
**Dependencies**: All Phase 6 tasks

```markdown
# Document database schema relationships
docs/architecture/database-relationships.md
- Discussion → Job (1:1)
- Discussion → Tasks (1:N)
- Job → Tasks (1:N)
- Include ERD diagram

# Document retry workflow
docs/guides/retry-workflow.md
- When to use retry
- How retry works
- What gets preserved vs regenerated
- Limitations and edge cases

# Update PROGRESS_TRACKER.md
- Mark Phase 6 tasks as complete
- Update hours logged
- Update phase progress
- Add notes/learnings

# Verification
- [ ] Database relationships documented
- [ ] Retry workflow documented
- [ ] PROGRESS_TRACKER updated
```

**Phase 6 Checkpoint**: Admin UI fully functional with historical data, retry mechanism working, job cleanup automated

**Total Phase 6 Time**: ~6 hours

---

## Phase 7: Polish & Production

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

#### Task 7.1: Security Hardening
**Estimate**: 6 hours
**Dependencies**: Phase 6 complete

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

#### Task 7.2: Testing & Coverage
**Estimate**: 8 hours
**Dependencies**: Task 7.1

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

#### Task 7.3: Logging & Monitoring
**Estimate**: 4 hours
**Dependencies**: Task 7.1

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

#### Task 7.4: Documentation & Deployment
**Estimate**: 6 hours
**Dependencies**: Task 7.2, Task 7.3

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

**Phase 7 Checkpoint**: System production-ready and deployed

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
| 5. Admin UI | 9 (was 6) | 32 | **~32** | 5-6 |
| 6. Database Persistence | 8 | 0 | **~6** | 1 |
| 7. Polish & Production | 4 | 24 | **~20** | 3-4 |
| **TOTAL** | **~45** | **135** | **~125** | **19-23 days** |

**Time Savings**: ~10 hours from lean architecture simplifications

### Key Milestones (Revised)

- **Week 1**: Foundation + Core services complete
- **Week 2**: Figma integration live
- **Week 3**: Slack integration live
- **Week 4-5**: Admin UI complete
- **Week 5**: Database persistence + historical tracking
- **Week 6**: Testing, polish, production deployment

**Timeline**: 5-6 weeks with complete feature set including historical data tracking

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

**Document Version**: 3.0 (Updated - Added Database Persistence Phase)
**Last Updated**: 2025-11-12
**Total Tasks**: ~45 (expanded from 34 to include persistence)
**Total Effort**: 19-23 days (5-6 weeks)
**Key Addition**: Phase 6 - Database Persistence & Job Tracking
**Confidence**: High (based on proven figno patterns + lean KISS principles)

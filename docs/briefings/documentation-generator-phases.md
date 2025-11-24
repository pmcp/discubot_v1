# Documentation Generator - Phase Breakdown

This document details the 4-phase lean progression for building the documentation generator feature.

## Phase Philosophy: Build → Measure → Learn

Each phase is **fully functional and shippable**. After each phase, evaluate:
- Is this valuable to users?
- Should we proceed to the next phase?
- What should we iterate on?

---

## 🛹 Phase 1: Skateboard (8-12 hours)

### Goal
Prove the core value proposition: **Auto-generate documentation from completed tasks**.

### Features Included
✅ Notion webhook when status changes to "Done"
✅ Fetch the task page content
✅ AI analyzes task content
✅ Generate documentation (summary + key points)
✅ Append "## Documentation" section to Notion page

### Features NOT Included
❌ No link crawling
❌ No external context (GitHub, web)
❌ No Slack questions
❌ No admin UI (manual database config)

### Why Skateboard Works
Even without external context, the AI can generate:
- Summary of what was done
- Key implementation details from task description
- Action items that were completed
- Basic technical notes

This is **better than nothing** and proves whether users find value in auto-generated docs.

### Implementation Tasks

**1. Database Setup (3 hours)**
- Generate `documentationConfigs` collection
  - teamId, notionToken, notionDatabaseId, webhookUrl, webhookSecret, active
- Generate `documentationJobs` collection
  - configId, notionPageId, status, taskTitle, documentation, createdAt
- Run migrations
- Create CRUD queries

**2. Webhook Endpoint (2 hours)**
- Create `/api/webhooks/notion-documentation.post.ts`
- Verify Notion webhook signature
- Parse status change payload
- Create documentationJob (status: pending)
- Return 200 OK quickly (<3 seconds)

**3. Notion Page Fetcher (1 hour)**
- Create `server/services/notionFetcher.ts`
- Fetch page by ID using Notion API
- Extract blocks as markdown
- Handle pagination (100 blocks per request)
- Return structured page content

**4. AI Documentation Generator (2 hours)**
- Create `server/services/documentationGenerator.ts`
- Build prompt: "Generate documentation from this completed task"
- Call Claude API
- Parse AI response (markdown format)
- Handle errors gracefully

**5. Notion Page Updater (2 hours)**
- Create `server/services/notionUpdater.ts`
- Convert markdown → Notion blocks
  - Text blocks (2000 char limit)
  - Headers (h2, h3)
  - Lists (bulleted, numbered)
  - Code blocks
- Append blocks with markers:
  ```markdown
  <!-- DISCUBOT_DOCS_START -->
  ## Documentation
  [content]
  <!-- DISCUBOT_DOCS_END -->
  ```
- Handle Notion API errors

**6. Orchestration (1 hour)**
- Create `server/services/documentationProcessor.ts`
- State machine: pending → analyzing → completed/failed
- Update job status in database
- Error handling and logging

**7. Testing (1 hour)**
- Create test Notion database
- Manually trigger webhook
- Verify documentation appended
- Test 5 different task types

### File Structure
```
layers/documentation/
├── collections/
│   ├── documentationConfigs/
│   └── documentationJobs/
├── server/
│   ├── api/webhooks/
│   │   └── notion-documentation.post.ts
│   └── services/
│       ├── notionFetcher.ts
│       ├── documentationGenerator.ts
│       ├── notionUpdater.ts
│       └── documentationProcessor.ts
└── nuxt.config.ts
```

### Success Metrics
- ✅ Webhook receives status change within 5 seconds
- ✅ Documentation generated in <2 minutes
- ✅ Markdown properly formatted in Notion
- ✅ Re-generation replaces old docs (idempotent)

### Decision Point
**After Skateboard, ask:**
- "Is the basic documentation useful at all?"
- "Do users read it?"
- "What's missing that would make it more valuable?"

**If useful** → Proceed to Scooter (add context)
**If not useful** → Reconsider the approach or abort

---

## 🛴 Phase 2: Scooter (10-14 hours)

### Goal
Make documentation **significantly better** by analyzing related content.

### Added Features
✅ Extract links from task page
✅ Crawl 1 level deep (direct links only)
✅ Support 3 link types:
  - Notion pages (fetch via API)
  - GitHub URLs (commits, PRs, issues)
  - Web pages (extract article content)
✅ Enhanced AI prompt with all context
✅ List sources at end of documentation

### Still NOT Included
❌ No 2-level recursive crawling
❌ No Slack Q&A
❌ No admin UI

### Why Scooter Is Valuable
Tasks often reference:
- Design docs in Notion
- Implementation PRs on GitHub
- Related discussions
- External resources

By including this context, documentation becomes **comprehensive** instead of just summarizing the task itself.

### Implementation Tasks

**1. Link Extraction (2 hours)**
- Create `server/utils/linkExtractor.ts`
- Parse Notion blocks for URLs
- Categorize links:
  - Notion pages: `notion.so/*` or internal IDs
  - GitHub: `github.com/*/*`
  - Web: Everything else
- Return structured link list

**2. Notion Reader Adapter (3 hours)**
- Create `server/adapters/contentReaders/notionReader.ts`
- Fetch linked Notion pages
- Convert blocks to markdown
- Summarize if >2000 words
- Handle private/inaccessible pages gracefully
- Cache results (1 hour TTL)

**3. GitHub Reader Adapter (3 hours)**
- Create `server/adapters/contentReaders/githubReader.ts`
- Support URL types:
  - Commits: Extract message, files changed, stats
  - Pull Requests: Title, description, status
  - Issues: Title, description, comments (max 5)
- Use GitHub API (authenticated if token available)
- Truncate large diffs (max 500 lines)
- Handle rate limits (fallback to unauthenticated)

**4. Web Reader Adapter (2 hours)**
- Create `server/adapters/contentReaders/webReader.ts`
- Fetch URL content
- Extract article (skip nav/footer/ads)
  - Use libraries: mozilla/readability or cheerio
- Convert HTML → Markdown
- Limit to 1000 words
- Handle errors: timeout, 404, etc.

**5. Link Crawler Service (3 hours)**
- Create `server/services/linkCrawler.ts`
- Orchestrate fetching from all adapters
- Run in parallel (max 5 concurrent)
- 1 level deep only (no recursion yet)
- Max 30 unique links per job
- Track visited URLs to avoid duplicates
- Return structured results with metadata

**6. Enhanced AI Prompt (2 hours)**
- Update `documentationGenerator.ts`
- New prompt structure:
  ```
  Task Content: [original task]

  Related Context:
  - [Notion page 1 summary]
  - [GitHub commit summary]
  - [Web article summary]

  Generate comprehensive documentation covering:
  1. What was done
  2. How it was implemented (use related context)
  3. Related changes and links
  4. Future considerations
  ```
- Include source attribution
- Handle large context (hierarchical summarization)

**7. Testing (2 hours)**
- Test with tasks containing:
  - Only Notion links
  - Only GitHub links
  - Mixed link types
  - No links (should work like Skateboard)
- Verify quality improvement vs Skateboard

### File Structure (Added)
```
layers/documentation/
├── server/
│   ├── adapters/contentReaders/
│   │   ├── notionReader.ts      ← NEW
│   │   ├── githubReader.ts      ← NEW
│   │   └── webReader.ts         ← NEW
│   ├── services/
│   │   └── linkCrawler.ts       ← NEW
│   └── utils/
│       └── linkExtractor.ts     ← NEW
```

### Success Metrics
- ✅ Links extracted with 95%+ accuracy
- ✅ Crawling completes in <30 seconds
- ✅ All 3 link types supported
- ✅ Documentation quality significantly better than Skateboard
- ✅ Handles errors gracefully (skip failed links)

### Decision Point
**After Scooter, ask:**
- "Does linked content make docs significantly better?"
- "What information is still missing?"
- "Are users satisfied with the documentation?"

**If good quality** → Proceed to Bike (add Q&A)
**If content issues** → Iterate on extraction/summarization
**If users satisfied** → Stop here! Ship it as-is.

---

## 🚲 Phase 3: Bike (12-16 hours)

### Goal
Handle **missing information** by asking users clarifying questions.

### Added Features
✅ AI identifies questions while analyzing
✅ Post questions to #documentation Slack channel
✅ Tag the user who completed the task
✅ Wait for user reply (@discubot mention)
✅ Single-round Q&A (no clarifications yet)
✅ Regenerate documentation with answers
✅ 48-hour timeout → finalize with "Open Questions"

### Still NOT Included
❌ No multi-round clarifications
❌ No 2-level crawling
❌ No admin UI

### Why Bike Is Valuable
Even with full context, the AI may have questions:
- "How are refresh tokens stored?"
- "What's the rate limiting strategy?"
- "Why did you choose approach X over Y?"

Users have this knowledge but it's not documented. By asking, we **complete the documentation** instead of leaving gaps.

### Implementation Tasks

**1. Question Detection (4 hours)**
- Update AI prompt in `documentationGenerator.ts`
- Add question detection phase:
  ```
  Analyze the content and identify:
  1. What information is clear
  2. What information is missing or ambiguous
  3. Questions to ask the user (max 5)

  Format questions as:
  - Direct and specific
  - Answerable in 1-2 sentences
  - Technical and relevant to documentation
  ```
- Return: `{ documentation: string, questions: string[] }`
- Store questions in database

**2. Slack Integration Setup (2 hours)**
- Add `slackDocChannelId` to `documentationConfigs`
- Add `slackThreadId` to `documentationJobs`
- Update Slack webhook handler:
  ```typescript
  // In layers/discubot/server/api/webhooks/slack.post.ts
  async function handleSlackMention(event) {
    const config = await getTeamConfig(event.team_id)

    if (event.channel === config.documentationChannelId) {
      return await handleDocumentationReply(event)
    }
    // Existing task creation flow
    return await handleTaskDiscussion(event)
  }
  ```

**3. Question Posting Service (3 hours)**
- Create `server/services/questionHandler.ts`
- Format questions for Slack:
  ```
  🔍 Documentation Questions - Task: "Implement JWT auth"

  Hey @jane, I analyzed the completed task.
  Need clarification on a few points:

  1. How are refresh tokens stored?
  2. What's the rate limiting strategy?
  3. Are tokens encrypted in the database?

  Reply in this thread with @discubot to help complete the docs!
  (Say "skip" for questions you don't know)
  ```
- Post to #documentation channel
- Store thread_ts in job
- Update job status: analyzing → questioning

**4. Reply Detection & Parsing (4 hours)**
- Create reply handler in webhook
- Verify reply is in documented thread
- Extract answer text (remove @discubot mention)
- Parse multi-question answers:
  - Numbered format: "1. Answer to Q1..."
  - Natural format: "The tokens are stored..."
- Handle "skip" or "I don't know"
- Store answers in `pendingQuestions` table

**5. Documentation Regeneration (3 hours)**
- Update `documentationGenerator.ts`
- New prompt phase:
  ```
  Original Context: [task + links]
  Questions Asked: [list]
  User Answers: [list]

  Generate final documentation incorporating the answers.
  ```
- Replace documentation section in Notion
- Update job status: questioning → completed
- Post confirmation to Slack thread:
  ```
  ✅ Documentation updated!
  View here: [Notion link]
  ```

**6. Timeout Handler (3 hours)**
- Create cron job: `server/api/cron/documentation-timeout.get.ts`
- Run every hour
- Check jobs with status=questioning
- If `lastQuestionTime + 48h < now`:
  - Generate final docs with what we have
  - Add "## Open Questions" section
  - Post to Slack: "⏰ Timeout reached. Docs finalized."
  - Update status: completed
- Send 24h reminder if no response

**7. Testing (2 hours)**
- Test question detection (5 different scenarios)
- Test Slack posting
- Test reply detection
- Test timeout (use 5 min for testing)
- Test "skip" handling

### File Structure (Added)
```
layers/documentation/
├── collections/
│   └── pendingQuestions/         ← NEW
├── server/
│   ├── api/cron/
│   │   └── documentation-timeout.get.ts  ← NEW
│   └── services/
│       └── questionHandler.ts    ← NEW
```

### Success Metrics
- ✅ Questions detected accurately
- ✅ Posted to #documentation channel correctly
- ✅ User @mention detected
- ✅ Answers parsed correctly (80%+ accuracy)
- ✅ Documentation updated with answers
- ✅ Timeout fires after 48h
- ✅ 50%+ of questions get answered (user engagement)

### Decision Point
**After Bike, ask:**
- "Do users actually answer the questions?"
- "What's the answer rate?"
- "Are single-round answers sufficient, or do we need clarifications?"

**If users engage (>50%)** → Proceed to Car (polish for production)
**If users ignore questions** → Keep Scooter version, skip Q&A
**If answers need clarification** → Add multi-round in Car phase

---

## 🚗 Phase 4: Car (20-25 hours)

### Goal
Production-ready system with **polish and edge case handling**.

### Added Features
✅ 2-level recursive crawling (with safeguards)
✅ Multi-round Q&A clarifications (max 3 rounds)
✅ Smart answer analysis (confidence scoring)
✅ Advanced content extraction
✅ Admin UI (config management, jobs dashboard)
✅ Rate limiting and error recovery
✅ Monitoring and metrics

### Why Car Is Necessary
Bike phase is functional but lacks:
- Deep context (2 levels of links)
- Handling unclear answers
- User interface for configuration
- Production reliability (retries, rate limits)
- Visibility into system status

### Implementation Tasks

**1. 2-Level Recursive Crawling (6 hours)**
- Update `linkCrawler.ts`
- Track depth for each URL
- Recursive fetching:
  ```
  Level 0: Original task page
  Level 1: Direct links from task (existing)
  Level 2: Links from Level 1 pages
  ```
- Safeguards:
  - Track all visited URLs (avoid circular refs)
  - Max 100 unique pages total
  - Max 20 pages per level
  - Timeout: 2 minutes total
- Hierarchical summarization:
  - Summarize each L2 page
  - Combine L2 summaries for each L1 page
  - Final context: L1 summaries + L2 meta-summaries

**2. Multi-Round Q&A State Machine (4 hours)**
- Update `questionHandler.ts`
- Add answer analysis after each reply:
  ```typescript
  interface AnswerAnalysis {
    questionId: string
    understood: boolean       // Can we document with this?
    confidence: 0.0-1.0      // How confident?
    missingInfo: string[]    // What's still unclear?
    needsClarification: boolean
  }
  ```
- AI analyzes each answer
- Generate follow-up questions if needed:
  ```
  Thanks! I understood Question 2.

  Just need clarification on:
  1. [Original Q1] - You mentioned X, but can you clarify Y?
  3. [Original Q3] - Your answer suggests A, but the code shows B?
  ```
- Post in same thread
- Reset 48h timer
- Max 3 rounds total
- Update `conversationRounds` in job

**3. Advanced Content Extraction (4 hours)**
- Enhance GitHub adapter:
  - Full diff rendering (syntax highlighted)
  - PR review comments
  - Commit series analysis
- Enhance web adapter:
  - Better article extraction (readability)
  - Handle SPAs (wait for JS rendering)
  - Extract code snippets
- Enhance Notion adapter:
  - Parse tables
  - Handle databases
  - Extract images (descriptions)

**4. Admin UI - Config Management (3 hours)**
- Create `/app/pages/dashboard/[team]/documentation/index.vue`
- List all configs for team
- Add/Edit config form:
  - Notion database selector
  - Slack channel selector
  - Toggle active status
  - Webhook URL display
- Copy webhook URL button
- Test connection button

**5. Admin UI - Jobs Dashboard (3 hours)**
- Create `/app/pages/dashboard/[team]/documentation/jobs.vue`
- List all jobs (paginated, 20 per page)
- Filters:
  - Status (pending, analyzing, questioning, completed, failed)
  - Date range
  - Search by task title
- Columns:
  - Task title (link to Notion)
  - Status (with badge)
  - Created at
  - Questions count
  - Slack thread link

**6. Admin UI - Job Details (2 hours)**
- Create `/app/pages/dashboard/[team]/documentation/[jobId].vue`
- Show:
  - Task info (title, URL, completed by)
  - Status timeline
  - Crawled links list (expandable summaries)
  - Generated documentation (markdown preview)
  - Questions & answers
  - Slack thread embed (if available)
  - Actions: Retry, View in Notion

**7. Rate Limiting & Error Recovery (3 hours)**
- Implement queue system (optional: Bull/BullMQ)
- Rate limiters:
  - Notion: 3 req/sec
  - GitHub: Respect X-RateLimit headers
  - Claude: Token-based throttling
- Retry logic:
  - Exponential backoff (1s, 2s, 4s, 8s, 16s)
  - Max 3 retries
  - Permanent errors (4xx): Don't retry
  - Transient errors (5xx, timeout): Retry
- Job status tracking:
  - Failed jobs show error details
  - Retry button in UI

**8. Monitoring & Metrics (2 hours)**
- Add metrics tracking:
  - Jobs created/completed/failed (daily)
  - Average processing time
  - Question answer rate
  - Token usage (Claude API)
- Logging:
  - Structured logs (JSON format)
  - Log levels (debug, info, warn, error)
  - Request tracing (job ID in all logs)
- Optional: Sentry integration for errors

**9. Testing & Polish (3 hours)**
- Comprehensive unit tests
- Integration tests (full flow)
- E2E test (Playwright):
  - Configure via UI
  - Trigger webhook
  - Verify docs generated
- Load testing (10 concurrent jobs)
- Documentation updates

### File Structure (Added)
```
layers/documentation/
├── app/pages/dashboard/[team]/documentation/
│   ├── index.vue          ← NEW (configs)
│   ├── jobs.vue           ← NEW (jobs list)
│   └── [jobId].vue        ← NEW (job details)
├── server/
│   ├── api/cron/
│   │   └── metrics.get.ts ← NEW
│   └── utils/
│       ├── queue.ts       ← NEW
│       └── rateLimiter.ts ← NEW
```

### Success Metrics
- ✅ 2-level crawling handles 100+ pages without errors
- ✅ Multi-round clarifications resolve 80%+ of unclear answers
- ✅ Admin UI is intuitive (tested with 3 users)
- ✅ Rate limits prevent API throttling (0 rate limit errors)
- ✅ Error recovery succeeds for transient failures
- ✅ Average processing time <3 minutes per job
- ✅ System handles 50 concurrent jobs

### Final Decision Point
**After Car, evaluate:**
- "What features are actually used?"
- "What can be simplified or removed?"
- "What additional features do users request?"

**Actions:**
- Remove unused features
- Optimize hotpaths
- Plan future enhancements

---

## Summary: Time Investment by Phase

| Phase | Hours | Cumulative | Features | Value |
|-------|-------|------------|----------|-------|
| Skateboard | 8-12 | 8-12 | Basic doc generation | Proof of concept |
| Scooter | 10-14 | 18-26 | + Link crawling (1 level) | Comprehensive docs |
| Bike | 12-16 | 30-42 | + Slack Q&A (single-round) | Complete docs |
| Car | 20-25 | 50-67 | + 2-level crawling, Multi-round Q&A, Admin UI | Production-ready |

## Recommended Approach

**Start with:** Skateboard + Scooter together (~20 hours)
- Provides meaningful value from day 1
- Clear stopping point to evaluate

**Then decide:**
- Users love it + docs often incomplete → Add Bike
- Users satisfied → Ship Scooter version
- Needs polish for scale → Proceed to Car

---

**Next:** See `documentation-generator-implementation.md` for step-by-step instructions.

# Documentation Generator - Feature Overview

**Created:** 2025-11-24
**Status:** Planning Phase
**Estimated Total Time:** 18-50 hours (depending on phase)

## Executive Summary

This feature adds **automatic documentation generation** when Notion tasks are completed. It's a reverse flow from the existing system:

**Existing Flow:** Slack/Figma discussion → DiscuBot → Create Notion task
**New Flow:** Notion task completed → DiscuBot → Generate documentation → Ask clarifying questions in Slack → Update Notion

## Value Proposition

**Problem:** Teams complete tasks but documentation is often missing or incomplete. Context is lost over time.

**Solution:** When a task is marked "Done", DiscuBot automatically:
1. Analyzes the task and all linked content
2. Generates comprehensive documentation
3. Asks clarifying questions if needed
4. Updates the Notion page with final documentation

**Benefit:** Zero-effort documentation that captures context while it's fresh.

## High-Level Architecture

### New Layer: `layers/documentation/`

This feature is built as a **separate Nuxt layer** to:
- ✅ Avoid modifying existing flow system
- ✅ Enable/disable independently per team
- ✅ Keep codebase organized
- ✅ Allow easy removal if needed

### Core Flow

```
Notion Task Status → "Done"
  ↓
Webhook to DiscuBot
  ↓
Fetch task page + Extract links
  ↓
Crawl linked content (1-2 levels deep)
  ├─ Notion pages
  ├─ GitHub commits/PRs
  └─ Web articles
  ↓
AI: Generate documentation + Identify questions
  ↓
Append DRAFT to Notion page
  ↓
IF questions exist:
  ├─ Post to #documentation Slack channel
  ├─ User replies with @discubot mention
  ├─ AI analyzes answers
  ├─ Generate clarifications if needed (max 3 rounds)
  └─ Update Notion with final docs (48h timeout)
ELSE:
  └─ Done! Documentation complete
```

## Key Architecture Decisions

### 1. Dedicated #documentation Slack Channel

**Decision:** Use a dedicated Slack channel for all documentation Q&A.

**Why:**
- Simple routing: Channel ID check vs complex thread context registry
- Better organization: All doc conversations in one place
- Clear separation: Task creation happens in project channels
- Less noise: Doc questions don't clutter #general

**Implementation:**
```typescript
if (event.channel === config.documentationChannelId) {
  return handleDocumentationFlow(event)
} else {
  return handleTaskCreationFlow(event)  // Existing
}
```

### 2. Hierarchical Summarization

**Problem:** Full content extraction 2 levels deep = 100K+ tokens (exceeds limits)

**Solution:** Summarize each link first, then combine summaries
- Notion pages: Extract & summarize (max 2000 words)
- GitHub commits: Commit message + stats + truncated diff
- Web pages: Extract article content only (max 1000 words)
- Final context: 30-50 summaries (~10K tokens)

### 3. Idempotent Documentation Updates

**Problem:** Re-generation could duplicate or overwrite manual edits

**Solution:** Use HTML comment markers
```markdown
<!-- DISCUBOT_DOCS_START job:abc123 generated:2025-11-24T10:00:00Z -->
## Documentation
[AI-generated content]
<!-- DISCUBOT_DOCS_END -->
```

On re-generation: Replace content between markers, preserve everything else.

### 4. 48-Hour Timeout with Reset

**Policy:**
- Timer starts when bot posts questions
- **Resets when bot posts NEW clarifications** (user gets fresh 48h)
- Max 3 rounds total (prevents infinite loops)
- Max 7 days absolute limit
- 24h reminder if no response

### 5. Separate Collections (Not Extending Flows)

**Decision:** Create new collections instead of extending `flowinputs`/`flowoutputs`

**Why:**
- Different data model (reverse flow: Notion → Slack vs Slack → Notion)
- Different state machine (pending → analyzing → questioning → completed)
- Simpler to understand and maintain
- Can be removed cleanly if needed

## Database Schema (Overview)

### `documentationConfigs` - Per-team configuration
```typescript
{
  teamId, slackToken, slackDocChannelId,
  notionToken, notionDatabaseId,
  webhookUrl, webhookSecret, anthropicApiKey,
  active
}
```

### `documentationJobs` - Track generation jobs
```typescript
{
  configId, notionPageId, status,
  taskTitle, taskCompletedBy,
  analyzedLinks, draftDocumentation, finalDocumentation,
  questions, slackThreadId, conversationRounds, lastQuestionTime
}
```

Status: `pending → analyzing → questioning → completed/failed`

### `pendingQuestions` - Track individual questions
```typescript
{
  jobId, questionText, questionNumber,
  status, answer, aiAnalysis
}
```

## Lean Progression Strategy

We're building this in 4 phases, where **each phase is fully functional**:

### 🛹 Skateboard (8-12h)
**Goal:** Prove core value
**Features:** Basic doc generation from task content only
**Value:** Better than nothing!

### 🛴 Scooter (+10h = 18-22h total)
**Goal:** Make docs much better
**Features:** Add 1-level link crawling (Notion, GitHub, web)
**Value:** Comprehensive documentation with context

### 🚲 Bike (+12h = 30-34h total)
**Goal:** Handle missing information
**Features:** Add Slack Q&A (single-round, 48h timeout)
**Value:** Complete documentation via user input

### 🚗 Car (+20h = 50-54h total)
**Goal:** Production-ready
**Features:** 2-level crawling, multi-round Q&A, Admin UI, polish
**Value:** Enterprise-grade with edge cases handled

**Decision points after each phase:** Evaluate if next phase is needed.

## Integration with Existing System

### What We Reuse ✅
- Slack adapter patterns (postMessage, reactions)
- User mappings (Notion user ID ↔ Slack user ID)
- Team management structure
- AI service patterns (Claude API wrapper)
- Rate limiting utilities

### What's New ❌
- Separate `layers/documentation/` layer
- New webhook endpoint (`/api/webhooks/notion-documentation`)
- Read-only content adapters (Notion, GitHub, web readers)
- Documentation generation service
- Markdown → Notion blocks converter

### What We Modify 🔧
- Slack webhook router: Add channel check
  ```typescript
  // In layers/discubot/server/api/webhooks/slack.post.ts
  if (event.channel === config.documentationChannelId) {
    // NEW: Route to documentation flow
    return handleDocumentationFlow(event)
  }
  // EXISTING: Task creation flow continues unchanged
  return handleTaskCreationFlow(event)
  ```

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Context window explosion | Hierarchical summarization + hard limits |
| API rate limits | Queue system with delays, exponential backoff |
| Users ignore questions | 24h reminder + 48h timeout + "Open Questions" section |
| Circular references | Track visited URLs, max depth, max pages |
| Slack routing conflicts | Dedicated #documentation channel (simple & clear) |
| Malformed web content | Timeout on fetch, fallback to basic extraction |

## Success Criteria

### Skateboard
- ✅ Webhook receives Notion status change
- ✅ Documentation generated within 2 minutes
- ✅ Markdown appended to Notion page

### Scooter
- ✅ Links extracted correctly (95%+ accuracy)
- ✅ 1-level crawling completes in <30 seconds
- ✅ Documentation quality significantly improves

### Bike
- ✅ Questions posted to #documentation channel
- ✅ User replies detected and processed
- ✅ 80%+ of questions get answered

### Car
- ✅ 2-level crawling handles 100+ pages
- ✅ Multi-round clarifications work smoothly
- ✅ Admin UI shows all jobs and statuses

## File Structure

```
layers/documentation/
├── nuxt.config.ts
├── collections/
│   ├── documentationConfigs/
│   ├── documentationJobs/
│   └── pendingQuestions/
├── server/
│   ├── adapters/contentReaders/
│   │   ├── notionReader.ts
│   │   ├── githubReader.ts
│   │   └── webReader.ts
│   ├── services/
│   │   ├── linkCrawler.ts
│   │   ├── documentationGenerator.ts
│   │   ├── notionUpdater.ts
│   │   └── questionHandler.ts
│   ├── api/
│   │   ├── webhooks/notion-documentation.post.ts
│   │   └── documentation/
│   │       ├── configs/
│   │       └── jobs/
│   └── utils/
│       ├── markdownToNotionBlocks.ts
│       └── contentSummarizer.ts
└── app/pages/dashboard/[team]/documentation/
    ├── index.vue       # Config management
    ├── jobs.vue        # Jobs list
    └── [jobId].vue     # Job details
```

## Next Steps

1. **Read detailed documentation:**
   - `documentation-generator-phases.md` - Detailed phase breakdown
   - `documentation-generator-technical-spec.md` - Database schemas, APIs
   - `documentation-generator-implementation.md` - Step-by-step guide
   - `documentation-generator-testing.md` - Testing strategy

2. **Start with Skateboard phase**
   - Follow implementation guide
   - Use TodoWrite to track progress
   - Commit after each major step

3. **Evaluate at decision points**
   - After Skateboard: Is basic doc generation useful?
   - After Scooter: Does link context improve docs?
   - After Bike: Do users answer questions?

## Related Documents

- **Phases:** `documentation-generator-phases.md`
- **Technical Spec:** `documentation-generator-technical-spec.md`
- **Implementation:** `documentation-generator-implementation.md`
- **Testing:** `documentation-generator-testing.md`

---

**Ready to start?** Begin with the implementation guide for Skateboard phase.

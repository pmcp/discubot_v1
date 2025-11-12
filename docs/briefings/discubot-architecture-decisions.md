# Discubot: Architecture Decisions Record

**Project**: Discubot - Universal Discussion-to-Notion Sync System
**Date**: 2025-11-11
**Purpose**: Document architectural decisions and trade-offs made during design
**Version**: 2.0 (Lean Architecture Revision)

---

## Table of Contents

1. [Overview](#overview)
2. [Decision Summary](#decision-summary)
3. [Detailed Decisions](#detailed-decisions)
4. [Deferred Features](#deferred-features)
5. [Rationale](#rationale)
6. [Future Considerations](#future-considerations)

---

## Overview

This document records the key architectural decisions made for Discubot v2, particularly focusing on the **lean approach** that simplifies the original design without sacrificing essential functionality.

### Philosophy

**Guiding Principle** (from CLAUDE.md):
> "Start simple, add complexity only when proven necessary"

We're building for **current needs** (2 sources, 0 users) not **imagined future scale** (10+ sources, 1000+ users).

---

## Decision Summary

| Decision | Original Plan | Lean Approach | Status |
|----------|---------------|---------------|--------|
| **Collections** | 6 collections | 4 collections | ✅ Implemented |
| **Layer Structure** | 4 separate layers | 2 layers | ✅ Implemented |
| **Threads Data** | Separate collection | Embedded in discussions | ✅ Implemented |
| **Sources Data** | Database collection | Hardcoded constants | ✅ Implemented |
| **Circuit Breaker** | MVP Phase 2 | Deferred to Phase 6 | ⏳ Deferred |
| **Token Encryption** | MVP Phase 2 | Deferred to Phase 6 | ⏳ Deferred |
| **AI Caching** | KV-based | Map-based (simpler) | ✅ Implemented |
| **Processing Pipeline** | 7 stages (kept) | 7 stages | ✅ Kept |
| **Notion Field Mapping** | Configurable (kept) | Configurable | ✅ Kept |
| **Multi-Task Detection** | Enabled (kept) | Enabled | ✅ Kept |
| **SuperSaaS Integration** | Enabled (kept) | Enabled | ✅ Kept |

---

## Detailed Decisions

### Decision 1: Reduce Collections from 6 to 4

**Context:**
Original design had 6 collections:
- discussions
- threads
- sources
- sourceConfigs
- syncJobs
- tasks

**Decision:** Remove `threads` and `sources`, keep 4 collections

**Rationale:**

**Threads Collection - REMOVED**
- **Problem**: Threads collection duplicated much of discussions data
- **Solution**: Embed thread data as JSON in `discussions.threadData`
- **Benefits**:
  - Fewer database tables to manage
  - Simpler queries (no joins needed)
  - All discussion data in one place
  - Easier to understand
- **Trade-offs**:
  - Can't query individual messages directly
  - JSON field less structured than relational
- **Mitigation**:
  - Can add threads collection later if complex message queries needed
  - JSON is fine for most use cases (display, AI processing)

**Sources Collection - REMOVED**
- **Problem**: Only 2 static records (Figma, Slack)
- **Solution**: Hardcode source types in adapter files
- **Benefits**:
  - No need for database table for 2 records
  - Source types are code-level concepts anyway
  - Simpler seeding/deployment
  - Faster lookups (no DB query)
- **Trade-offs**:
  - Can't add sources via UI (must deploy code)
  - Less flexible for non-technical users
- **Mitigation**:
  - Only developers add sources anyway (they write adapters)
  - Can add sources collection later if user-created adapters needed

**Example Hardcoded Sources:**
```typescript
// layers/discussion/server/constants/sources.ts
export const SOURCE_TYPES = {
  FIGMA: {
    id: 'figma',
    name: 'Figma',
    adapterClass: FigmaAdapter,
    icon: '🎨',
    requiresEmail: true
  },
  SLACK: {
    id: 'slack',
    name: 'Slack',
    adapterClass: SlackAdapter,
    icon: '💬',
    requiresWebhook: true
  }
} as const
```

---

### Decision 2: Simplify Layer Structure from 4 to 2

**Context:**
Original design had 4 separate layers:
- discussion-core/ (shared services)
- discussion-figma/ (Figma adapter)
- discussion-slack/ (Slack adapter)
- discussion-sync/ (Crouton collections)

**Decision:** Consolidate to 2 layers
- discussion/ (Crouton-generated, never edit)
- discussion/ (all manual code)

**Rationale:**

**Benefits:**
- **Simpler navigation**: All manual code in one place
- **Easier imports**: No layer hopping (`~/server/adapters/figma` vs `@discussion-figma/server/adapters/figma`)
- **Better comparison**: Both adapters side-by-side
- **Less overhead**: Fewer nuxt.config.ts files to manage
- **Follows KISS**: "One domain = one layer (only if it helps)"

**Trade-offs:**
- Larger `discussion/` layer
- Can't deploy adapters independently
- Less separation of concerns

**Mitigation:**
- Can split layers later if needed (when we have 5+ adapters)
- Directory structure still organized (adapters/, services/, api/)
- Git history shows clear boundaries

**Structure:**
```
layers/
├── discussion/   # Generated (100 files)
│   ├── collections/
│   │   ├── discussions/
│   │   ├── sourceConfigs/
│   │   ├── syncJobs/
│   │   └── tasks/
│   └── nuxt.config.ts
│
└── discussion/               # Manual (30 files)
    ├── server/
    │   ├── services/
    │   │   ├── ai.ts
    │   │   ├── notion.ts
    │   │   └── processor.ts
    │   ├── adapters/
    │   │   ├── base.ts
    │   │   ├── figma.ts
    │   │   └── slack.ts
    │   ├── api/
    │   │   ├── webhook/
    │   │   └── internal/
    │   └── utils/
    ├── types/
    └── components/
```

---

### Decision 3: Defer Circuit Breaker to Phase 6

**Context:**
figno used circuit breaker pattern to protect against API outages. Original plan included it in MVP.

**Decision:** Use simple retry logic for MVP, add circuit breaker in Phase 6

**Rationale:**

**Why It's Not Needed Now:**
- **No scale problems yet**: 0 users, 0 API calls
- **Premature optimization**: Solving problems we don't have
- **Adds complexity**: More code to maintain and test
- **Simple retry works**: Exponential backoff handles transient failures

**MVP Approach:**
```typescript
// Simple retry with exponential backoff
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
```

**When to Add Circuit Breaker:**
- Claude API goes down and causes cascading failures
- Queue backs up during outages
- Making >1000 API calls/day
- Monitoring shows repeated failures to same services

**Implementation Plan (Phase 6):**
```typescript
// Future: Port from figno
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private failures = 0
  private readonly threshold = 3
  private readonly timeout = 30000

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure() {
    this.failures++
    if (this.failures >= this.threshold) {
      this.state = 'open'
      this.lastFailure = Date.now()
    }
  }
}
```

---

### Decision 4: Defer Token Encryption to Phase 6

**Context:**
Original plan encrypted all API tokens using AES-256-GCM before storing in database.

**Decision:** Store tokens in plain text in D1, defer encryption to Phase 6

**Rationale:**

**Why Plain Text Is OK for MVP:**
- **D1 encrypted at rest**: Cloudflare encrypts the entire database
- **Same security model**: Encryption key in env vars = same access as database
- **No compliance req yet**: Not pursuing SOC2/ISO27001
- **Adds complexity**: Encrypt/decrypt on every API call
- **Key management overhead**: Rotation, storage, recovery

**Security Layers Still in Place:**
- ✅ Webhook signature verification (prevents unauthorized access)
- ✅ Rate limiting (prevents abuse)
- ✅ Team-based authorization (users can't access other teams' configs)
- ✅ HTTPS in production (encrypted in transit)
- ✅ Environment variable security (secret management)

**When to Add Encryption:**
- Pursuing SOC2 or ISO27001 certification
- Customer explicitly requires it
- Handling highly sensitive regulated data
- Database breach concerns increase

**Implementation Plan (Phase 6):**
```typescript
// server/utils/encryption.ts
import crypto from 'crypto'

const config = useRuntimeConfig()
const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(config.encryptionKey, 'hex')

export async function encryptToken(plainText: string): Promise<string> {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)

  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export async function decryptToken(encrypted: string): Promise<string> {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

---

### Decision 5: Use Map-based Cache Instead of KV

**Context:**
figno used KV (key-value store) for AI response caching. Original plan continued this.

**Decision:** Use in-memory Map for MVP, upgrade to KV in Phase 6

**Rationale:**

**Why Map Works for MVP:**
- **Single-server deployment**: No multi-region needs yet
- **No external dependencies**: No KV setup required
- **Same performance**: In-memory is actually faster
- **Simpler code**: No async storage calls
- **Works identically**: Same cache hit/miss behavior

**MVP Implementation:**
```typescript
// server/services/ai.ts
const summaryCache = new Map<string, {
  summary: string
  timestamp: number
}>()

async function getCachedSummary(thread: Thread): Promise<string | null> {
  const key = JSON.stringify(thread.messages)
  const cached = summaryCache.get(key)

  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.summary
  }

  return null
}

async function cacheSummary(thread: Thread, summary: string): Promise<void> {
  const key = JSON.stringify(thread.messages)
  summaryCache.set(key, {
    summary,
    timestamp: Date.now()
  })
}
```

**When to Upgrade to KV:**
- Deploying to multiple Cloudflare regions
- Cache size exceeds memory limits (unlikely <10GB)
- Need cache persistence across deployments
- Want distributed cache across instances

**Migration Path:**
```typescript
// Just swap implementation, same interface
const useAiCache = config.multiRegion ? kvCache : mapCache
```

---

### Decision 6: Keep 7-Stage Processing Pipeline

**Context:**
Original plan had 7 distinct pipeline stages. Code review suggested reducing to 3.

**Decision:** Keep all 7 stages

**Rationale:**

**User Preference:** Granular observability and stage-specific retry

**Benefits:**
- **Precise monitoring**: Know exactly where failures occur
- **Granular retry**: Can retry from specific stages
- **Better debugging**: Detailed logs per stage
- **Status tracking**: Users see progress through pipeline

**7 Stages:**
1. **Ingestion**: Webhook received, discussion created
2. **Job Creation**: Sync job initialized
3. **Thread Building**: Fetch full thread from source
4. **AI Analysis**: Claude processes thread
5. **Task Creation**: Notion tasks created
6. **Notification**: Confirmation posted to source
7. **Completion**: Job marked complete

**Trade-offs:**
- More complex state machine
- More database writes
- More code to maintain

**Mitigation:**
- Well-tested state machine from figno
- Clear stage definitions
- Good logging at each stage

---

### Decision 7: Keep Notion Field Mapping & Multi-Task Detection

**Context:**
Code review suggested deferring these as complexity.

**Decision:** Keep both features in MVP

**Rationale:**

**Notion Field Mapping:**
- **Real need**: Different teams have different Notion schemas
- **Not complex**: Just a JSON config field
- **High value**: Makes product usable for more customers

**Multi-Task Detection:**
- **Core feature**: One of Discubot's differentiators
- **Already designed**: Proven in figno
- **User value**: Saves manual task creation time

Both features are **product-level decisions**, not architectural complexity.

---

###Decision 8: Keep SuperSaaS Integration

**Context:**
Code review questioned multi-tenancy complexity for MVP.

**Decision:** Keep SuperSaaS connector

**Rationale:**

**Why Keep It:**
- **Proven solution**: Works well in production
- **Required feature**: Can't launch without team isolation
- **Crouton handles it**: `useTeamUtility: true` does the work
- **No extra code**: Automatic teamId scoping

**Complexity Is Low:**
- Crouton auto-adds `teamId` to all collections
- All queries auto-scoped by team
- No manual tenant logic needed

**Alternative Would Be Worse:**
- Deploy separate instance per customer (ops nightmare)
- Build custom tenant solution (reinventing wheel)
- Skip multi-tenancy (can only serve 1 customer)

---

## Deferred Features

### Phase 6: Scale & Compliance

When to implement each deferred feature:

#### Circuit Breaker
**Trigger Conditions:**
- API outage causes cascading failures
- Queue backs up during external service outages
- Repeated failures to same service (>10% failure rate)
- Making >10,000 API calls/day

**Metrics to Monitor:**
- API success/failure rates
- Queue depth over time
- Error frequency by service

#### Token Encryption
**Trigger Conditions:**
- Pursuing SOC2/ISO27001 certification
- Customer compliance requirements (HIPAA, etc.)
- Storing regulated data (PII, health, financial)
- Post-breach requirement

**Implementation Checklist:**
- [ ] Generate and rotate encryption keys
- [ ] Implement encrypt/decrypt utilities
- [ ] Migrate existing tokens
- [ ] Update all config read/write paths
- [ ] Add key rotation schedule

#### KV Caching
**Trigger Conditions:**
- Deploying to multiple regions
- Cache size exceeds 10GB
- Need cache persistence
- Want distributed cache

**Migration Steps:**
1. Create KV namespace in Cloudflare
2. Implement KV cache class
3. Feature flag to switch between Map/KV
4. Test cache hit rates
5. Deploy gradually

---

## Rationale

### Why Lean Approach?

**Current Reality:**
- 0 users
- 2 sources (Figma, Slack)
- 0 API calls/day
- Solo developer
- MVP launch goal

**Original Plan Optimized For:**
- 100+ users
- 10+ sources
- 10,000+ API calls/day
- Team of developers
- Production scale

**Mismatch:** Building for imagined future scale instead of current needs

**Lean Approach:**
- Build for current scale
- Add complexity when real problems emerge
- Ship faster (4 weeks vs 6 weeks)
- Less code to maintain
- Easier to understand

### YAGNI Principle

**You Aren't Gonna Need It**

Features we removed/deferred:
- **Threads collection**: Might never need complex message queries
- **Sources collection**: Will probably always be code-level
- **Circuit breaker**: May never hit scale problems
- **Token encryption**: May never pursue SOC2
- **KV caching**: May never deploy multi-region

**If we do need them:**
- Architecture supports adding them
- We'll have real requirements (not guesses)
- We'll have usage data to guide design

---

## Future Considerations

### When to Add Back Removed Features

#### Threads Collection
**Add when:**
- Need to query individual messages
- Want message-level analytics
- Build message search feature
- Thread data >10MB (too large for JSON field)

**Migration Path:**
1. Create threads collection
2. Migrate discussions.threadData to threads table
3. Update queries to join discussions ← threads
4. Deprecate threadData field

#### Sources Collection
**Add when:**
- Non-developers need to add sources
- Building marketplace of community adapters
- Dynamic source configuration UI
- Source metadata becomes complex

**Migration Path:**
1. Create sources collection
2. Seed with hardcoded data
3. Update adapters to read from DB
4. Remove hardcoded constants

### Monitoring for Scale Triggers

**Metrics to Track:**

1. **API Call Volume**
   - Claude API calls/day
   - Notion API calls/day
   - Source API calls/day

2. **Failure Rates**
   - Jobs failed/total jobs
   - API errors/total calls
   - Circuit breaker triggers (if implemented)

3. **Performance**
   - Processing time (p50, p95, p99)
   - Queue depth
   - Cache hit rates

4. **Growth**
   - New users/week
   - Active teams
   - Configured sources
   - Discussions processed/day

**Thresholds for Action:**
- API calls >1,000/day → Consider circuit breaker
- Failure rate >5% → Investigate reliability
- Processing time >30s → Optimize pipeline
- >50 teams → Evaluate multi-region
- >10 sources → Consider dynamic source config

---

## Lessons Learned

### What Worked

1. **Code Review Process**: External review caught overengineering
2. **Iterative Discussion**: Back-and-forth clarified requirements
3. **Pragmatic Decision-Making**: Chose simplicity over elegance
4. **Clear Rationale**: Documented "why" for each decision

### What to Remember

1. **Build for Now**: Current needs > imagined future
2. **Defer by Default**: Only add complexity when proven necessary
3. **Data Over Guesses**: Let usage data guide architecture
4. **Keep It Simple**: KISS principle beats clever solutions

### Quotes to Remember

From CLAUDE.md:
> "Start simple, add complexity only when proven necessary"

From this review:
> "You can always add complexity later. You can rarely remove it once it's there."

> "We're building for current needs (2 sources, 0 users) not imagined future scale (10+ sources, 1000+ users)"

---

## Summary

### Original Plan
- 6 collections
- 4 layers
- Circuit breaker
- Token encryption
- KV caching
- **6 weeks to MVP**

### Lean Plan
- 4 collections
- 2 layers
- Simple retry logic
- Plain text storage
- Map caching
- **4-5 weeks to MVP**

### Kept Features
- ✅ 7-stage pipeline (user preference)
- ✅ Notion field mapping (product feature)
- ✅ Multi-task detection (differentiator)
- ✅ SuperSaaS integration (proven solution)

### Result
- **Same functionality**
- **Less complexity**
- **Faster delivery**
- **Easier maintenance**
- **Right-sized for MVP**

---

**Document Version**: 1.0
**Last Updated**: 2025-11-11
**Authors**: Architecture Review Discussion
**Status**: Approved for Implementation

**Next Review**: After Phase 3 completion (when we have real usage data)

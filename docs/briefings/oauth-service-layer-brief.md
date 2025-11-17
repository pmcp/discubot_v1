# OAuth Service Layer Implementation - Technical Briefing

**Date:** 2025-01-17
**Status:** ~~Proposed Solution~~ → **DECISION RECORDED**
**Priority:** High - Production OAuth Currently Broken
**Author:** Technical Investigation

---

## 🎯 FINAL DECISION (2025-01-17)

**Selected Approach:** Option A - Quick Fix (KISS Principle)

**Reasoning:**
- Solves the immediate production issue in 5 minutes
- Avoids premature abstraction (service layer not yet proven necessary)
- Follows CLAUDE.md principle: "Start simple, add complexity only when proven necessary"
- Service layer benefits are speculative (based on hypothetical future features)
- Can refactor to service layer later if we add 3+ config creation code paths

**Implementation:** See Phase 15 in PROGRESS_TRACKER.md

**Deferred:** Service layer implementation added to "Deferred Items" - will revisit when proven necessary

---

## Executive Summary

The OAuth callback endpoint is failing in production with a 500 error due to missing required database fields (`createdBy` and `updatedBy`). This briefing documents the investigation findings and proposes three solution options.

**Original Recommendation:** Implement a shared config service layer that both API endpoints and OAuth callbacks can use, ensuring consistent audit field handling without architectural compromises.

**Final Decision:** Implement Option A (quick fix) following KISS principle. Service layer deferred until proven necessary.

---

## Problem Statement

### Production Error
```
500 - OAuth callback failed
URL: https://discubot.cloudflare-e53.workers.dev/api/oauth/slack/callback
```

### User Impact
- Users cannot connect Slack workspaces via OAuth
- OAuth flow completes on Slack's side but fails when redirecting back
- Configs are not being created/updated in the database

### Root Cause
The OAuth callback at `/layers/discubot/server/api/oauth/slack/callback.get.ts` calls database functions directly without providing required `createdBy` and `updatedBy` fields that were added in commit `7f08e65`.

**Database Schema** (`schema.ts:48-49`):
```typescript
createdBy: text('createdBy').notNull(),  // Required field
updatedBy: text('updatedBy').notNull()   // Required field
```

**Current OAuth Call** (missing fields):
```typescript
await createDiscubotConfig({
  teamId,
  owner: SYSTEM_USER_ID,
  sourceType: 'slack',
  // ... other fields ...
  // ❌ MISSING: createdBy and updatedBy
})
```

---

## Investigation Findings

### How Crouton Handles Audit Fields

Crouton's normal API flow automatically handles these fields:

**API Endpoint Pattern** (`index.post.ts:8-22`):
```typescript
const { team, user } = await resolveTeamAndCheckMembership(event)

return await createDiscubotConfig({
  ...dataWithoutId,
  teamId: team.id,
  owner: user.id,
  createdBy: user.id,     // ✅ Automatically provided
  updatedBy: user.id      // ✅ Automatically provided
})
```

**The Difference:**
- API endpoints: User-initiated, have session context
- OAuth callback: System-initiated, no user session

### Why OAuth Bypasses Crouton

OAuth is fundamentally a **system operation:**
- Triggered by Slack redirecting back (webhook-style)
- No authenticated user session
- Should use `SYSTEM_USER_ID` for audit fields
- Can't use normal auth middleware (`resolveTeamAndCheckMembership`)

---

## Solution Options Considered

### Option A: Quick Fix (Add Fields Directly)
**Approach:** Add `createdBy: SYSTEM_USER_ID` directly to OAuth callback

**Pros:**
- Simple, one-file change
- Fixes production immediately (5 min)
- Consistent with processor.ts pattern

**Cons:**
- Doesn't address architectural inconsistency
- Manual field management in multiple places
- Future audit field changes require multiple updates

**Verdict:** ⚠️ Works but not ideal long-term

---

### Option B: Force OAuth Through API Endpoints
**Approach:** Make OAuth use Crouton's API endpoints with fake user context

**Pros:**
- All config operations go through same code path
- Centralized validation and business logic

**Cons:**
- Artificial user context creation (fighting the framework)
- Complex middleware to fake team/user session
- Data transformation overhead (Slack OAuth → API format)
- Semantically wrong (system operation pretending to be user operation)
- Circular dependency risk (both in same layer)
- Harder to test and debug

**Verdict:** ❌ Overengineered, creates more problems than it solves

---

### Option C: Service Layer (Recommended)
**Approach:** Create shared service that both API and OAuth use

**Pros:**
- ✅ Clean separation: business logic vs. transport layer
- ✅ Consistent audit field handling
- ✅ No fake user context needed
- ✅ Each caller handles its own auth/context
- ✅ Easy to test in isolation
- ✅ Future-proof for additional business logic

**Cons:**
- Slightly more code (one new file)
- Need to update multiple files

**Verdict:** ✅ Best architecture - clean, maintainable, extensible

---

## Recommended Architecture

### Service Layer Pattern

```
┌─────────────────────────────────────────────────────┐
│                   Transport Layer                    │
│  (Handles auth, HTTP, context, validation)          │
├──────────────────────┬──────────────────────────────┤
│  API Endpoints       │  OAuth Callbacks             │
│  /api/configs        │  /api/oauth/slack/callback   │
│                      │                              │
│  • Has user session  │  • System operation          │
│  • Uses user.id      │  • Uses SYSTEM_USER_ID       │
│  • Validates auth    │  • Validates state token     │
└──────────┬───────────┴───────────┬──────────────────┘
           │                       │
           └───────────┬───────────┘
                       ▼
           ┌───────────────────────┐
           │   Service Layer       │
           │   config-service.ts   │
           │                       │
           │  • Business logic     │
           │  • Audit fields       │
           │  • Validation         │
           └───────────┬───────────┘
                       ▼
           ┌───────────────────────┐
           │   Data Layer          │
           │   queries.ts          │
           │                       │
           │  • Database ops       │
           │  • SQL queries        │
           └───────────────────────┘
```

### File Structure

```
layers/discubot/
├── server/
│   ├── services/                  ← NEW
│   │   └── config-service.ts      ← Shared business logic
│   └── api/
│       ├── oauth/
│       │   └── slack/
│       │       └── callback.get.ts    (uses service)
│       └── configs/
│           ├── index.post.ts          (uses service)
│           └── [id].patch.ts          (uses service)
```

---

## Implementation Plan

### Step 1: Create Config Service
**File:** `/layers/discubot/server/services/config-service.ts`

**Functions:**
```typescript
// Create config with audit fields
createConfigWithAudit(data, userId)

// Update config with audit fields
updateConfigWithAudit(configId, teamId, userId, updates)

// OAuth-specific: create or update based on existence
upsertOAuthConfig(teamId, slackTeamId, oauthData)
```

**Benefits:**
- Single source of truth for config operations
- Encapsulates audit field logic
- Easy to add notifications, validation, etc. later

### Step 2: Update OAuth Callback
**File:** `/layers/discubot/server/api/oauth/slack/callback.get.ts`

**Changes:**
- Import `upsertOAuthConfig` from service
- Replace direct DB calls (lines 162-243)
- Simplify to single service call

**Before (65 lines):**
```typescript
try {
  const { createDiscubotConfig } = await import(...)
  const { updateDiscubotConfig } = await import(...)

  // Check if config exists
  const existingConfigs = await db.select()...
  const existingConfig = existingConfigs.find(...)

  if (existingConfig) {
    // Update logic (15 lines)
  } else {
    // Create logic (20 lines)
  }
} catch (error) {
  // Error handling
}
```

**After (8 lines):**
```typescript
try {
  await upsertOAuthConfig(teamId, slackTeamId, {
    accessToken: tokenData.access_token,
    teamName: tokenData.team?.name,
    botUserId: tokenData.bot_user_id,
    scopes: tokenData.scope,
  })
} catch (error) {
  console.error('[OAuth] Failed to save config:', error)
}
```

### Step 3: (Optional) Update API Endpoints
**Files:**
- `/layers/discubot/collections/configs/server/api/index.post.ts`
- `/layers/discubot/collections/configs/server/api/[configId].patch.ts`

**Changes:**
- Import service functions
- Replace direct `createDiscubotConfig`/`updateDiscubotConfig` calls
- Ensures all code paths use same service

**This is optional but recommended for consistency**

### Step 4: Testing
1. Run `npx nuxt typecheck`
2. Test locally with tunnel (if possible)
3. Deploy to production: `nuxthub deploy`
4. Test OAuth flow end-to-end
5. Verify database has proper audit fields

---

## Expected Outcomes

### Immediate Fixes
- ✅ OAuth callback succeeds in production
- ✅ Configs created with `createdBy: SYSTEM_USER_ID`
- ✅ Configs updated with `updatedBy: SYSTEM_USER_ID`
- ✅ No more 500 errors

### Architectural Improvements
- ✅ Clear separation: transport vs. business logic
- ✅ Consistent audit field handling
- ✅ Easier to test (service can be tested in isolation)
- ✅ Future-proof (easy to add features)

### Code Quality
- ✅ OAuth callback simplified (65 lines → 8 lines)
- ✅ Business logic centralized
- ✅ Less duplication

---

## Estimated Effort

| Task | Time | Risk |
|------|------|------|
| Create service file | 10 min | Low |
| Update OAuth callback | 5 min | Low |
| Run typecheck | 1 min | Low |
| Deploy to production | 3 min | Low |
| Test OAuth flow | 5 min | Low |
| (Optional) Update API endpoints | 15 min | Low |
| **Total (required)** | **~25 min** | **Low** |
| **Total (with optional)** | **~40 min** | **Low** |

---

## Success Criteria

1. ✅ OAuth callback completes without 500 error
2. ✅ Config is created in database with all required fields
3. ✅ User redirected to success page
4. ✅ Database shows `createdBy: 'system'` and `updatedBy: 'system'`
5. ✅ No TypeScript errors
6. ✅ No breaking changes to existing functionality

---

## Future Enhancements

Once the service layer is in place, it becomes easy to add:
- Email notifications when configs are created
- Slack notifications to workspace when OAuth completes
- Config validation business rules
- Audit logging for compliance
- Rate limiting for config operations
- Webhook triggers for external integrations

---

## References

### Files Involved
- `/layers/discubot/server/api/oauth/slack/callback.get.ts` - OAuth callback (needs update)
- `/layers/discubot/collections/configs/server/database/queries.ts` - Database layer (unchanged)
- `/layers/discubot/collections/configs/server/database/schema.ts` - Schema definition
- `/layers/discubot/collections/configs/server/api/index.post.ts` - Create endpoint (optional update)
- `/layers/discubot/collections/configs/server/api/[configId].patch.ts` - Update endpoint (optional update)

### Related Commits
- `7f08e65` - Added `createdBy` and `updatedBy` fields to schema
- `b17c396` - OAuth UI integration (Phase 13)

### Documentation
- `/docs/setup/tunnel-development.md` - Local OAuth testing setup
- `/CLAUDE.md` - Project coding standards and patterns

---

## Approval & Next Steps

**Recommendation:** Proceed with service layer implementation (Option C)

**Next Actions:**
1. Review and approve this briefing
2. Add implementation tasks to PROGRESS_TRACKER.md (Phase 14)
3. Create `/layers/discubot/server/services/config-service.ts`
4. Update OAuth callback to use service
5. Test and deploy

---

**Questions or Concerns?**
Discuss with team before proceeding with implementation.

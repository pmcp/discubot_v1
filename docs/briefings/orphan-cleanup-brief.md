# Orphan Cleanup & Cascade Deletion Briefing

**Date:** 2025-11-26
**Status:** ✅ Implemented
**Priority:** Medium
**Implemented:** 2025-11-26

## Problem Statement

When a flow is deleted, its associated inputs and outputs remain in the database as orphaned records. These orphans cause processing failures when the system tries to route incoming webhooks.

### Incident Details

**Symptoms:**
```
No flow found, falling back to legacy config
Flow not found or inactive for input pVAqwvdGh03JoBnJzgqcR
No active config found for team T06SZE1U91Q and source slack
```

**Root Cause:**
1. User deleted flow `QbvTCFC9SyoGcJ6MSde2S`
2. Input `pVAqwvdGh03JoBnJzgqcR` still referenced that flow
3. User created new flow `Gf29jI5nhsOHvaZvvNvnV` and added same Slack workspace
4. Two inputs now existed for same `slackTeamId`
5. Processor found orphaned input first (by insertion order), failed to load its flow

**Manual Fix Applied:**
```sql
DELETE FROM discubot_flowinputs WHERE id = 'pVAqwvdGh03JoBnJzgqcR';
```

## Current Data Model

```
┌─────────────────┐
│  discubot_flows │
│─────────────────│
│  id (PK)        │
│  teamId         │
│  active         │
│  ...            │
└────────┬────────┘
         │
         │ flowId (FK - not enforced)
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼────┐
│inputs │ │outputs │
└───────┘ └────────┘
```

**Problem:** No foreign key constraints or cascade deletion in D1/SQLite schema.

## Proposed Solutions

### Option A: Application-Level Cascade (Recommended)

Add cascade deletion logic to the `deleteDiscubotFlow` function.

**Implementation:**

```typescript
// layers/discubot/collections/flows/server/database/queries.ts

export async function deleteDiscubotFlow(
  recordId: string,
  teamId: string,
  _userId?: string
) {
  const db = useDB()

  // Delete associated inputs first
  await db
    .delete(tables.discubotFlowinputs)
    .where(eq(tables.discubotFlowinputs.flowId, recordId))

  // Delete associated outputs
  await db
    .delete(tables.discubotFlowoutputs)
    .where(eq(tables.discubotFlowoutputs.flowId, recordId))

  // Then delete the flow
  const [deleted] = await db
    .delete(tables.discubotFlows)
    .where(
      and(
        eq(tables.discubotFlows.id, recordId),
        eq(tables.discubotFlows.teamId, teamId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscubotFlow not found or unauthorized'
    })
  }

  return { success: true, deletedInputs: true, deletedOutputs: true }
}
```

**Pros:**
- Simple to implement
- Works with current D1 setup
- No schema changes needed

**Cons:**
- Not atomic (could leave partial state on error)
- Logic scattered in application code

### Option B: Database-Level Constraints

Add foreign key constraints with CASCADE to schema.

**Implementation:**

```typescript
// In schema.ts
export const discubotFlowinputs = sqliteTable('discubot_flowinputs', {
  // ...
  flowId: text('flowId')
    .notNull()
    .references(() => discubotFlows.id, { onDelete: 'cascade' }),
})

export const discubotFlowoutputs = sqliteTable('discubot_flowoutputs', {
  // ...
  flowId: text('flowId')
    .notNull()
    .references(() => discubotFlows.id, { onDelete: 'cascade' }),
})
```

**Pros:**
- Atomic operations
- Database enforces integrity
- Cleaner application code

**Cons:**
- Requires schema migration
- D1 foreign key support may have limitations
- Need to verify Drizzle ORM handles this correctly

### Option C: Defensive Processing (Complementary)

Make processor resilient to orphaned inputs.

**Implementation:**

```typescript
// In processor.ts loadFlow()

// Find matching input AND verify flow exists
let matchedInput: any
let matchedFlow: any

for (const input of inputs) {
  if (input.sourceMetadata?.slackTeamId === identifier) {
    // Verify flow exists before using this input
    const [flow] = await db
      .select()
      .from(discubotFlows)
      .where(and(
        eq(discubotFlows.id, input.flowId),
        eq(discubotFlows.active, true),
      ))
      .limit(1)

    if (flow) {
      matchedInput = input
      matchedFlow = flow
      break
    }
    // Skip orphaned inputs silently
    logger.warn('Skipping orphaned input', { inputId: input.id, flowId: input.flowId })
  }
}
```

**Pros:**
- Graceful degradation
- Handles existing orphans
- No schema changes

**Cons:**
- Doesn't fix root cause
- Extra queries per request
- Orphans accumulate in database

### Option D: Scheduled Cleanup Job

Add a periodic job to clean up orphaned records.

**Implementation:**

```typescript
// server/tasks/cleanup-orphans.ts
export default defineTask({
  meta: { name: 'cleanup-orphans' },
  async run() {
    const db = useDB()

    // Find inputs with non-existent flows
    const orphanedInputs = await db.run(sql`
      DELETE FROM discubot_flowinputs
      WHERE flowId NOT IN (SELECT id FROM discubot_flows)
    `)

    // Find outputs with non-existent flows
    const orphanedOutputs = await db.run(sql`
      DELETE FROM discubot_flowoutputs
      WHERE flowId NOT IN (SELECT id FROM discubot_flows)
    `)

    return {
      deletedInputs: orphanedInputs.changes,
      deletedOutputs: orphanedOutputs.changes
    }
  }
})
```

**Pros:**
- Catches all orphans
- Non-blocking
- Can run during low traffic

**Cons:**
- Delayed cleanup
- Orphans exist until next run
- Additional infrastructure

## Recommendation

**Implement Option A + Option C:**

1. **Option A (Cascade):** Prevent future orphans by deleting inputs/outputs when flow is deleted
2. **Option C (Defensive):** Make processor skip orphaned inputs gracefully

This combination:
- Fixes the root cause (no new orphans)
- Handles existing orphans without migration
- Provides graceful degradation
- Minimal implementation effort

## Implementation Plan

### Phase 1: Immediate Fix (30 min)
- [ ] Update `deleteDiscubotFlow` to cascade delete inputs/outputs
- [ ] Add logging for cascade deletions

### Phase 2: Defensive Processing (30 min)
- [ ] Update `loadFlow()` to skip orphaned inputs
- [ ] Add warning logs for orphaned inputs detected

### Phase 3: One-time Cleanup (15 min)
- [ ] Run SQL to delete existing orphans
- [ ] Verify no orphans remain

## Files to Modify

1. `layers/discubot/collections/flows/server/database/queries.ts`
   - Update `deleteDiscubotFlow` with cascade logic

2. `layers/discubot/server/services/processor.ts`
   - Update `loadFlow()` to handle orphans gracefully

## Testing

```bash
# Test cascade deletion
1. Create a flow with inputs and outputs
2. Delete the flow via API
3. Verify inputs and outputs are also deleted

# Test orphan handling
1. Manually insert an orphaned input (flowId points to non-existent flow)
2. Trigger webhook for that input's source
3. Verify processor skips orphan and finds valid input
```

## Implementation Notes (2025-11-26)

**Implemented: Option A (Cascade Deletion) + Option C (Defensive Processing)**

### Changes Made:

1. **`layers/discubot/collections/flows/server/database/queries.ts`**:
   - Updated `deleteDiscubotFlow()` to cascade delete inputs/outputs before deleting the flow
   - Added logging for cascade deletions
   - Returns count of deleted inputs/outputs for visibility

2. **`layers/discubot/server/services/processor.ts`**:
   - Updated `loadFlow()` to verify flow exists before using an input
   - Iterates through candidate inputs and skips orphaned ones with warning logs
   - Finds first valid input with an existing active flow

### Testing:
- Run typecheck: Pre-existing errors only, no new errors introduced
- Manual testing: Delete a flow and verify inputs/outputs are cascade deleted
- Defensive processing: Create an orphaned input and verify processor skips it gracefully

---

## Related Issues

- Flow deletion not cleaning up children ✅ FIXED
- Duplicate inputs for same source allowed
- No unique constraint on `(flowId, slackTeamId)` for inputs

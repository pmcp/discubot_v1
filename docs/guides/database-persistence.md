# Database Persistence & Job Tracking Guide

## Overview

Phase 6 implements comprehensive database persistence using **nuxt-crouton's generated queries**. All database operations leverage Crouton's type-safe, auto-generated query functions - no custom operations needed.

## System User Convention

### The SYSTEM_USER_ID Constant

For automated operations (webhooks, background jobs), we use a system user constant:

```typescript
// layers/discubot/server/utils/constants.ts
export const SYSTEM_USER_ID = 'system'
```

### When to Use SYSTEM_USER_ID

Use `SYSTEM_USER_ID` for the `createdBy` and `updatedBy` fields when:

1. **Processing webhooks** - Discussions created from Figma/Slack events
2. **Creating jobs** - Background sync operations
3. **Saving task records** - Automated task creation from AI analysis
4. **Automated retries** - System-initiated retry operations

### Example Usage

```typescript
import { SYSTEM_USER_ID } from '../utils/constants'
import { createDiscubotDiscussion } from '#layers/discubot/collections/discussions/server/database/queries'

// Creating a discussion from webhook
const discussion = await createDiscubotDiscussion(db, {
  sourceType: 'figma',
  sourceThreadId: 'thread-123',
  title: 'Discussion Title',
  content: 'Discussion content',
  teamId: 'team-123',
  status: 'processing',
  createdBy: SYSTEM_USER_ID,  // ← System user for automated operation
  updatedBy: SYSTEM_USER_ID,
})
```

## Using Crouton Queries

### Import Patterns

**ALWAYS import from Crouton-generated locations:**

```typescript
// Discussions
import {
  createDiscubotDiscussion,
  updateDiscubotDiscussion,
  getDiscubotDiscussionsByIds,
} from '#layers/discubot/collections/discussions/server/database/queries'

// Jobs
import {
  createDiscubotJob,
  updateDiscubotJob,
  getDiscubotJobsByIds,
} from '#layers/discubot/collections/jobs/server/database/queries'

// Tasks
import {
  createDiscubotTask,
  getDiscubotTasksByIds,
} from '#layers/discubot/collections/tasks/server/database/queries'
```

### Crouton Query Examples

#### Creating Records

```typescript
// Create discussion
const discussion = await createDiscubotDiscussion(db, {
  sourceType: 'slack',
  sourceThreadId: 'C123:1234567890.123456',
  title: 'Discuss feature implementation',
  content: 'Initial message content',
  teamId: 'team-123',
  status: 'processing',
  createdBy: SYSTEM_USER_ID,
  updatedBy: SYSTEM_USER_ID,
})

// Create job
const job = await createDiscubotJob(db, {
  teamId: 'team-123',
  sourceType: 'figma',
  status: 'pending',
  stage: 'ingestion',
  createdBy: SYSTEM_USER_ID,
  updatedBy: SYSTEM_USER_ID,
})

// Create task
const task = await createDiscubotTask(db, {
  discussionId: 'disc-123',
  jobId: 'job-123',
  notionPageId: 'notion-page-123',
  notionPageUrl: 'https://notion.so/page-123',
  title: 'Implement new feature',
  teamId: 'team-123',
  createdBy: SYSTEM_USER_ID,
  updatedBy: SYSTEM_USER_ID,
})
```

#### Updating Records

```typescript
// Partial updates (only update what's needed)
await updateDiscubotDiscussion(db, teamId, discussionId, {
  status: 'completed',
  notionTaskIds: ['task-1', 'task-2'],
  completedAt: new Date(),
  updatedBy: SYSTEM_USER_ID,
})

await updateDiscubotJob(db, teamId, jobId, {
  status: 'completed',
  stage: 'notification',
  completedAt: new Date(),
  metadata: {
    processingTime: 1234,
    taskIds: ['task-1'],
  },
  updatedBy: SYSTEM_USER_ID,
})
```

#### Reading Records

```typescript
// Get by IDs
const discussions = await getDiscubotDiscussionsByIds(teamId, [discussionId])
const jobs = await getDiscubotJobsByIds(teamId, [jobId])

// Using Crouton composables in Vue components
const { data: discussions } = useCollectionQuery('discubotDiscussions')
const { data: jobs } = useCollectionQuery('discubotJobs', {
  where: { status: 'failed' }
})
```

## Job Lifecycle Flow

### 6-Stage Processing Pipeline

Every discussion goes through 6 stages with job status updates:

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Validation (ingestion)                            │
│ - Validate discussion data                                 │
│ - Create job record (status='processing')                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Config Loading                                    │
│ - Load source config                                       │
│ - Save discussion to database                              │
│ - Link discussion.syncJobId to job                         │
│ - Update job with discussionId & sourceConfigId            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: Thread Building (thread_building)                │
│ - Fetch full thread from source API                        │
│ - Update job stage                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 4: AI Analysis (ai_analysis)                         │
│ - Generate summary and action items                        │
│ - Detect tasks                                             │
│ - Update job stage                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 5: Task Creation (task_creation)                     │
│ - Create tasks in Notion                                   │
│ - Save task records to database                            │
│ - Update discussion.notionTaskIds                          │
│ - Update job stage                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 6: Finalization (notification)                       │
│ - Post notification to source                              │
│ - Update discussion status='completed'                     │
│ - Finalize job: status='completed', completedAt, metadata  │
└─────────────────────────────────────────────────────────────┘
```

### Job Creation (Before Processing)

Create job record **before** starting processing:

```typescript
// In processor.ts - Before Stage 1
const job = await createDiscubotJob(db, {
  teamId: parsed.teamId,
  sourceType: parsed.sourceType,
  status: 'pending',
  stage: 'ingestion',
  metadata: {
    startTimestamp: Date.now(),
  },
  createdBy: SYSTEM_USER_ID,
  updatedBy: SYSTEM_USER_ID,
})

const jobId = job?.id
```

### Job Updates Throughout Pipeline

Use helper function for consistent updates:

```typescript
async function updateJobStatus(
  jobId: string | undefined,
  teamId: string,
  updates: Partial<NewDiscubotJob>
) {
  if (!jobId) {
    console.warn('[Processor] Cannot update job: jobId is undefined')
    return
  }

  try {
    await updateDiscubotJob(db, teamId, jobId, {
      ...updates,
      updatedBy: SYSTEM_USER_ID,
    })
    console.log(`[Processor] Job updated:`, { jobId, ...updates })
  } catch (error) {
    console.error('[Processor] Failed to update job:', error)
  }
}
```

**Update job at each stage:**

```typescript
// Stage 1: Validation
await updateJobStatus(jobId, parsed.teamId, {
  status: 'processing',
  stage: 'ingestion',
})

// Stage 3: Thread Building
await updateJobStatus(jobId, parsed.teamId, {
  stage: 'thread_building',
})

// Stage 4: AI Analysis
await updateJobStatus(jobId, parsed.teamId, {
  stage: 'ai_analysis',
})

// Stage 5: Task Creation
await updateJobStatus(jobId, parsed.teamId, {
  stage: 'task_creation',
})

// Stage 6: Finalization
await updateJobStatus(jobId, parsed.teamId, {
  stage: 'notification',
})
```

### Job Finalization

#### Success

```typescript
// Update job with completion metadata
await updateJobStatus(jobId, parsed.teamId, {
  status: 'completed',
  completedAt: new Date(),
  metadata: {
    processingTime: Date.now() - job.metadata.startTimestamp,
    taskIds: createdTasks.map(t => t.id),
  },
})
```

#### Failure

```typescript
// In catch block
await updateJobStatus(jobId, parsed.teamId, {
  status: 'failed',
  completedAt: new Date(),
  error: error.message,
  errorStack: error.stack,
  metadata: {
    processingTime: Date.now() - job.metadata.startTimestamp,
  },
})
```

## Discussion Persistence

### Saving Initial Discussion

```typescript
// Stage 2: After config loading
const discussion = await createDiscubotDiscussion(db, {
  sourceType: parsed.sourceType,
  sourceThreadId: parsed.sourceThreadId,
  sourceUrl: parsed.sourceUrl,
  title: parsed.title,
  content: parsed.content,
  authorHandle: parsed.authorHandle,
  teamId: parsed.teamId,
  status: 'processing',
  sourceConfigId: config.id,
  syncJobId: jobId,  // Link to current job
  createdBy: SYSTEM_USER_ID,
  updatedBy: SYSTEM_USER_ID,
})

if (!discussion) {
  throw new Error('Failed to create discussion record')
}

const discussionId = discussion.id
```

### Linking Job to Discussion

```typescript
// After creating discussion, link it to the job
await updateJobStatus(jobId, parsed.teamId, {
  discussionId: discussionId,
  sourceConfigId: config.id,
})
```

### Updating Discussion Results

```typescript
// After AI analysis and task creation
await updateDiscubotDiscussion(db, parsed.teamId, discussionId, {
  status: 'completed',
  threadData: thread,  // Full thread for future retries
  aiSummary: analysis.summary,
  aiActionItems: analysis.actionItems,
  notionTaskIds: taskRecords.map(t => t.id),  // Task record IDs
  completedAt: new Date(),
  updatedBy: SYSTEM_USER_ID,
})
```

## Task Record Persistence

### Saving Task Records

After creating tasks in Notion, save task records to database:

```typescript
async function saveTaskRecords(
  notionTasks: NotionTask[],
  aiTasks: DetectedTask[],
  discussionId: string,
  jobId: string,
  parsed: ParsedDiscussion
) {
  const taskRecords = []

  for (let i = 0; i < notionTasks.length; i++) {
    const notionTask = notionTasks[i]
    if (!notionTask) continue

    const aiTask = aiTasks[i]

    const task = await createDiscubotTask(db, {
      discussionId,
      jobId,
      notionPageId: notionTask.id,
      notionPageUrl: notionTask.url,
      title: notionTask.title,
      description: aiTask?.description,
      status: aiTask?.status,
      priority: aiTask?.priority,
      assignee: aiTask?.assignee,
      summary: aiTask?.title,
      sourceUrl: parsed.sourceUrl,
      isMultiTaskChild: notionTasks.length > 1,
      taskIndex: notionTasks.length > 1 ? i : undefined,
      teamId: parsed.teamId,
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    })

    if (task) {
      taskRecords.push(task)
    }
  }

  // Update discussion with task record IDs
  if (taskRecords.length > 0) {
    await updateDiscubotDiscussion(db, parsed.teamId, discussionId, {
      notionTaskIds: taskRecords.map(t => t.id),
      updatedBy: SYSTEM_USER_ID,
    })
  }

  return taskRecords
}
```

## Retry Strategy

### Creating New Job for Retry

When retrying a failed discussion, **create a NEW job record** (don't increment attempts):

```typescript
// In retry endpoint: /api/discussions/[id]/retry.post.ts
export default defineEventHandler(async (event) => {
  const { team, user } = await resolveTeamAndCheckMembership(event)
  const discussionId = getRouterParam(event, 'id')

  // Load failed discussion
  const discussions = await getDiscubotDiscussionsByIds(team.id, [discussionId])
  const discussion = discussions[0]

  if (discussion.status !== 'failed') {
    throw createError({
      statusCode: 422,
      message: 'Discussion is not in failed state',
    })
  }

  // Create NEW job for retry
  const retryJob = await createDiscubotJob(db, {
    teamId: team.id,
    sourceType: discussion.sourceType,
    status: 'pending',
    stage: 'ingestion',
    metadata: {
      isRetry: true,
      retriedBy: user.id,
      originalDiscussionId: discussionId,
    },
    createdBy: SYSTEM_USER_ID,
    updatedBy: SYSTEM_USER_ID,
  })

  // Reconstruct ParsedDiscussion from database record
  const parsed: ParsedDiscussion = {
    sourceType: discussion.sourceType,
    sourceThreadId: discussion.sourceThreadId,
    sourceUrl: discussion.sourceUrl,
    teamId: discussion.teamId,
    authorHandle: discussion.authorHandle,
    title: discussion.title,
    content: discussion.content,
    timestamp: discussion.createdAt,
  }

  // Process with thread data from database (avoid re-fetching)
  const result = await processDiscussion(
    parsed,
    undefined,  // config (will be loaded)
    discussion.threadData,  // reuse thread data
  )

  return result
})
```

### Why New Jobs for Retries?

- **Clean history** - Each retry is a separate job with its own status
- **Audit trail** - Can see how many retries occurred
- **Debugging** - Each job has its own error logs
- **Simplicity** - No complex attempt counter logic

## Job Cleanup

### Automated Cleanup Plugin

Delete old completed/failed jobs after 30 days:

```typescript
// server/plugins/jobCleanup.ts
import { eq, and, lt, or } from 'drizzle-orm'
import { discubotJobs } from '#layers/discubot/collections/jobs/server/database/schema'

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const RETENTION_DAYS = 30

export default defineNitroPlugin(() => {
  // Run cleanup on startup
  cleanupOldJobs()

  // Schedule periodic cleanup
  setInterval(() => {
    cleanupOldJobs()
  }, CLEANUP_INTERVAL_MS)

  console.log(`[Job Cleanup] Scheduler initialized`)
})

async function cleanupOldJobs() {
  try {
    const db = useDB()
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const result = await db
      .delete(discubotJobs)
      .where(
        and(
          or(
            eq(discubotJobs.status, 'completed'),
            eq(discubotJobs.status, 'failed')
          ),
          lt(discubotJobs.completedAt, cutoffDate)
        )
      )
      .returning({ id: discubotJobs.id })

    console.log(`[Job Cleanup] Successfully deleted ${result.length} old job(s)`)
  } catch (error) {
    console.error('[Job Cleanup] Error during cleanup:', error)
  }
}
```

## Admin UI Integration

### Using Crouton Composables

```vue
<script setup lang="ts">
// Load jobs from database
const { data: jobs, refresh } = useCollectionQuery('discubotJobs', {
  where: { status: 'failed' }  // Filter by status
})

// Mutation for retry
const { execute: retryJob } = useCollectionMutation()

async function handleRetry(job) {
  const result = await $fetch(`/api/discussions/${job.discussionId}/retry`, {
    method: 'POST'
  })

  // Refresh jobs list to show new job record
  await refresh()

  toast.add({
    title: 'Job retried successfully',
    color: 'success'
  })
}
</script>

<template>
  <div v-for="job in jobs" :key="job.id">
    <div>{{ job.status }} - {{ job.stage }}</div>
    <UButton
      v-if="job.status === 'failed' && job.discussionId"
      @click="handleRetry(job)"
    >
      Retry Job
    </UButton>
  </div>
</template>
```

## Testing Database Operations

### Mocking Crouton Queries in Tests

```typescript
// tests/integration/figma-flow.test.ts
const mockCreateDiscussion = vi.fn()
const mockUpdateDiscussion = vi.fn()
const mockCreateJob = vi.fn()
const mockUpdateJob = vi.fn()
const mockCreateTask = vi.fn()

// Mock Crouton database queries
vi.mock('#layers/discubot/collections/discussions/server/database/queries', () => ({
  createDiscubotDiscussion: mockCreateDiscussion,
  updateDiscubotDiscussion: mockUpdateDiscussion,
  getDiscubotDiscussionsByIds: vi.fn(),
}))

vi.mock('#layers/discubot/collections/jobs/server/database/queries', () => ({
  createDiscubotJob: mockCreateJob,
  updateDiscubotJob: mockUpdateJob,
  getDiscubotJobsByIds: vi.fn(),
}))

vi.mock('#layers/discubot/collections/tasks/server/database/queries', () => ({
  createDiscubotTask: mockCreateTask,
  getDiscubotTasksByIds: vi.fn(),
}))

// Set up mock responses
beforeEach(() => {
  mockCreateDiscussion.mockResolvedValue({
    id: 'discussion_123',
    sourceType: 'figma',
    teamId: 'team-123',
    status: 'processing',
  })

  mockUpdateDiscussion.mockResolvedValue(undefined)

  mockCreateJob.mockResolvedValue({
    id: 'job_123',
    teamId: 'team-123',
    status: 'pending',
    stage: 'ingestion',
  })

  // ... other mocks
})
```

## Best Practices

### ✅ DO

- **Use Crouton queries exclusively** - Import from `#layers/discubot/collections/*/server/database/queries`
- **Use SYSTEM_USER_ID for automated operations** - Consistent ownership tracking
- **Create job BEFORE processing** - Track full lifecycle
- **Update job at each stage** - Provides visibility into progress
- **Save task records after Notion creation** - Ensures notionPageId/URL are available
- **Create new jobs for retries** - Clean audit trail
- **Use best-effort updates** - Log errors but don't block processing

### ❌ DON'T

- **Don't create custom database operations** - Use Crouton queries
- **Don't use real user IDs for webhooks** - Use SYSTEM_USER_ID
- **Don't increment attempt counters** - Create new jobs for retries
- **Don't fail processing on job update errors** - Log and continue
- **Don't forget to link entities** - Link discussion.syncJobId, job.discussionId, etc.

## Troubleshooting

### Job Not Updating

**Problem**: Job status not updating during processing

**Solution**: Check that jobId is defined and teamId is correct:

```typescript
if (!jobId) {
  console.warn('[Processor] Cannot update job: jobId is undefined')
  return
}
```

### Task Records Not Saved

**Problem**: discussion.notionTaskIds is empty

**Solution**: Ensure saveTaskRecords() is called after Notion task creation:

```typescript
// After creating Notion tasks
const taskRecords = await saveTaskRecords(
  notionTasks,
  analysis.detectedTasks,
  discussionId,
  jobId,
  parsed
)
```

### Retry Fails Immediately

**Problem**: Retry endpoint returns 422 "not in failed state"

**Solution**: Check discussion status in database:

```typescript
const discussion = discussions[0]
console.log('Discussion status:', discussion.status)

if (discussion.status !== 'failed') {
  throw createError({
    statusCode: 422,
    message: 'Discussion is not in failed state',
  })
}
```

### Module Resolution in Tests

**Problem**: Tests fail with `Cannot find module '#layers/...'`

**Solution**: Mock Crouton queries in test setup:

```typescript
vi.mock('#layers/discubot/collections/discussions/server/database/queries', () => ({
  createDiscubotDiscussion: vi.fn(),
  updateDiscubotDiscussion: vi.fn(),
}))
```

## Summary

Phase 6 Database Persistence:

- ✅ **System User Convention** - Use SYSTEM_USER_ID for automated operations
- ✅ **Crouton Queries** - All DB operations use nuxt-crouton's generated queries
- ✅ **Job Lifecycle** - 6-stage pipeline with status tracking
- ✅ **Discussion Persistence** - Save discussions with full context for retries
- ✅ **Task Records** - Link Notion tasks to discussion records
- ✅ **Retry Strategy** - Create new jobs for each retry attempt
- ✅ **Job Cleanup** - Automated 30-day retention cleanup
- ✅ **Admin UI Integration** - Real-time job monitoring and retry functionality

**Next Steps**: Phase 7 - Production readiness (security, testing, monitoring, deployment)

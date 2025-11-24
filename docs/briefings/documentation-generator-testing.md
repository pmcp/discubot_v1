# Documentation Generator - Testing Guide

This guide covers testing strategies for the documentation generator feature across all phases.

---

## Testing Philosophy

**Test incrementally:**
- Unit test each service
- Integration test the pipeline
- E2E test the full flow
- Manual test for quality

**Don't over-test:**
- Skateboard: Manual testing is sufficient
- Scooter: Add basic unit tests
- Bike: Add integration tests
- Car: Full test coverage

---

## Skateboard Phase Testing

### Manual Testing Checklist

**Setup:**
- [ ] Create test Notion database
- [ ] Create test config in database
- [ ] Add test API keys (Notion, Anthropic)

**Test Cases:**

**1. Happy Path:**
```
Given: A Notion task with content
When: Status changes to "Done"
Then:
  - Webhook received ✓
  - Job created ✓
  - Status: pending → analyzing → completed ✓
  - Documentation appended to page ✓
  - Markers present (START/END) ✓
```

**2. Empty Task:**
```
Given: A Notion task with no content
When: Status changes to "Done"
Then: Documentation still generated (generic summary)
```

**3. Long Content:**
```
Given: A task with 5000+ words of content
When: Documentation generated
Then: No errors, content properly chunked in Notion
```

**4. API Errors:**
```
Given: Invalid Notion token
When: Processing job
Then:
  - Job status → failed ✓
  - Error message recorded ✓
  - No partial updates ✓
```

**5. Retry Logic:**
```
Given: Transient API error (timeout)
When: Processing job
Then: Retries automatically, eventually succeeds
```

### Test Commands

```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/api/webhooks/notion-documentation \
  -H "Content-Type: application/json" \
  -d @test/fixtures/notion-webhook-done.json

# Check job status
sqlite3 .data/hub/db/default/db.sqlite \
  "SELECT id, status, error_message FROM documentation_jobs ORDER BY created_at DESC LIMIT 1;"

# View generated documentation
# Open Notion page and verify content
```

### Quality Checks

**Documentation should:**
- [ ] Be well-formatted markdown
- [ ] Have clear sections (Overview, Implementation, etc.)
- [ ] Be 200-500 words (not too short, not too long)
- [ ] Use technical language appropriate for developers
- [ ] Focus on "what" and "why", not just "how"

---

## Scooter Phase Testing

### Unit Tests

**Test: Link Extraction**
```typescript
// layers/documentation/server/utils/linkExtractor.test.ts
import { describe, it, expect } from 'vitest'
import { extractLinks } from './linkExtractor'

describe('linkExtractor', () => {
  it('extracts markdown links', () => {
    const markdown = 'Check [this doc](https://notion.so/page123) for details'
    const links = extractLinks(markdown)

    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('https://notion.so/page123')
    expect(links[0].type).toBe('notion')
  })

  it('extracts plain URLs', () => {
    const markdown = 'See https://github.com/user/repo/commit/abc123'
    const links = extractLinks(markdown)

    expect(links).toHaveLength(1)
    expect(links[0].type).toBe('github')
  })

  it('categorizes link types correctly', () => {
    const markdown = `
      Notion: https://notion.so/page
      GitHub: https://github.com/user/repo
      Web: https://example.com/article
    `
    const links = extractLinks(markdown)

    expect(links).toHaveLength(3)
    expect(links.find(l => l.type === 'notion')).toBeDefined()
    expect(links.find(l => l.type === 'github')).toBeDefined()
    expect(links.find(l => l.type === 'web')).toBeDefined()
  })
})
```

**Test: Content Readers**
```typescript
// layers/documentation/server/adapters/contentReaders/githubReader.test.ts
import { describe, it, expect, vi } from 'vitest'
import { readGitHubContent } from './githubReader'

describe('githubReader', () => {
  it('reads commit information', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        sha: 'abc123',
        commit: {
          message: 'Fix bug',
          author: { name: 'John', date: '2025-01-01' }
        },
        files: [{ filename: 'file.ts' }],
        stats: { additions: 10, deletions: 5 }
      })
    })

    const result = await readGitHubContent(
      'https://github.com/user/repo/commit/abc123'
    )

    expect(result.title).toContain('Fix bug')
    expect(result.summary).toContain('abc123')
    expect(result.summary).toContain('Files changed: 1')
  })

  it('handles invalid URLs gracefully', async () => {
    const result = await readGitHubContent('https://github.com/invalid')

    expect(result.title).toBe('GitHub Error')
    expect(result.summary).toContain('Failed to fetch')
  })
})
```

### Integration Tests

**Test: Full Crawling Pipeline**
```typescript
// layers/documentation/server/services/linkCrawler.test.ts
import { describe, it, expect } from 'vitest'
import { crawlLinks } from './linkCrawler'

describe('linkCrawler', () => {
  it('crawls multiple link types', async () => {
    const markdown = `
      See [design doc](https://notion.so/test-page)
      And [commit](https://github.com/user/repo/commit/abc)
      And [article](https://example.com/post)
    `

    const result = await crawlLinks(markdown, 1, {
      notionToken: process.env.TEST_NOTION_TOKEN,
      githubToken: process.env.TEST_GITHUB_TOKEN
    })

    expect(result.links.length).toBeGreaterThan(0)
    expect(result.stats.total).toBe(3)
    expect(result.stats.byType).toHaveProperty('notion')
    expect(result.stats.byType).toHaveProperty('github')
    expect(result.stats.byType).toHaveProperty('web')
  })

  it('respects max links limit', async () => {
    // Create markdown with 50 links
    const links = Array.from({ length: 50 }, (_, i) =>
      `[link ${i}](https://example.com/${i})`
    )
    const markdown = links.join('\n')

    const result = await crawlLinks(markdown, 1, {})

    expect(result.links.length).toBeLessThanOrEqual(30) // Max 30 per level
  })

  it('avoids visiting same URL twice', async () => {
    const markdown = `
      [link 1](https://example.com/same)
      [link 2](https://example.com/same)
    `

    const result = await crawlLinks(markdown, 1, {})

    expect(result.links.length).toBe(1)
  })
})
```

### Manual Testing Checklist

**Test with different link types:**
- [ ] Task with only Notion links → All fetched correctly
- [ ] Task with only GitHub links → Commit/PR/issue info extracted
- [ ] Task with only web links → Article content extracted
- [ ] Task with mixed links → All types handled
- [ ] Task with 50+ links → Only first 30 processed

**Test documentation quality:**
- [ ] Context significantly improves documentation
- [ ] Sources cited correctly
- [ ] References section lists all links
- [ ] No duplicate information

**Test error handling:**
- [ ] Invalid Notion link → Skipped gracefully
- [ ] Private GitHub repo → Handled gracefully
- [ ] 404 web page → Skipped gracefully
- [ ] Rate limit hit → Retries with backoff

---

## Bike Phase Testing

### Integration Tests

**Test: Question Detection**
```typescript
// layers/documentation/server/services/documentationGenerator.test.ts
import { describe, it, expect } from 'vitest'
import { generateDocumentation } from './documentationGenerator'

describe('documentationGenerator - question detection', () => {
  it('identifies questions when information is missing', async () => {
    const taskContent = {
      title: 'Implement caching',
      markdown: 'Added caching to API endpoints.'
    }

    const result = await generateDocumentation(
      taskContent,
      [],
      process.env.TEST_ANTHROPIC_KEY!,
      { detectQuestions: true }
    )

    expect(result.questions.length).toBeGreaterThan(0)
    expect(result.questions).toContainEqual(
      expect.stringContaining('cache')
    )
  })

  it('generates no questions when info is complete', async () => {
    const taskContent = {
      title: 'Implement caching',
      markdown: `
        Added Redis caching to all API endpoints.
        Cache TTL: 5 minutes
        Invalidation: On data updates
        Keys: Namespace-prefixed (api:endpoint:params)
      `
    }

    const result = await generateDocumentation(
      taskContent,
      [],
      process.env.TEST_ANTHROPIC_KEY!,
      { detectQuestions: true }
    )

    expect(result.questions.length).toBe(0)
  })
})
```

**Test: Slack Q&A Flow**
```typescript
// layers/documentation/server/services/questionHandler.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleSlackReply } from './questionHandler'

describe('questionHandler', () => {
  it('parses numbered answers', async () => {
    const mockEvent = {
      text: `@discubot
        1. We use Redis for caching
        2. TTL is 5 minutes
        3. Invalidation happens on updates`,
      thread_ts: '1234567890.123456'
    }

    const result = await handleSlackReply(mockEvent, mockConfig)

    expect(result.answers).toHaveLength(3)
    expect(result.answers[0]).toContain('Redis')
  })

  it('parses natural language answers', async () => {
    const mockEvent = {
      text: `@discubot The caching uses Redis with a 5 minute TTL.
             Invalidation happens automatically on data updates.`,
      thread_ts: '1234567890.123456'
    }

    const result = await handleSlackReply(mockEvent, mockConfig)

    expect(result.answers.length).toBeGreaterThan(0)
  })

  it('handles "skip" responses', async () => {
    const mockEvent = {
      text: '@discubot skip question 2',
      thread_ts: '1234567890.123456'
    }

    const result = await handleSlackReply(mockEvent, mockConfig)

    expect(result.answers.some(a => a.status === 'skipped')).toBe(true)
  })
})
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/documentation-qa.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Documentation Q&A Flow', () => {
  test('posts questions to Slack when generated', async ({ page }) => {
    // 1. Setup: Create job with incomplete task
    const jobId = await createTestJob({
      taskContent: 'Implemented feature X'
    })

    // 2. Process job
    await processDocumentationJob(jobId)

    // 3. Verify: Questions posted to Slack
    const slackMessages = await getSlackMessages('#documentation')
    expect(slackMessages).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining('Documentation Questions')
      })
    )
  })

  test('updates documentation when user answers', async ({ page }) => {
    // 1. Setup: Job with pending questions
    const job = await createJobWithQuestions()

    // 2. Simulate Slack reply
    await simulateSlackReply(job.slackThreadId, {
      text: '@discubot The implementation uses approach X because Y'
    })

    // 3. Wait for processing
    await page.waitForTimeout(5000)

    // 4. Verify: Documentation updated
    const updatedJob = await getJob(job.id)
    expect(updatedJob.status).toBe('completed')
    expect(updatedJob.finalDocumentation).toContain('approach X')
  })

  test('times out after 48 hours', async ({ page }) => {
    // 1. Setup: Job with pending questions (created 49 hours ago)
    const job = await createJobWithQuestions({
      createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000)
    })

    // 2. Run timeout cron
    await fetch('http://localhost:3000/api/cron/documentation-timeout')

    // 3. Verify: Job completed with "Open Questions"
    const updatedJob = await getJob(job.id)
    expect(updatedJob.status).toBe('completed')
    expect(updatedJob.finalDocumentation).toContain('Open Questions')
  })
})
```

### Manual Testing Checklist

**Slack Integration:**
- [ ] Questions posted to #documentation channel
- [ ] User tagged correctly (@username)
- [ ] Message format clear and readable
- [ ] Thread created properly

**Reply Handling:**
- [ ] User reply detected when @discubot mentioned
- [ ] Answers parsed correctly (numbered format)
- [ ] Answers parsed correctly (natural format)
- [ ] "skip" handled gracefully

**Documentation Update:**
- [ ] Final documentation includes answers
- [ ] Quality improved with user input
- [ ] References user's answers

**Timeout:**
- [ ] 24h reminder sent if no response
- [ ] 48h timeout fires correctly
- [ ] Documentation finalized with "Open Questions"
- [ ] Slack notification sent

---

## Car Phase Testing

### Performance Tests

**Test: 2-Level Crawling**
```typescript
// layers/documentation/server/services/linkCrawler.test.ts
describe('linkCrawler - 2 levels', () => {
  it('handles 100+ pages without timeout', async () => {
    const markdown = createMarkdownWith100Links()

    const startTime = Date.now()
    const result = await crawlLinks(markdown, 2, tokens)
    const duration = Date.now() - startTime

    expect(duration).toBeLessThan(120000) // < 2 minutes
    expect(result.links.length).toBeLessThanOrEqual(100)
  })

  it('avoids circular references', async () => {
    // Page A links to B, B links to A
    const result = await crawlLinks(pageA, 2, tokens)

    // Should not loop infinitely
    expect(result.links).toBeDefined()
  })
})
```

**Test: Rate Limiting**
```typescript
// layers/documentation/server/utils/rateLimiter.test.ts
describe('rateLimiter', () => {
  it('limits Notion requests to 3/second', async () => {
    const limiter = createNotionRateLimiter()

    const startTime = Date.now()

    // Make 10 requests
    await Promise.all(
      Array.from({ length: 10 }, () => limiter.execute(() => fetch(...)))
    )

    const duration = Date.now() - startTime

    // Should take at least 3 seconds (10 requests / 3 per second)
    expect(duration).toBeGreaterThan(3000)
  })
})
```

### Load Tests

**Test: Concurrent Jobs**
```bash
# Load test script
# test/load/concurrent-jobs.sh

#!/bin/bash

# Create 50 jobs simultaneously
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/webhooks/notion-documentation \
    -H "Content-Type: application/json" \
    -d "{\"page\": {\"id\": \"test-$i\", \"properties\": {\"Status\": {\"status\": {\"name\": \"Done\"}}}}}" &
done

wait

# Check that all jobs processed successfully
sqlite3 .data/hub/db/default/db.sqlite \
  "SELECT COUNT(*) FROM documentation_jobs WHERE status = 'completed';"
```

Expected: All 50 jobs complete within 10 minutes

### UI Tests

**Test: Config Management**
```typescript
// tests/e2e/admin-ui.spec.ts
test.describe('Documentation Admin UI', () => {
  test('can create new config', async ({ page }) => {
    await page.goto('/dashboard/test-team/documentation')

    await page.click('button:has-text("New Config")')
    await page.fill('input[name="name"]', 'Test Config')
    await page.fill('input[name="notionToken"]', 'secret_xxx')
    // ... fill other fields
    await page.click('button:has-text("Save")')

    await expect(page.locator('text=Test Config')).toBeVisible()
  })

  test('displays webhook URL', async ({ page }) => {
    await page.goto('/dashboard/test-team/documentation')
    await page.click('tr:has-text("Test Config")')

    const webhookUrl = await page.locator('code').textContent()
    expect(webhookUrl).toContain('/api/webhooks/notion-documentation')
  })
})

test.describe('Jobs Dashboard', () => {
  test('lists recent jobs', async ({ page }) => {
    await page.goto('/dashboard/test-team/documentation/jobs')

    const rows = await page.locator('tbody tr').count()
    expect(rows).toBeGreaterThan(0)
  })

  test('filters by status', async ({ page }) => {
    await page.goto('/dashboard/test-team/documentation/jobs')

    await page.selectOption('select[name="status"]', 'completed')
    await page.click('button:has-text("Filter")')

    const statuses = await page.locator('td:nth-child(3)').allTextContents()
    expect(statuses.every(s => s === 'completed')).toBe(true)
  })

  test('shows job details', async ({ page }) => {
    await page.goto('/dashboard/test-team/documentation/jobs')

    await page.click('tr:first-child')

    await expect(page.locator('h1')).toContainText('Job Details')
    await expect(page.locator('text=Task Title')).toBeVisible()
    await expect(page.locator('text=Documentation')).toBeVisible()
  })
})
```

---

## Test Data Setup

### Create Test Fixtures

```typescript
// test/fixtures/notion-webhooks.ts
export const notionWebhookDone = {
  type: 'page.updated',
  page: {
    id: 'test-page-123',
    properties: {
      Title: {
        type: 'title',
        title: [{ plain_text: 'Test Task' }]
      },
      Status: {
        type: 'status',
        status: { name: 'Done' }
      }
    },
    last_edited_by: { id: 'user-123' },
    last_edited_time: '2025-11-24T10:00:00Z'
  }
}

export const notionWebhookInProgress = {
  // ... similar but status = 'In Progress'
}
```

### Mock Data Generators

```typescript
// test/helpers/generators.ts
export function createMockJob(overrides = {}) {
  return {
    id: 'job-' + Math.random(),
    configId: 'config-1',
    notionPageId: 'page-123',
    taskTitle: 'Test Task',
    status: 'pending',
    ...overrides
  }
}

export function createMockConfig(overrides = {}) {
  return {
    id: 'config-1',
    teamId: 'team-1',
    name: 'Test Config',
    notionToken: 'secret_test',
    notionDatabaseId: 'db-123',
    slackToken: 'xoxb-test',
    slackDocChannelId: 'C123456',
    anthropicApiKey: 'sk-test',
    active: true,
    ...overrides
  }
}
```

---

## Running Tests

### Unit Tests
```bash
# Run all unit tests
pnpm test

# Run specific file
pnpm test linkExtractor.test.ts

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

### Integration Tests
```bash
# Requires test database and API keys
pnpm test:integration

# With env vars
TEST_NOTION_TOKEN=xxx TEST_ANTHROPIC_KEY=xxx pnpm test:integration
```

### E2E Tests
```bash
# Start dev server first
pnpm dev

# In another terminal
pnpm test:e2e

# Headed mode (see browser)
pnpm test:e2e --headed
```

### Load Tests
```bash
# Requires local server running
./test/load/concurrent-jobs.sh
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/documentation-tests.yml
name: Documentation Tests

on:
  push:
    branches: [main]
    paths:
      - 'layers/documentation/**'
  pull_request:
    paths:
      - 'layers/documentation/**'

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test

      - name: Run integration tests
        env:
          TEST_NOTION_TOKEN: ${{ secrets.TEST_NOTION_TOKEN }}
          TEST_ANTHROPIC_KEY: ${{ secrets.TEST_ANTHROPIC_KEY }}
        run: pnpm test:integration

      - name: Type check
        run: npx nuxt typecheck
```

---

## Test Coverage Goals

**Skateboard:** 0% (manual testing only)
**Scooter:** 60%+ (unit tests for utilities and adapters)
**Bike:** 70%+ (integration tests for Q&A flow)
**Car:** 80%+ (full coverage including UI)

---

## Debugging Tips

### Enable Debug Logging
```typescript
// Add to services
console.log('DEBUG:', { jobId, status, data })
```

### Inspect Database
```bash
# View recent jobs
sqlite3 .data/hub/db/default/db.sqlite \
  "SELECT id, status, error_message, created_at FROM documentation_jobs ORDER BY created_at DESC LIMIT 10;"

# View job details
sqlite3 .data/hub/db/default/db.sqlite \
  "SELECT * FROM documentation_jobs WHERE id = 'job-xxx';"
```

### Test Webhook Manually
```bash
# Use ngrok to expose local server
ngrok http 3000

# Configure Notion webhook with ngrok URL
# Trigger by changing task status in Notion
# Watch terminal logs
```

### Replay Failed Jobs
```typescript
// In Nuxt DevTools console
await processDocumentationJob('job-xxx')
```

---

## Summary

- **Start simple:** Manual testing for Skateboard
- **Add structure:** Unit tests in Scooter
- **Test integration:** Full pipeline testing in Bike
- **Scale testing:** Load tests and UI tests in Car
- **Continuous:** Run tests in CI/CD

**Remember:** Perfect is the enemy of good. Test enough to be confident, not exhaustive.

# Documentation Generator - Technical Specification

This document provides detailed technical specifications for implementing the documentation generator feature.

---

## Database Schema

### Collection 1: `documentationConfigs`

**Purpose:** Per-team configuration for documentation generation

**Location:** `layers/documentation/collections/documentationConfigs/server/database/schema.ts`

**Schema:**
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

export const documentationConfigs = sqliteTable('documentation_configs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  teamId: text('team_id').notNull(),
  name: text('name').notNull(),

  // Notion Configuration
  notionToken: text('notion_token').notNull(),
  notionDatabaseId: text('notion_database_id').notNull(),

  // Slack Configuration
  slackToken: text('slack_token').notNull(),
  slackDocChannelId: text('slack_doc_channel_id').notNull(), // The #documentation channel

  // Webhook Configuration
  webhookUrl: text('webhook_url').notNull(),  // Auto-generated
  webhookSecret: text('webhook_secret').notNull(),  // For signature verification

  // AI Configuration
  anthropicApiKey: text('anthropic_api_key').notNull(),

  // Settings
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  maxCrawlDepth: integer('max_crawl_depth').notNull().default(1), // 1 or 2
  maxLinksPerJob: integer('max_links_per_job').notNull().default(30),
  questionTimeoutHours: integer('question_timeout_hours').notNull().default(48),

  // Audit
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
})

export type DocumentationConfig = typeof documentationConfigs.$inferSelect
export type NewDocumentationConfig = typeof documentationConfigs.$inferInsert
```

**Indexes:**
```typescript
// Add to schema.ts
import { index } from 'drizzle-orm/sqlite-core'

// ... in table definition:
, (table) => ({
  teamIdIdx: index('idx_doc_configs_team_id').on(table.teamId),
  activeIdx: index('idx_doc_configs_active').on(table.active),
})
```

---

### Collection 2: `documentationJobs`

**Purpose:** Track individual documentation generation jobs

**Location:** `layers/documentation/collections/documentationJobs/server/database/schema.ts`

**Schema:**
```typescript
export const documentationJobs = sqliteTable('documentation_jobs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  configId: text('config_id').notNull().references(() => documentationConfigs.id, { onDelete: 'cascade' }),

  // Notion Task Info
  notionPageId: text('notion_page_id').notNull(),
  notionPageUrl: text('notion_page_url').notNull(),
  taskTitle: text('task_title').notNull(),
  taskCompletedBy: text('task_completed_by'), // Notion user ID
  taskCompletedByEmail: text('task_completed_by_email'),

  // Processing Status
  status: text('status', {
    enum: ['pending', 'analyzing', 'questioning', 'completed', 'failed']
  }).notNull().default('pending'),

  // Content Analysis (JSON fields)
  analyzedLinks: text('analyzed_links', { mode: 'json' }).$type<AnalyzedLink[]>(),
  // AnalyzedLink = { url: string, type: 'notion'|'github'|'web', summary: string, depth: number }

  // Documentation
  draftDocumentation: text('draft_documentation'), // Initial generation
  finalDocumentation: text('final_documentation'), // After Q&A

  // Questions & Answers (JSON fields)
  questions: text('questions', { mode: 'json' }).$type<Question[]>(),
  // Question = { id: string, text: string, answer: string | null, status: 'pending'|'answered'|'skipped' }

  // Slack Thread
  slackThreadId: text('slack_thread_id'), // channel:thread_ts format
  slackThreadUrl: text('slack_thread_url'),
  slackUserId: text('slack_user_id'), // User to ask questions
  conversationRounds: integer('conversation_rounds').notNull().default(0),
  lastQuestionTime: integer('last_question_time', { mode: 'timestamp' }),
  reminderSent: integer('reminder_sent', { mode: 'boolean' }).notNull().default(false),

  // Error Tracking
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),

  // Metrics
  tokensUsed: integer('tokens_used'),
  processingTimeMs: integer('processing_time_ms'),
  linksProcessed: integer('links_processed'),

  // Audit
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  configIdIdx: index('idx_doc_jobs_config_id').on(table.configId),
  statusIdx: index('idx_doc_jobs_status').on(table.status),
  notionPageIdx: index('idx_doc_jobs_notion_page').on(table.notionPageId),
  slackThreadIdx: index('idx_doc_jobs_slack_thread').on(table.slackThreadId),
  createdAtIdx: index('idx_doc_jobs_created_at').on(table.createdAt),
}))

export type DocumentationJob = typeof documentationJobs.$inferSelect
export type NewDocumentationJob = typeof documentationJobs.$inferInsert

// TypeScript types for JSON fields
export interface AnalyzedLink {
  url: string
  type: 'notion' | 'github' | 'web'
  title: string
  summary: string
  depth: number
  fetchedAt: string
  error?: string
}

export interface Question {
  id: string
  text: string
  answer: string | null
  answeredAt: string | null
  status: 'pending' | 'answered' | 'skipped'
  aiAnalysis?: {
    understood: boolean
    confidence: number
    missingInfo: string[]
  }
}
```

---

### Collection 3: `pendingQuestions`

**Purpose:** Track individual questions for detailed analytics (optional, for Car phase)

**Location:** `layers/documentation/collections/pendingQuestions/server/database/schema.ts`

**Schema:**
```typescript
export const pendingQuestions = sqliteTable('pending_questions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  jobId: text('job_id').notNull().references(() => documentationJobs.id, { onDelete: 'cascade' }),

  questionNumber: integer('question_number').notNull(), // 1, 2, 3...
  questionText: text('question_text').notNull(),

  status: text('status', {
    enum: ['pending', 'answered', 'skipped', 'timeout']
  }).notNull().default('pending'),

  // Answer
  answer: text('answer'),
  answeredAt: integer('answered_at', { mode: 'timestamp' }),

  // AI Analysis (JSON)
  aiAnalysis: text('ai_analysis', { mode: 'json' }).$type<{
    understood: boolean
    confidence: number
    missingInfo: string[]
    needsClarification: boolean
  }>(),

  // Audit
  askedAt: integer('asked_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  jobIdIdx: index('idx_pending_questions_job_id').on(table.jobId),
  statusIdx: index('idx_pending_questions_status').on(table.status),
}))

export type PendingQuestion = typeof pendingQuestions.$inferSelect
export type NewPendingQuestion = typeof pendingQuestions.$inferInsert
```

---

## API Endpoints

### Webhook Endpoints

#### `POST /api/webhooks/notion-documentation`

**Purpose:** Receive Notion database webhooks when task status changes

**Request:**
```typescript
// Headers
{
  'X-Notion-Signature': string  // HMAC signature
  'Content-Type': 'application/json'
}

// Body (Notion webhook payload)
{
  type: 'page.updated',
  page: {
    id: string,
    properties: {
      Status: {
        status: {
          name: 'Done' // Trigger when this changes to "Done"
        }
      },
      // ... other properties
    },
    last_edited_by: {
      id: string
    }
  }
}
```

**Response:**
```typescript
// 200 OK
{ success: true, jobId: string }

// 400 Bad Request
{ error: 'Invalid signature' }

// 404 Not Found
{ error: 'No config found for database' }
```

**Implementation:**
```typescript
// layers/documentation/server/api/webhooks/notion-documentation.post.ts
export default defineEventHandler(async (event) => {
  // 1. Verify signature
  const signature = getHeader(event, 'X-Notion-Signature')
  const body = await readRawBody(event)
  const config = await findConfigByWebhookRequest(event)

  if (!verifyNotionSignature(body, signature, config.webhookSecret)) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  // 2. Parse payload
  const payload = JSON.parse(body)

  // 3. Check if status changed to "Done"
  if (payload.page.properties.Status?.status?.name !== 'Done') {
    return { success: true, skipped: true, reason: 'Status not Done' }
  }

  // 4. Create job (fast, return quickly)
  const job = await createDocumentationJob({
    configId: config.id,
    notionPageId: payload.page.id,
    taskCompletedBy: payload.page.last_edited_by.id,
    status: 'pending'
  })

  // 5. Process async (don't await)
  processDocumentationJob(job.id).catch(err => {
    console.error('Job processing failed:', err)
  })

  return { success: true, jobId: job.id }
})
```

---

### Admin API Endpoints

#### `GET /api/documentation/configs`
**Purpose:** List all configs for a team

**Query Parameters:**
- `teamId` (required)

**Response:**
```typescript
{
  configs: DocumentationConfig[]
}
```

---

#### `POST /api/documentation/configs`
**Purpose:** Create new config

**Request Body:**
```typescript
{
  teamId: string
  name: string
  notionToken: string
  notionDatabaseId: string
  slackToken: string
  slackDocChannelId: string
  anthropicApiKey: string
}
```

**Response:**
```typescript
{
  config: DocumentationConfig
  webhookUrl: string // Auto-generated
}
```

---

#### `PATCH /api/documentation/configs/:id`
**Purpose:** Update config

**Request Body:** Partial<DocumentationConfig>

---

#### `DELETE /api/documentation/configs/:id`
**Purpose:** Delete config

---

#### `GET /api/documentation/jobs`
**Purpose:** List jobs

**Query Parameters:**
- `teamId` (required)
- `configId` (optional)
- `status` (optional): 'pending' | 'analyzing' | 'questioning' | 'completed' | 'failed'
- `limit` (optional, default: 20)
- `offset` (optional, default: 0)

**Response:**
```typescript
{
  jobs: DocumentationJob[]
  total: number
  hasMore: boolean
}
```

---

#### `GET /api/documentation/jobs/:id`
**Purpose:** Get job details

**Response:**
```typescript
{
  job: DocumentationJob
  config: DocumentationConfig
  questions: PendingQuestion[] // If using Car phase
}
```

---

#### `POST /api/documentation/jobs/:id/retry`
**Purpose:** Retry failed job

**Response:**
```typescript
{
  success: boolean
  jobId: string
}
```

---

## Service Interfaces

### Service: `notionFetcher.ts`

**Purpose:** Fetch Notion pages and convert to markdown

```typescript
export interface NotionPageContent {
  id: string
  title: string
  properties: Record<string, any>
  markdown: string
  blocks: NotionBlock[]
  lastEditedBy: string
  lastEditedTime: Date
}

export async function fetchNotionPage(
  pageId: string,
  token: string
): Promise<NotionPageContent> {
  // 1. Fetch page metadata
  // 2. Fetch all blocks (handle pagination)
  // 3. Convert blocks to markdown
  // 4. Return structured content
}

export async function appendBlocksToPage(
  pageId: string,
  blocks: NotionBlock[],
  token: string
): Promise<void> {
  // 1. Convert blocks to Notion API format
  // 2. Append to page (handle 100 block limit per request)
  // 3. Handle errors
}
```

---

### Service: `linkCrawler.ts`

**Purpose:** Extract and fetch linked content

```typescript
export interface CrawlOptions {
  maxDepth: number  // 1 or 2
  maxLinks: number  // Max total links
  timeout: number   // Max time in ms
}

export interface CrawlResult {
  links: AnalyzedLink[]
  stats: {
    total: number
    byType: Record<string, number>
    byDepth: Record<number, number>
    failed: number
  }
}

export async function crawlLinks(
  startingContent: string,
  options: CrawlOptions,
  tokens: {
    notionToken?: string
    githubToken?: string
  }
): Promise<CrawlResult> {
  // 1. Extract links from starting content
  // 2. For each link:
  //    - Determine type (notion/github/web)
  //    - Fetch content via appropriate adapter
  //    - Summarize if >maxWords
  //    - If depth < maxDepth: Extract links and recurse
  // 3. Return all analyzed links
}
```

---

### Service: `documentationGenerator.ts`

**Purpose:** Generate documentation using AI

```typescript
export interface GenerationOptions {
  taskContent: NotionPageContent
  analyzedLinks: AnalyzedLink[]
  previousAnswers?: Question[]  // For regeneration
  detectQuestions: boolean  // Bike/Car phase
}

export interface GenerationResult {
  documentation: string  // Markdown
  questions: string[]    // Questions to ask user
  tokensUsed: number
  confidence: number
}

export async function generateDocumentation(
  options: GenerationOptions,
  apiKey: string
): Promise<GenerationResult> {
  // 1. Build prompt with all context
  // 2. Call Claude API
  // 3. Parse response
  // 4. Extract questions if detectQuestions=true
  // 5. Return result
}

export async function analyzeAnswers(
  questions: Question[],
  userReply: string,
  apiKey: string
): Promise<Question[]> {
  // 1. Parse user reply (numbered or natural format)
  // 2. Match answers to questions
  // 3. AI: Analyze each answer for clarity
  // 4. Return updated questions with analysis
}
```

---

### Service: `notionUpdater.ts`

**Purpose:** Update Notion pages with documentation

```typescript
export interface UpdateOptions {
  pageId: string
  markdown: string
  jobId: string
  replaceExisting: boolean  // If true, replace previous docs
}

export async function appendDocumentation(
  options: UpdateOptions,
  token: string
): Promise<void> {
  // 1. If replaceExisting:
  //    - Find existing docs between markers
  //    - Delete those blocks
  // 2. Convert markdown to Notion blocks
  // 3. Add markers:
  //    <!-- DISCUBOT_DOCS_START job:xxx generated:timestamp -->
  //    [blocks]
  //    <!-- DISCUBOT_DOCS_END -->
  // 4. Append to page
  // 5. Handle errors
}

export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  // Convert markdown to Notion API block format
  // Handle: headers, paragraphs, lists, code blocks
  // Split long text (2000 char limit per block)
}
```

---

### Service: `questionHandler.ts`

**Purpose:** Orchestrate Slack Q&A flow

```typescript
export interface SlackQuestionOptions {
  job: DocumentationJob
  questions: string[]
  config: DocumentationConfig
}

export async function postQuestionsToSlack(
  options: SlackQuestionOptions
): Promise<{
  threadId: string
  threadUrl: string
}> {
  // 1. Get user's Slack ID from Notion user ID
  // 2. Format message with questions
  // 3. Post to #documentation channel
  // 4. Return thread info
}

export async function handleSlackReply(
  event: SlackEvent,
  config: DocumentationConfig
): Promise<void> {
  // 1. Find job by thread_ts
  // 2. Extract user reply text
  // 3. Analyze answers
  // 4. If needs clarification:
  //    - Generate follow-up questions
  //    - Post in same thread
  //    - Reset timer
  // 5. Else:
  //    - Regenerate documentation
  //    - Update Notion
  //    - Post confirmation
}
```

---

### Adapters: Content Readers

#### `notionReader.ts`
```typescript
export async function readNotionPage(
  url: string,
  token: string
): Promise<{ title: string, summary: string, markdown: string }> {
  // 1. Extract page ID from URL
  // 2. Fetch page content
  // 3. Convert to markdown
  // 4. Summarize if >2000 words
  // 5. Return result
}
```

#### `githubReader.ts`
```typescript
export async function readGitHubContent(
  url: string,
  token?: string
): Promise<{ title: string, summary: string, type: string }> {
  // 1. Parse URL (commit, PR, issue)
  // 2. Fetch via GitHub API
  // 3. Format based on type:
  //    - Commit: message + files changed + stats
  //    - PR: title + description + status
  //    - Issue: title + description + comments (max 5)
  // 4. Return summary
}
```

#### `webReader.ts`
```typescript
export async function readWebPage(
  url: string
): Promise<{ title: string, summary: string }> {
  // 1. Fetch URL (timeout: 10s)
  // 2. Extract article content (strip nav/footer)
  // 3. Convert HTML to markdown
  // 4. Truncate to 1000 words
  // 5. Return summary
}
```

---

## AI Prompts

### Prompt: Basic Documentation Generation (Skateboard)

```typescript
const prompt = `You are a technical documentation generator. Analyze this completed task and generate comprehensive documentation.

TASK INFORMATION:
Title: ${task.title}
Content:
${task.markdown}

INSTRUCTIONS:
Generate documentation in markdown format with these sections:
1. ## Overview - Brief summary of what was accomplished
2. ## Implementation Details - Technical details of how it was done
3. ## Key Changes - Important changes or decisions made
4. ## Future Considerations - Any follow-up items or tech debt

Keep it concise but comprehensive. Use technical language appropriate for developers.
Focus on "what" and "why", not just "how".

OUTPUT FORMAT:
Return ONLY the markdown documentation, nothing else.
`
```

### Prompt: Documentation with Context (Scooter)

```typescript
const prompt = `You are a technical documentation generator. Analyze this completed task and all related context to generate comprehensive documentation.

TASK INFORMATION:
Title: ${task.title}
Content:
${task.markdown}

RELATED CONTEXT:
${analyzedLinks.map((link, i) => `
${i + 1}. ${link.type.toUpperCase()}: ${link.title}
   URL: ${link.url}
   Summary: ${link.summary}
`).join('\n')}

INSTRUCTIONS:
Generate documentation in markdown format incorporating insights from the related context:
1. ## Overview - What was accomplished
2. ## Implementation Details - How it was implemented (reference context)
3. ## Related Changes - Link to related work (commits, PRs, pages)
4. ## Technical Notes - Important technical decisions
5. ## References - List all referenced sources

Use the related context to provide a complete picture. Cite sources when referencing them.

OUTPUT FORMAT:
Return ONLY the markdown documentation, nothing else.
`
```

### Prompt: Documentation with Questions (Bike)

```typescript
const prompt = `You are a technical documentation generator. Analyze this completed task and generate documentation.

[... same as Scooter ...]

ADDITIONAL TASK:
After generating the documentation, identify any information that is MISSING or UNCLEAR.
Generate specific questions to ask the task owner.

QUESTION CRITERIA:
- Direct and specific
- Answerable in 1-2 sentences
- Technical and relevant to documentation
- Maximum 5 questions

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "documentation": "... markdown here ...",
  "questions": ["question 1", "question 2", ...]
}
`
```

### Prompt: Answer Analysis (Bike/Car)

```typescript
const prompt = `Analyze the user's answers to documentation questions.

QUESTIONS ASKED:
${questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

USER'S REPLY:
${userReply}

TASK:
For each question, determine:
1. Was it answered? (yes/no/partial)
2. Is the answer clear enough for documentation? (confidence 0-1)
3. What information is still missing? (array of strings)

OUTPUT FORMAT:
Return JSON array:
[
  {
    "questionId": "q1",
    "understood": true,
    "confidence": 0.9,
    "extractedAnswer": "...",
    "missingInfo": []
  },
  ...
]
`
```

---

## Constants & Configuration

```typescript
// layers/documentation/server/config.ts

export const DOCUMENTATION_CONFIG = {
  // Rate Limits
  NOTION_REQUESTS_PER_SECOND: 3,
  GITHUB_REQUESTS_PER_HOUR: 5000, // With token
  CLAUDE_TOKENS_PER_MINUTE: 100000,

  // Crawling Limits
  MAX_CRAWL_DEPTH: 2,
  MAX_LINKS_PER_JOB: 100,
  MAX_LINKS_PER_LEVEL: 30,
  CRAWL_TIMEOUT_MS: 120000, // 2 minutes

  // Content Limits
  MAX_NOTION_WORDS: 2000,
  MAX_WEB_WORDS: 1000,
  MAX_GITHUB_DIFF_LINES: 500,

  // Q&A Settings
  MAX_QUESTIONS_PER_ASK: 5,
  MAX_CONVERSATION_ROUNDS: 3,
  QUESTION_TIMEOUT_HOURS: 48,
  REMINDER_AFTER_HOURS: 24,
  ABSOLUTE_TIMEOUT_DAYS: 7,

  // Retry Settings
  MAX_RETRIES: 3,
  RETRY_DELAYS_MS: [1000, 2000, 4000, 8000, 16000],

  // Documentation
  DOCS_START_MARKER: '<!-- DISCUBOT_DOCS_START',
  DOCS_END_MARKER: '<!-- DISCUBOT_DOCS_END -->',
}
```

---

## Error Handling

### Error Types

```typescript
export class DocumentationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public retryable: boolean
  ) {
    super(message)
  }
}

// Error codes
export const ERROR_CODES = {
  // Notion errors
  NOTION_UNAUTHORIZED: { code: 'NOTION_UNAUTHORIZED', statusCode: 401, retryable: false },
  NOTION_PAGE_NOT_FOUND: { code: 'NOTION_PAGE_NOT_FOUND', statusCode: 404, retryable: false },
  NOTION_RATE_LIMIT: { code: 'NOTION_RATE_LIMIT', statusCode: 429, retryable: true },

  // API errors
  API_TIMEOUT: { code: 'API_TIMEOUT', statusCode: 504, retryable: true },
  API_ERROR: { code: 'API_ERROR', statusCode: 500, retryable: true },

  // Content errors
  INVALID_CONTENT: { code: 'INVALID_CONTENT', statusCode: 400, retryable: false },
  CONTENT_TOO_LARGE: { code: 'CONTENT_TOO_LARGE', statusCode: 413, retryable: false },

  // AI errors
  AI_ERROR: { code: 'AI_ERROR', statusCode: 500, retryable: true },
  AI_RATE_LIMIT: { code: 'AI_RATE_LIMIT', statusCode: 429, retryable: true },
}
```

### Retry Logic

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (error instanceof DocumentationError && !error.retryable) {
        throw error // Don't retry permanent errors
      }

      if (attempt < maxRetries - 1) {
        const delay = DOCUMENTATION_CONFIG.RETRY_DELAYS_MS[attempt]
        await sleep(delay)
      }
    }
  }

  throw lastError
}
```

---

## Next Steps

- **Implementation Guide:** See `documentation-generator-implementation.md`
- **Testing Guide:** See `documentation-generator-testing.md`

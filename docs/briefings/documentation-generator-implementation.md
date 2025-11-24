# Documentation Generator - Implementation Guide

This guide provides step-by-step instructions for implementing the documentation generator feature.

**Prerequisites:**
- Read `documentation-generator-overview.md`
- Read `documentation-generator-phases.md`
- Read `documentation-generator-technical-spec.md`
- Understand existing DiscuBot architecture

---

## 🛹 SKATEBOARD PHASE (8-12 hours)

### Goal
Build the minimal viable feature: Auto-generate docs from completed tasks.

### Step 1: Setup Layer (30 minutes)

**1.1 Create the layer structure:**
```bash
mkdir -p layers/documentation
cd layers/documentation
```

**1.2 Create `nuxt.config.ts`:**
```typescript
// layers/documentation/nuxt.config.ts
export default defineNuxtConfig({
  // Layer configuration
})
```

**1.3 Update root `nuxt.config.ts`:**
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    './layers/core',
    './layers/auth',
    './layers/discubot',
    './layers/documentation',  // ← Add this
  ],
})
```

---

### Step 2: Generate Collections (1 hour)

**2.1 Create minimal config collection:**
```bash
# From project root
pnpm crouton generate
```

When prompted:
- Collection name: `documentationConfigs`
- Location: `layers/documentation`
- Fields:
  - teamId (text, required)
  - name (text, required)
  - notionToken (text, required)
  - notionDatabaseId (text, required)
  - webhookUrl (text, required)
  - webhookSecret (text, required)
  - anthropicApiKey (text, required)
  - active (boolean, default: true)

**2.2 Create jobs collection:**
```bash
pnpm crouton generate
```

When prompted:
- Collection name: `documentationJobs`
- Location: `layers/documentation`
- Fields:
  - configId (text, required, foreign key)
  - notionPageId (text, required)
  - taskTitle (text, required)
  - status (text enum: pending, analyzing, completed, failed)
  - documentation (text, nullable)
  - errorMessage (text, nullable)

**2.3 Run migrations:**
```bash
pnpm db:push
# Or: npx drizzle-kit push
```

**2.4 Verify tables created:**
```bash
sqlite3 .data/hub/db/default/db.sqlite
> .tables
> .schema documentation_configs
> .schema documentation_jobs
> .quit
```

---

### Step 3: Create Webhook Endpoint (1-2 hours)

**3.1 Create endpoint file:**
```typescript
// layers/documentation/server/api/webhooks/notion-documentation.post.ts
export default defineEventHandler(async (event) => {
  try {
    // Read raw body for signature verification
    const rawBody = await readRawBody(event)
    const signature = getHeader(event, 'X-Notion-Signature')

    // Parse payload
    const payload = JSON.parse(rawBody || '{}')

    // Log for debugging
    console.log('Notion webhook received:', {
      type: payload.type,
      pageId: payload.page?.id,
      status: payload.page?.properties?.Status?.status?.name
    })

    // Basic validation
    if (!payload.page) {
      return { success: true, skipped: true, reason: 'No page in payload' }
    }

    // Check if status changed to "Done"
    const status = payload.page.properties?.Status?.status?.name
    if (status !== 'Done') {
      return { success: true, skipped: true, reason: `Status is "${status}", not "Done"` }
    }

    // TODO: Find config by database ID
    // TODO: Verify signature
    // TODO: Create job
    // TODO: Process async

    console.log('Would create documentation job for page:', payload.page.id)

    return {
      success: true,
      message: 'Webhook received (not processing yet)'
    }
  } catch (error: any) {
    console.error('Webhook error:', error)
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }
})
```

**3.2 Test webhook endpoint:**
```bash
# In one terminal: Start dev server
pnpm dev

# In another terminal: Test webhook
curl -X POST http://localhost:3000/api/webhooks/notion-documentation \
  -H "Content-Type: application/json" \
  -d '{
    "type": "page.updated",
    "page": {
      "id": "test-page-123",
      "properties": {
        "Status": {
          "status": {
            "name": "Done"
          }
        }
      }
    }
  }'
```

Expected response: `{ "success": true, "message": "..." }`

---

### Step 4: Notion Page Fetcher (1-2 hours)

**4.1 Create Notion service:**
```typescript
// layers/documentation/server/services/notionFetcher.ts
import { Client } from '@notionhq/client'

export interface NotionPageContent {
  id: string
  title: string
  markdown: string
  lastEditedBy: string
  lastEditedTime: Date
}

export async function fetchNotionPage(
  pageId: string,
  token: string
): Promise<NotionPageContent> {
  const notion = new Client({ auth: token })

  try {
    // Fetch page metadata
    const page = await notion.pages.retrieve({ page_id: pageId })

    // Extract title (handle different property types)
    let title = 'Untitled'
    if ('properties' in page) {
      const titleProp = Object.values(page.properties).find(
        (prop: any) => prop.type === 'title'
      )
      if (titleProp && 'title' in titleProp && titleProp.title.length > 0) {
        title = titleProp.title[0].plain_text
      }
    }

    // Fetch blocks
    const blocks: any[] = []
    let cursor: string | undefined = undefined

    do {
      const response: any = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100
      })

      blocks.push(...response.results)
      cursor = response.has_more ? response.next_cursor : undefined
    } while (cursor)

    // Convert blocks to markdown
    const markdown = blocksToMarkdown(blocks)

    return {
      id: pageId,
      title,
      markdown,
      lastEditedBy: (page as any).last_edited_by?.id || 'unknown',
      lastEditedTime: new Date((page as any).last_edited_time)
    }
  } catch (error: any) {
    console.error('Failed to fetch Notion page:', error)
    throw new Error(`Failed to fetch page: ${error.message}`)
  }
}

function blocksToMarkdown(blocks: any[]): string {
  return blocks
    .map(block => {
      switch (block.type) {
        case 'paragraph':
          return richTextToPlainText(block.paragraph.rich_text)
        case 'heading_1':
          return `# ${richTextToPlainText(block.heading_1.rich_text)}`
        case 'heading_2':
          return `## ${richTextToPlainText(block.heading_2.rich_text)}`
        case 'heading_3':
          return `### ${richTextToPlainText(block.heading_3.rich_text)}`
        case 'bulleted_list_item':
          return `- ${richTextToPlainText(block.bulleted_list_item.rich_text)}`
        case 'numbered_list_item':
          return `1. ${richTextToPlainText(block.numbered_list_item.rich_text)}`
        case 'code':
          return `\`\`\`${block.code.language}\n${richTextToPlainText(block.code.rich_text)}\n\`\`\``
        case 'quote':
          return `> ${richTextToPlainText(block.quote.rich_text)}`
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n\n')
}

function richTextToPlainText(richText: any[]): string {
  return richText.map(text => text.plain_text).join('')
}
```

**4.2 Test fetcher:**
```typescript
// Test in Nuxt DevTools console or create a test file
const content = await fetchNotionPage('YOUR_TEST_PAGE_ID', 'YOUR_TOKEN')
console.log(content)
```

---

### Step 5: AI Documentation Generator (2 hours)

**5.1 Install Anthropic SDK:**
```bash
pnpm add @anthropic-ai/sdk
```

**5.2 Create generator service:**
```typescript
// layers/documentation/server/services/documentationGenerator.ts
import Anthropic from '@anthropic-ai/sdk'

export interface GenerationResult {
  documentation: string
  tokensUsed: number
}

export async function generateDocumentation(
  taskContent: { title: string; markdown: string },
  apiKey: string
): Promise<GenerationResult> {
  const client = new Anthropic({ apiKey })

  const prompt = `You are a technical documentation generator. Analyze this completed task and generate comprehensive documentation.

TASK INFORMATION:
Title: ${taskContent.title}

Content:
${taskContent.markdown}

INSTRUCTIONS:
Generate documentation in markdown format with these sections:
1. ## Overview - Brief summary of what was accomplished
2. ## Implementation Details - Technical details of how it was done
3. ## Key Changes - Important changes or decisions made
4. ## Future Considerations - Any follow-up items or tech debt

Keep it concise but comprehensive. Use technical language appropriate for developers.
Focus on "what" and "why", not just "how".

OUTPUT FORMAT:
Return ONLY the markdown documentation, nothing else.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const documentation = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return {
      documentation,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens
    }
  } catch (error: any) {
    console.error('AI generation failed:', error)
    throw new Error(`AI generation failed: ${error.message}`)
  }
}
```

**5.3 Test generator:**
```typescript
const result = await generateDocumentation(
  {
    title: 'Add user authentication',
    markdown: 'Implemented JWT-based authentication with refresh tokens...'
  },
  'YOUR_API_KEY'
)
console.log(result.documentation)
```

---

### Step 6: Notion Page Updater (2 hours)

**6.1 Create updater service:**
```typescript
// layers/documentation/server/services/notionUpdater.ts
import { Client } from '@notionhq/client'

export async function appendDocumentation(
  pageId: string,
  markdown: string,
  jobId: string,
  token: string
): Promise<void> {
  const notion = new Client({ auth: token })

  try {
    // Convert markdown to Notion blocks
    const blocks = markdownToNotionBlocks(markdown, jobId)

    // Append blocks to page
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks
    })

    console.log(`Documentation appended to page ${pageId}`)
  } catch (error: any) {
    console.error('Failed to append documentation:', error)
    throw new Error(`Failed to append documentation: ${error.message}`)
  }
}

export function markdownToNotionBlocks(markdown: string, jobId: string): any[] {
  const blocks: any[] = []

  // Add start marker
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: `<!-- DISCUBOT_DOCS_START job:${jobId} generated:${new Date().toISOString()} -->`
          }
        }
      ]
    }
  })

  // Parse markdown and convert to blocks
  const lines = markdown.split('\n')
  let currentText = ''

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (currentText) {
        blocks.push(createParagraphBlock(currentText))
        currentText = ''
      }
      blocks.push(createHeadingBlock(line.slice(2), 1))
    } else if (line.startsWith('## ')) {
      if (currentText) {
        blocks.push(createParagraphBlock(currentText))
        currentText = ''
      }
      blocks.push(createHeadingBlock(line.slice(3), 2))
    } else if (line.startsWith('### ')) {
      if (currentText) {
        blocks.push(createParagraphBlock(currentText))
        currentText = ''
      }
      blocks.push(createHeadingBlock(line.slice(4), 3))
    } else if (line.startsWith('- ')) {
      if (currentText) {
        blocks.push(createParagraphBlock(currentText))
        currentText = ''
      }
      blocks.push(createBulletBlock(line.slice(2)))
    } else if (line.trim() === '') {
      if (currentText) {
        blocks.push(createParagraphBlock(currentText))
        currentText = ''
      }
    } else {
      currentText += (currentText ? ' ' : '') + line
    }
  }

  if (currentText) {
    blocks.push(createParagraphBlock(currentText))
  }

  // Add end marker
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: '<!-- DISCUBOT_DOCS_END -->'
          }
        }
      ]
    }
  })

  return blocks
}

function createParagraphBlock(text: string): any {
  // Split into chunks if > 2000 chars
  const chunks = splitIntoChunks(text, 2000)

  if (chunks.length === 1) {
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: text } }]
      }
    }
  }

  // Return first chunk, rest will be added later
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: chunks[0] } }]
    }
  }
}

function createHeadingBlock(text: string, level: 1 | 2 | 3): any {
  const type = `heading_${level}`
  return {
    object: 'block',
    type,
    [type]: {
      rich_text: [{ type: 'text', text: { content: text.slice(0, 2000) } }]
    }
  }
}

function createBulletBlock(text: string): any {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text.slice(0, 2000) } }]
    }
  }
}

function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = []
  let current = ''

  const words = text.split(' ')
  for (const word of words) {
    if ((current + ' ' + word).length > maxLength) {
      chunks.push(current)
      current = word
    } else {
      current += (current ? ' ' : '') + word
    }
  }

  if (current) chunks.push(current)
  return chunks
}
```

---

### Step 7: Orchestrate Processing (2 hours)

**7.1 Create processor service:**
```typescript
// layers/documentation/server/services/documentationProcessor.ts
export async function processDocumentationJob(jobId: string): Promise<void> {
  try {
    // Get job
    const job = await findDocumentationJobById(jobId)
    if (!job) throw new Error('Job not found')

    // Get config
    const config = await findDocumentationConfigById(job.configId)
    if (!config) throw new Error('Config not found')

    console.log(`Processing job ${jobId} for page ${job.notionPageId}`)

    // Update status: pending → analyzing
    await updateDocumentationJob(jobId, { status: 'analyzing' })

    // Step 1: Fetch Notion page
    const pageContent = await fetchNotionPage(job.notionPageId, config.notionToken)

    // Step 2: Generate documentation
    const result = await generateDocumentation(
      {
        title: job.taskTitle,
        markdown: pageContent.markdown
      },
      config.anthropicApiKey
    )

    // Step 3: Append to Notion page
    await appendDocumentation(
      job.notionPageId,
      result.documentation,
      jobId,
      config.notionToken
    )

    // Step 4: Update job: analyzing → completed
    await updateDocumentationJob(jobId, {
      status: 'completed',
      documentation: result.documentation,
      tokensUsed: result.tokensUsed,
      completedAt: new Date()
    })

    console.log(`Job ${jobId} completed successfully`)
  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error)

    // Update job: → failed
    await updateDocumentationJob(jobId, {
      status: 'failed',
      errorMessage: error.message
    })

    throw error
  }
}
```

**7.2 Wire up webhook:**
```typescript
// Update: layers/documentation/server/api/webhooks/notion-documentation.post.ts

export default defineEventHandler(async (event) => {
  try {
    const rawBody = await readRawBody(event)
    const payload = JSON.parse(rawBody || '{}')

    // Check status
    const status = payload.page?.properties?.Status?.status?.name
    if (status !== 'Done') {
      return { success: true, skipped: true, reason: `Status is "${status}"` }
    }

    // Get page title
    const titleProp = Object.values(payload.page.properties).find(
      (prop: any) => prop.type === 'title'
    )
    const title = titleProp?.title?.[0]?.plain_text || 'Untitled'

    // Find config (for now, just use first active config)
    // TODO: Match by database ID
    const config = await findFirstActiveConfig()
    if (!config) {
      return { success: true, skipped: true, reason: 'No active config' }
    }

    // Create job
    const job = await createDocumentationJob({
      configId: config.id,
      notionPageId: payload.page.id,
      taskTitle: title,
      status: 'pending'
    })

    // Process async (don't await)
    processDocumentationJob(job.id).catch(err => {
      console.error('Processing failed:', err)
    })

    return {
      success: true,
      jobId: job.id
    }
  } catch (error: any) {
    console.error('Webhook error:', error)
    throw createError({ statusCode: 500, message: error.message })
    }
})
```

---

### Step 8: Testing (1 hour)

**8.1 Create test config manually:**
```bash
# Open database
sqlite3 .data/hub/db/default/db.sqlite

# Insert test config
INSERT INTO documentation_configs (
  id, team_id, name, notion_token, notion_database_id,
  webhook_url, webhook_secret, anthropic_api_key, active
) VALUES (
  'test-config-1',
  'test-team',
  'Test Config',
  'YOUR_NOTION_TOKEN',
  'YOUR_DATABASE_ID',
  'http://localhost:3000/api/webhooks/notion-documentation',
  'test-secret',
  'YOUR_ANTHROPIC_KEY',
  1
);
```

**8.2 Test end-to-end:**
1. Create test task in Notion database
2. Add some content to the task
3. Change status to "Done"
4. Notion sends webhook → DiscuBot
5. Check logs in terminal
6. Verify documentation appended to page

**8.3 Verify:**
- Job created in database
- Status: pending → analyzing → completed
- Documentation visible in Notion page
- Markers present (DISCUBOT_DOCS_START / END)

---

### Step 9: Commit (MANDATORY)

```bash
# Stage specific files
git add layers/documentation/
git add nuxt.config.ts
git add docs/briefings/

# Commit
git commit -m "feat: implement documentation generator (Skateboard phase)

- Add documentation layer with configs and jobs collections
- Create Notion webhook endpoint
- Implement page fetcher, AI generator, and updater
- Add processing orchestration
- Basic end-to-end flow working

Skateboard Phase Complete: Basic documentation generation from completed tasks."

# Push
git push
```

---

## 🛴 SCOOTER PHASE (+10-14 hours)

### Goal
Add link crawling to include context from related pages.

### Step 1: Link Extraction (2 hours)

**1.1 Create link extractor:**
```typescript
// layers/documentation/server/utils/linkExtractor.ts

export interface ExtractedLink {
  url: string
  type: 'notion' | 'github' | 'web' | 'unknown'
  text: string
}

export function extractLinks(markdown: string): ExtractedLink[] {
  const links: ExtractedLink[] = []

  // Markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match

  while ((match = markdownLinkRegex.exec(markdown)) !== null) {
    const [, text, url] = match
    links.push({
      url,
      type: categorizeUrl(url),
      text
    })
  }

  // Plain URLs
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
  while ((match = urlRegex.exec(markdown)) !== null) {
    const url = match[0]
    if (!links.some(l => l.url === url)) {
      links.push({
        url,
        type: categorizeUrl(url),
        text: ''
      })
    }
  }

  return links
}

function categorizeUrl(url: string): ExtractedLink['type'] {
  if (url.includes('notion.so') || url.includes('notion.site')) {
    return 'notion'
  }
  if (url.includes('github.com')) {
    return 'github'
  }
  if (url.startsWith('http')) {
    return 'web'
  }
  return 'unknown'
}
```

---

### Step 2: Content Reader Adapters (6 hours)

**2.1 Notion Reader:**
```typescript
// layers/documentation/server/adapters/contentReaders/notionReader.ts
import { fetchNotionPage } from '../../services/notionFetcher'

export async function readNotionPage(
  url: string,
  token: string
): Promise<{ title: string; summary: string }> {
  try {
    // Extract page ID from URL
    const pageId = extractNotionPageId(url)
    if (!pageId) throw new Error('Invalid Notion URL')

    // Fetch content
    const content = await fetchNotionPage(pageId, token)

    // Summarize if too long
    const summary = content.markdown.length > 2000
      ? content.markdown.slice(0, 2000) + '...'
      : content.markdown

    return {
      title: content.title,
      summary
    }
  } catch (error: any) {
    console.error('Failed to read Notion page:', error)
    return {
      title: 'Error',
      summary: `Failed to fetch: ${error.message}`
    }
  }
}

function extractNotionPageId(url: string): string | null {
  // Handle various Notion URL formats
  const patterns = [
    /notion\.so\/([a-zA-Z0-9]+)/,
    /notion\.so\/[^/]+-([a-zA-Z0-9]+)/,
    /([a-f0-9]{32})/,
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}
```

**2.2 GitHub Reader:**
```typescript
// layers/documentation/server/adapters/contentReaders/githubReader.ts

export async function readGitHubContent(
  url: string,
  token?: string
): Promise<{ title: string; summary: string }> {
  try {
    const parsed = parseGitHubUrl(url)
    if (!parsed) throw new Error('Invalid GitHub URL')

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    }
    if (token) headers['Authorization'] = `token ${token}`

    switch (parsed.type) {
      case 'commit':
        return await readCommit(parsed, headers)
      case 'pull':
        return await readPullRequest(parsed, headers)
      case 'issue':
        return await readIssue(parsed, headers)
      default:
        return { title: 'GitHub', summary: url }
    }
  } catch (error: any) {
    console.error('Failed to read GitHub content:', error)
    return {
      title: 'GitHub Error',
      summary: `Failed to fetch: ${error.message}`
    }
  }
}

function parseGitHubUrl(url: string) {
  // Match: github.com/owner/repo/commit/sha
  const commitMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)/)
  if (commitMatch) {
    return {
      type: 'commit' as const,
      owner: commitMatch[1],
      repo: commitMatch[2],
      sha: commitMatch[3]
    }
  }

  // Match: github.com/owner/repo/pull/123
  const pullMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (pullMatch) {
    return {
      type: 'pull' as const,
      owner: pullMatch[1],
      repo: pullMatch[2],
      number: pullMatch[3]
    }
  }

  // Match: github.com/owner/repo/issues/123
  const issueMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
  if (issueMatch) {
    return {
      type: 'issue' as const,
      owner: issueMatch[1],
      repo: issueMatch[2],
      number: issueMatch[3]
    }
  }

  return null
}

async function readCommit(parsed: any, headers: Record<string, string>) {
  const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${parsed.sha}`
  const response = await fetch(url, { headers })
  const data = await response.json()

  return {
    title: `Commit: ${data.commit.message.split('\n')[0]}`,
    summary: `
**Commit:** ${data.sha.slice(0, 7)}
**Author:** ${data.commit.author.name}
**Date:** ${data.commit.author.date}

**Message:**
${data.commit.message}

**Files changed:** ${data.files.length}
**Additions:** +${data.stats.additions}
**Deletions:** -${data.stats.deletions}
    `.trim()
  }
}

async function readPullRequest(parsed: any, headers: Record<string, string>) {
  const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`
  const response = await fetch(url, { headers })
  const data = await response.json()

  return {
    title: `PR #${data.number}: ${data.title}`,
    summary: `
**Status:** ${data.state} (${data.merged ? 'merged' : 'open'})
**Author:** ${data.user.login}
**Created:** ${data.created_at}

**Description:**
${data.body || 'No description'}
    `.trim()
  }
}

async function readIssue(parsed: any, headers: Record<string, string>) {
  const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`
  const response = await fetch(url, { headers })
  const data = await response.json()

  return {
    title: `Issue #${data.number}: ${data.title}`,
    summary: `
**Status:** ${data.state}
**Author:** ${data.user.login}
**Created:** ${data.created_at}

**Description:**
${data.body || 'No description'}
    `.trim()
  }
}
```

**2.3 Web Reader:**
```typescript
// layers/documentation/server/adapters/contentReaders/webReader.ts

export async function readWebPage(
  url: string
): Promise<{ title: string; summary: string }> {
  try {
    // Fetch with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DiscuBot/1.0'
      }
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1] : 'Web Page'

    // Basic content extraction (strip HTML tags)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Truncate to 1000 words
    const words = textContent.split(' ').slice(0, 1000)
    const summary = words.join(' ') + (words.length === 1000 ? '...' : '')

    return { title, summary }
  } catch (error: any) {
    console.error('Failed to read web page:', error)
    return {
      title: 'Web Error',
      summary: `Failed to fetch: ${error.message}`
    }
  }
}
```

---

### Step 3: Link Crawler Service (3 hours)

```typescript
// layers/documentation/server/services/linkCrawler.ts
import { extractLinks } from '../utils/linkExtractor'
import { readNotionPage } from '../adapters/contentReaders/notionReader'
import { readGitHubContent } from '../adapters/contentReaders/githubReader'
import { readWebPage } from '../adapters/contentReaders/webReader'

export interface AnalyzedLink {
  url: string
  type: 'notion' | 'github' | 'web'
  title: string
  summary: string
  depth: number
}

export interface CrawlResult {
  links: AnalyzedLink[]
  stats: {
    total: number
    byType: Record<string, number>
    failed: number
  }
}

export async function crawlLinks(
  markdown: string,
  depth: number,
  tokens: {
    notionToken?: string
    githubToken?: string
  },
  visited: Set<string> = new Set()
): Promise<CrawlResult> {
  const results: AnalyzedLink[] = []
  const stats = {
    total: 0,
    byType: {} as Record<string, number>,
    failed: 0
  }

  // Extract links from markdown
  const links = extractLinks(markdown)

  // Fetch each link (max 30 per level)
  const linksToFetch = links.slice(0, 30)

  for (const link of linksToFetch) {
    // Skip if already visited
    if (visited.has(link.url)) continue
    visited.add(link.url)

    stats.total++

    try {
      let result: { title: string; summary: string }

      switch (link.type) {
        case 'notion':
          if (!tokens.notionToken) continue
          result = await readNotionPage(link.url, tokens.notionToken)
          break
        case 'github':
          result = await readGitHubContent(link.url, tokens.githubToken)
          break
        case 'web':
          result = await readWebPage(link.url)
          break
        default:
          continue
      }

      results.push({
        url: link.url,
        type: link.type as any,
        title: result.title,
        summary: result.summary,
        depth
      })

      stats.byType[link.type] = (stats.byType[link.type] || 0) + 1

      // Rate limiting: 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.error(`Failed to fetch ${link.url}:`, error)
      stats.failed++
    }
  }

  return { links: results, stats }
}
```

---

### Step 4: Update Generator & Processor (2 hours)

**4.1 Update generator prompt:**
```typescript
// Update: layers/documentation/server/services/documentationGenerator.ts

export async function generateDocumentation(
  taskContent: { title: string; markdown: string },
  analyzedLinks: AnalyzedLink[],
  apiKey: string
): Promise<GenerationResult> {
  const client = new Anthropic({ apiKey })

  // Build context section
  const contextSection = analyzedLinks.length > 0
    ? `\nRELATED CONTEXT:\n${analyzedLinks.map((link, i) => `
${i + 1}. ${link.type.toUpperCase()}: ${link.title}
   URL: ${link.url}
   Summary: ${link.summary}
`).join('\n')}`
    : ''

  const prompt = `You are a technical documentation generator. Analyze this completed task and all related context to generate comprehensive documentation.

TASK INFORMATION:
Title: ${taskContent.title}

Content:
${taskContent.markdown}
${contextSection}

INSTRUCTIONS:
Generate documentation in markdown format incorporating insights from the related context:
1. ## Overview - What was accomplished
2. ## Implementation Details - How it was implemented (reference context)
3. ## Related Changes - Link to related work (commits, PRs, pages)
4. ## Technical Notes - Important technical decisions
5. ## References - List all referenced sources

Use the related context to provide a complete picture. Cite sources when referencing them.

OUTPUT FORMAT:
Return ONLY the markdown documentation, nothing else.`

  // ... rest same as before
}
```

**4.2 Update processor:**
```typescript
// Update: layers/documentation/server/services/documentationProcessor.ts

export async function processDocumentationJob(jobId: string): Promise<void> {
  try {
    const job = await findDocumentationJobById(jobId)
    const config = await findDocumentationConfigById(job.configId)

    await updateDocumentationJob(jobId, { status: 'analyzing' })

    // Fetch page
    const pageContent = await fetchNotionPage(job.notionPageId, config.notionToken)

    // NEW: Crawl links
    const crawlResult = await crawlLinks(
      pageContent.markdown,
      1, // Depth 1 for Scooter
      {
        notionToken: config.notionToken,
        githubToken: process.env.GITHUB_TOKEN
      }
    )

    console.log(`Crawled ${crawlResult.links.length} links`)

    // Generate with context
    const result = await generateDocumentation(
      { title: job.taskTitle, markdown: pageContent.markdown },
      crawlResult.links,
      config.anthropicApiKey
    )

    // Append to Notion
    await appendDocumentation(
      job.notionPageId,
      result.documentation,
      jobId,
      config.notionToken
    )

    // Update job
    await updateDocumentationJob(jobId, {
      status: 'completed',
      documentation: result.documentation,
      analyzedLinks: crawlResult.links,
      tokensUsed: result.tokensUsed,
      linksProcessed: crawlResult.links.length,
      completedAt: new Date()
    })
  } catch (error: any) {
    // ... error handling
  }
}
```

---

### Step 5: Test & Commit (2 hours)

**5.1 Test with different link types:**
- Task with Notion links
- Task with GitHub links
- Task with web links
- Task with mixed links

**5.2 Verify quality improvement:**
- Compare Skateboard vs Scooter documentation
- Ensure context is included
- Check citations/references

**5.3 Commit:**
```bash
git add layers/documentation/
git commit -m "feat: add link crawling to documentation generator (Scooter phase)

- Implement link extraction utility
- Add content readers for Notion, GitHub, and web pages
- Create link crawler service (1-level deep)
- Update AI prompt to include context
- Update processor to crawl before generating

Scooter Phase Complete: Documentation now includes related context."

git push
```

---

## 🚲 BIKE PHASE & 🚗 CAR PHASE

For Bike (Q&A) and Car (Production) phases, follow the same pattern:
1. Read detailed steps in `documentation-generator-phases.md`
2. Implement services one by one
3. Test incrementally
4. Commit after major milestones

---

## Next Steps

1. Start with Skateboard phase
2. Test thoroughly before proceeding
3. Evaluate value at each decision point
4. Only proceed to next phase if needed

**For testing strategy, see:** `documentation-generator-testing.md`

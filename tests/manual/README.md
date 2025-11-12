# Manual Tests for Phase 2

These scripts test the Phase 2 components with real API calls (AI, Notion) using mock data.

## Setup

1. **Install dependencies:**
   ```bash
   pnpm add -D tsx
   ```

2. **Set environment variables:**
   ```bash
   # AI Service (required for AI tests)
   export ANTHROPIC_API_KEY=sk-ant-your-key-here

   # Notion Service (required for Notion tests)
   export NOTION_API_KEY=secret_your-key-here
   export NOTION_DATABASE_ID=abc123def456  # without dashes
   ```

## Running Tests

### Test AI Service
Tests Claude AI integration for summarization and task detection.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npx tsx tests/manual/test-ai-service.ts
```

**What it tests:**
- ✅ Summary generation
- ✅ Task detection
- ✅ Caching behavior
- ✅ Sentiment analysis

### Test Notion Service
Creates a real task in your Notion database.

```bash
export NOTION_API_KEY=secret_...
export NOTION_DATABASE_ID=abc123...
npx tsx tests/manual/test-notion-service.ts
```

**What it tests:**
- ✅ Task creation
- ✅ Rich content blocks
- ✅ Metadata formatting
- ✅ Deep links

### Test Processor Service (Full Pipeline)
Tests the complete processing pipeline end-to-end.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export NOTION_API_KEY=secret_...
export NOTION_DATABASE_ID=abc123...
npx tsx tests/manual/test-processor.ts
```

**What it tests:**
- ✅ All 6 pipeline stages
- ✅ AI analysis integration
- ✅ Notion task creation
- ✅ Error handling
- ✅ Status tracking

**Partial testing:**
You can run without env vars to test specific stages:
- Without AI key: Uses mock AI results
- Without Notion keys: Skips task creation

## Setting Up Notion

1. Go to https://www.notion.so/my-integrations
2. Create a new integration
3. Copy the API key
4. Create a database in Notion
5. Share the database with your integration
6. Copy the database ID from the URL (remove dashes)

Example URL:
```
https://www.notion.so/abc123def456?v=...
                    ^^^^^^^^^^^^
                    This is your database ID
```

## Expected Output

### AI Service Test
```
🧪 Testing AI Service

📋 Test Thread:
   Thread ID: test-thread-123
   Root message: The login button is too small and hard to click...
   Replies: 2
   Participants: 3

🤖 Calling AI service...

✅ AI Analysis Complete!

📊 Summary:
   Team discussed improving the login button UX...

🎯 Key Points:
   1. Make button larger for mobile
   2. Add loading spinner
   3. Update color scheme

😊 Sentiment: positive
📈 Confidence: 92%

📝 Tasks Detected: 3
🔀 Multi-task? Yes

✅ Detected Tasks:
   1. Increase login button size
   2. Add loading spinner to button
   3. Update button color scheme

⏱️  Processing Time: 2341ms
💾 Cached: No

🔄 Testing cache...
   Cached result time: 12ms
   From cache? Yes ✅
```

### Notion Service Test
```
🧪 Testing Notion Service

📋 Test Data:
   Database ID: abc123def456
   Source: Figma
   Task: Improve login button UX for mobile
   Priority: high

📝 Creating test task in Notion...

✅ Task Created Successfully!

🎯 Result:
   Task ID: page-id-here
   Task URL: https://notion.so/page-id-here
   Time: 1234ms

👉 Open in Notion: https://notion.so/page-id-here
```

### Processor Test
```
🧪 Testing Processor Service

🔑 Environment:
   ANTHROPIC_API_KEY: ✅ Set
   NOTION_API_KEY: ✅ Set
   NOTION_DATABASE_ID: ✅ Set

📋 Test Data:
   Source: figma
   Title: Login button needs improvement
   Messages: 3

⚙️  Starting processing pipeline...

✅ Processing Complete!

📊 Results:
   Discussion ID: disc_1234567890
   Processing Time: 3456ms

🤖 AI Analysis:
   Summary: Team discussed improving button...
   Key Points: 4
   Sentiment: positive
   Confidence: 92%

📝 Task Detection:
   Tasks Found: 3
   Multi-task? Yes

📄 Notion Tasks Created:
   1. https://notion.so/task-1
   2. https://notion.so/task-2
   3. https://notion.so/task-3

🎯 Pipeline Stages:
   ✅ 1. Validation
   ✅ 2. Config Loading
   ✅ 3. Thread Building
   ✅ 4. AI Analysis
   ✅ 5. Task Creation
   ✅ 6. Finalization

✅ All processor tests passed!
```

## Troubleshooting

### Error: "useRuntimeConfig is not defined"
- **Cause**: These are server-side functions being run outside Nuxt context
- **Solution**: The test scripts bypass Nuxt and use env vars directly

### Error: "404 - Object not found" (Notion)
- **Cause**: Database not shared with integration
- **Solution**: Open database → Share → Add your integration

### Error: "Invalid database ID format" (Notion)
- **Cause**: Database ID contains dashes
- **Solution**: Remove all dashes from the ID

### Error: "Authentication failed" (Anthropic)
- **Cause**: Invalid or expired API key
- **Solution**: Get a new key from console.anthropic.com

### Error: "Rate limit exceeded"
- **Cause**: Too many API calls in short time
- **Solution**: Wait 60 seconds and try again

## Next Steps

After manual testing confirms everything works:

1. ✅ Verify all tests pass
2. ✅ Check tasks appear correctly in Notion
3. ✅ Verify AI summaries are accurate
4. 🚀 Ready to move to Phase 3!

## Integration Tests (Phase 3+)

These manual tests will evolve into automated integration tests once we have:
- API endpoints built
- Database integration complete
- Adapters implemented

For now, manual testing is sufficient to verify Phase 2 components work correctly!

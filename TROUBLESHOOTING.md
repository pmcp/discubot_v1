# Discubot Troubleshooting Guide

Common issues and their solutions.

---

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Configuration Issues](#configuration-issues)
3. [Database Issues](#database-issues)
4. [Webhook Issues](#webhook-issues)
5. [Integration Issues](#integration-issues)
6. [Processing Issues](#processing-issues)
7. [Performance Issues](#performance-issues)
8. [Deployment Issues](#deployment-issues)
9. [Getting Help](#getting-help)

---

## Installation Issues

### Issue: `pnpm install` fails with dependency errors

**Symptoms**:
```
ERR_PNPM_PEER_DEP_ISSUES
Package X requires Y but Y is not installed
```

**Solutions**:

1. **Clear caches and reinstall**:
   ```bash
   # Clear pnpm cache
   pnpm store prune

   # Remove node_modules and lock file
   rm -rf node_modules pnpm-lock.yaml

   # Reinstall
   pnpm install
   ```

2. **Update pnpm**:
   ```bash
   npm install -g pnpm@latest
   pnpm install
   ```

3. **Force install** (if safe):
   ```bash
   pnpm install --force
   ```

### Issue: Node version mismatch

**Symptoms**:
```
error nuxt@3.x requires node >=20.0.0
The node version you're using is 18.x
```

**Solutions**:

1. **Using nvm (recommended)**:
   ```bash
   # Install nvm if not installed
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Install Node 20
   nvm install 20
   nvm use 20
   nvm alias default 20
   ```

2. **Update Node manually**:
   - Download Node 20.x from [nodejs.org](https://nodejs.org/)
   - Install and verify: `node --version`

### Issue: Type errors after installation

**Symptoms**:
```
Cannot find module '#crouton/team-auth' or its corresponding type declarations
```

**Solutions**:

1. **Prepare Nuxt types**:
   ```bash
   npx nuxt prepare
   ```

2. **Verify Crouton generation**:
   ```bash
   pnpm crouton generate
   ```

3. **Restart VS Code** (if using):
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
   - Type "Reload Window"
   - Press Enter

---

## Configuration Issues

### Issue: Environment variables not loading

**Symptoms**:
- API returns "Missing configuration" errors
- `config.anthropic.apiKey` is undefined

**Solutions**:

1. **Verify `.env` file exists**:
   ```bash
   ls -la .env
   ```

2. **Check variable names** (case-sensitive):
   ```bash
   # Correct
   ANTHROPIC_API_KEY=sk-ant-...

   # Incorrect (will not work)
   anthropic_api_key=sk-ant-...
   ```

3. **No trailing spaces**:
   ```bash
   # Bad (has trailing space)
   ANTHROPIC_API_KEY=sk-ant-...

   # Good (no trailing space)
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. **Restart dev server**:
   ```bash
   # Stop server (Ctrl+C)
   # Start again
   pnpm dev
   ```

### Issue: Invalid API key format

**Symptoms**:
```
Error: Invalid API key format
```

**Solutions**:

1. **Verify API key formats**:
   ```bash
   # Anthropic
   ANTHROPIC_API_KEY=sk-ant-api03-...  # Must start with sk-ant-

   # Notion
   NOTION_TOKEN=secret_...             # Must start with secret_

   # Figma
   FIGMA_API_TOKEN=figd_...            # Must start with figd_

   # Slack Bot Token
   SLACK_BOT_TOKEN=xoxb-...            # Must start with xoxb-
   ```

2. **Regenerate keys if needed**:
   - Anthropic: [console.anthropic.com](https://console.anthropic.com/)
   - Notion: [notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Figma: Account settings → Personal access tokens

### Issue: Notion database not found

**Symptoms**:
```
Error: Could not find database with ID abc123...
```

**Solutions**:

1. **Verify database ID format**:
   ```
   https://notion.so/workspace/abc123def456789?v=...
                             ^^^^^^^^^^^^^^^^^^
                             This is your database ID
   ```

2. **Share database with integration**:
   - Open Notion database
   - Click "..." menu → "Connections"
   - Add your integration
   - Click "Confirm"

3. **Verify integration has access**:
   ```bash
   curl -X GET https://api.notion.com/v1/databases/YOUR_DB_ID \
     -H "Authorization: Bearer secret_..." \
     -H "Notion-Version: 2022-06-28"
   ```

---

## Database Issues

### Issue: Database locked errors (SQLite)

**Symptoms**:
```
Error: SQLITE_BUSY: database is locked
```

**Solutions**:

1. **Stop all running processes**:
   ```bash
   # Kill any running dev servers
   pkill -f "nuxt dev"

   # Remove database lock
   rm -f .data/db.sqlite3-shm .data/db.sqlite3-wal
   ```

2. **Reset database** (⚠️ destroys data):
   ```bash
   rm -f .data/db.sqlite3
   pnpm db:migrate
   ```

### Issue: Migration errors

**Symptoms**:
```
Error: Table 'discussions' already exists
```

**Solutions**:

1. **Check migration status**:
   ```bash
   pnpm db:studio
   # Look for _drizzle_migrations table
   ```

2. **Reset migrations** (⚠️ destroys data):
   ```bash
   # Remove database
   rm -f .data/db.sqlite3

   # Regenerate migrations
   pnpm db:generate

   # Run migrations
   pnpm db:migrate
   ```

3. **Manual migration** (if needed):
   ```bash
   # Connect to database
   sqlite3 .data/db.sqlite3

   # Drop problematic table
   DROP TABLE IF EXISTS discussions;

   # Exit
   .exit

   # Rerun migrations
   pnpm db:migrate
   ```

### Issue: Foreign key constraint failures

**Symptoms**:
```
Error: FOREIGN KEY constraint failed
```

**Solutions**:

1. **Ensure related records exist**:
   ```typescript
   // Create config first
   const config = await createDiscubotConfig(...)

   // Then create discussion with valid configId
   const discussion = await createDiscubotDiscussion({
     ...
     sourceConfigId: config.id  // Must exist
   })
   ```

2. **Use system user for automated operations**:
   ```typescript
   import { SYSTEM_USER_ID } from '~/layers/discubot/server/utils/constants'

   // Use SYSTEM_USER_ID for owner/createdBy
   const job = await createDiscubotJob({
     ...
     owner: SYSTEM_USER_ID
   })
   ```

---

## Webhook Issues

### Issue: Slack webhook returns 401 Unauthorized

**Symptoms**:
```
Error: Invalid signature
```

**Solutions**:

1. **Verify signing secret is correct**:
   ```bash
   # In .env
   SLACK_SIGNING_SECRET=abcdef1234567890...

   # Must match Slack app "Signing Secret" exactly
   ```

2. **Check request timestamp**:
   - Slack requires timestamp within 5 minutes
   - Ensure server clock is synchronized (use NTP)
   - For testing, disable verification temporarily:
     ```typescript
     // Only in development!
     const isDev = process.env.NODE_ENV === 'development'
     if (isDev) {
       // Skip signature verification
     }
     ```

3. **Use ngrok for local testing**:
   ```bash
   # Install ngrok
   npm install -g ngrok

   # Start tunnel
   ngrok http 3000

   # Use https URL for Slack webhook
   # Example: https://abc123.ngrok.io/api/webhooks/slack
   ```

### Issue: Mailgun webhook not receiving events

**Symptoms**:
- No webhook calls being received
- Figma comments not processing

**Solutions**:

1. **Verify Mailgun route is configured**:
   - Go to Mailgun dashboard → Routes
   - Ensure route forwards to your webhook URL
   - Check filter expression matches Figma emails

2. **Test webhook manually**:
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/mailgun \
     -H "Content-Type: application/json" \
     -d '{
       "recipient": "figma@example.com",
       "body-plain": "Test notification",
       "From": "notifications@figma.com",
       "subject": "Comment on Design File",
       "signature": {
         "timestamp": "1234567890",
         "token": "test-token",
         "signature": "test-signature"
       }
     }'
   ```

3. **Check Mailgun logs**:
   - Mailgun dashboard → Logs
   - Look for webhook delivery attempts
   - Check for 4xx/5xx errors

### Issue: Webhook URL verification fails (Slack)

**Symptoms**:
```
Slack shows "Your URL didn't respond with the challenge"
```

**Solutions**:

1. **Ensure endpoint responds to challenges**:
   ```typescript
   // /api/webhooks/slack.post.ts should handle:
   if (body.type === 'url_verification') {
     return { challenge: body.challenge }
   }
   ```

2. **Check endpoint is accessible**:
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/slack \
     -H "Content-Type: application/json" \
     -d '{"type":"url_verification","challenge":"test123"}'

   # Expected response: {"challenge":"test123"}
   ```

3. **Verify HTTPS is working**:
   - Slack requires HTTPS in production
   - Use ngrok for local testing

---

## Integration Issues

### Issue: Figma API returns 403 Forbidden

**Symptoms**:
```
Error: Forbidden - insufficient permissions
```

**Solutions**:

1. **Verify API token permissions**:
   - Go to Figma account settings
   - Check token has "File content" read access
   - Regenerate token if needed

2. **Verify file access**:
   ```bash
   curl -X GET https://api.figma.com/v1/files/FILE_KEY/comments \
     -H "X-Figma-Token: figd_..."

   # Should return comments list, not 403
   ```

3. **Check file permissions**:
   - Ensure token owner has access to file
   - File must not be in restricted workspace

### Issue: Slack API returns `invalid_auth`

**Symptoms**:
```
Error: invalid_auth
```

**Solutions**:

1. **Verify bot token format**:
   ```bash
   # Must start with xoxb- for bot tokens
   SLACK_BOT_TOKEN=xoxb-1234567890-...
   ```

2. **Reinstall app if needed**:
   - Go to Slack app settings → OAuth & Permissions
   - Click "Reinstall App"
   - Copy new Bot User OAuth Token

3. **Check token scopes**:
   - Ensure app has required scopes (see SETUP.md)
   - Reinstall if scopes were added after installation

### Issue: Notion API rate limiting

**Symptoms**:
```
Error: Rate limit exceeded (429)
```

**Solutions**:

1. **Notion service already has rate limiting** (200ms delay):
   ```typescript
   // Automatically enforced in createNotionTask()
   await delay(200) // Built-in
   ```

2. **For burst scenarios, increase delay**:
   ```typescript
   // In layers/discubot/server/services/notion.ts
   const RATE_LIMIT_DELAY_MS = 300 // Increase from 200ms
   ```

3. **Implement exponential backoff** (already included):
   ```typescript
   // Retry utility handles this automatically
   await withRetry(() => createNotionTask(...))
   ```

---

## Processing Issues

### Issue: AI analysis fails with timeout

**Symptoms**:
```
Error: Request timed out after 30000ms
```

**Solutions**:

1. **Check Anthropic API status**:
   - Visit [status.anthropic.com](https://status.anthropic.com/)
   - Verify no ongoing incidents

2. **Reduce content size**:
   ```typescript
   // If discussion content is very large
   const MAX_CONTENT_LENGTH = 10000 // characters
   const truncatedContent = content.slice(0, MAX_CONTENT_LENGTH)
   ```

3. **Increase timeout** (if needed):
   ```typescript
   // In layers/discubot/server/services/ai.ts
   const response = await anthropic.messages.create({
     ...
     timeout: 60000 // Increase from 30s to 60s
   })
   ```

### Issue: Tasks not created in Notion

**Symptoms**:
- Processing completes successfully
- But no tasks appear in Notion database

**Solutions**:

1. **Verify database ID is correct**:
   ```bash
   # Test Notion connection
   curl -X POST http://localhost:3000/api/configs/test-connection \
     -H "Content-Type: application/json" \
     -d '{
       "type": "testByConfig",
       "config": {
         "notionToken": "secret_...",
         "notionDatabaseId": "abc123..."
       }
     }'
   ```

2. **Check Notion database permissions**:
   - Database must be shared with integration
   - Integration must have "Insert content" permission

3. **Review processing logs**:
   ```bash
   # Check for errors in Stage 5 (Task Creation)
   tail -f .output/server/logs/*.log | grep "Stage 5"
   ```

### Issue: User mentions not working in Notion

**Symptoms**:
- Tasks created but mentions show as plain text `@U123ABC`
- Not clickable mention objects in Notion

**Solutions**:

1. **Verify user mappings exist**:
   ```bash
   # Check admin UI: /dashboard/[team]/discubot/user-mappings
   # Or query database:
   SELECT * FROM user_mappings WHERE source_user_id = 'U123ABC';
   ```

2. **Create user mapping**:
   - Admin UI → User Mappings → New Mapping
   - Or use bulk import for multiple users

3. **Check Notion user IDs**:
   ```bash
   # Fetch Notion users
   curl -X GET https://your-domain.com/api/notion/users?notionToken=secret_...

   # Verify user ID matches mapping
   ```

---

## Performance Issues

### Issue: Slow webhook processing (>10s)

**Symptoms**:
- Webhooks take very long to respond
- Timeouts in Slack/Mailgun

**Solutions**:

1. **Enable AI caching** (already implemented):
   - Map-based cache automatically caches AI responses
   - Check cache is working:
     ```typescript
     // Logs should show "Using cached AI analysis"
     ```

2. **Optimize Notion API calls**:
   ```typescript
   // Batch user lookups if possible
   // Rate limit is already optimized (200ms)
   ```

3. **Profile slow operations**:
   ```bash
   # Check metrics endpoint
   curl https://your-domain.com/api/metrics

   # Look for slowest operations in response
   ```

### Issue: High memory usage

**Symptoms**:
- Server memory grows continuously
- Out of memory errors

**Solutions**:

1. **Check for memory leaks**:
   ```bash
   # Monitor memory
   curl https://your-domain.com/api/health | jq '.system.memory'
   ```

2. **Clear AI cache periodically**:
   ```typescript
   // Cache automatically cleans up old entries
   // Max 1000 items, 1 hour TTL
   ```

3. **Restart service** (temporary fix):
   ```bash
   # NuxtHub will auto-restart
   # Or manually:
   nuxthub deploy
   ```

---

## Deployment Issues

### Issue: Deployment fails with build errors

**Symptoms**:
```
Error: Build failed
  Type error: Property 'x' does not exist
```

**Solutions**:

1. **Test build locally first**:
   ```bash
   pnpm build
   npx nuxt typecheck
   ```

2. **Fix type errors**:
   - 167 pre-existing template errors are OK
   - Fix any NEW errors in your code

3. **Clean build cache**:
   ```bash
   rm -rf .nuxt .output
   pnpm build
   ```

### Issue: Environment variables missing in production

**Symptoms**:
- App works locally but fails in production
- "Missing configuration" errors

**Solutions**:

1. **Verify variables in NuxtHub dashboard**:
   - Go to Settings → Environment Variables
   - Ensure all required variables are set

2. **Redeploy after setting variables**:
   ```bash
   nuxthub deploy
   ```

3. **Check variable names match exactly**:
   - Case-sensitive
   - No typos
   - No trailing spaces

---

## Getting Help

### Debugging Tips

1. **Enable debug logging**:
   ```bash
   LOG_LEVEL=debug pnpm dev
   ```

2. **Check health endpoint**:
   ```bash
   curl https://your-domain.com/api/health | jq
   ```

3. **Review logs**:
   ```bash
   # Local
   tail -f .output/server/logs/*.log

   # Production (NuxtHub)
   nuxthub logs --tail
   ```

4. **Run type checking**:
   ```bash
   npx nuxt typecheck
   ```

5. **Run tests**:
   ```bash
   pnpm test
   ```

### Before Asking for Help

Please gather this information:

1. **Environment**:
   - Node version: `node --version`
   - pnpm version: `pnpm --version`
   - OS: macOS/Linux/Windows

2. **Error details**:
   - Full error message
   - Stack trace
   - When error occurs (startup, webhook, etc.)

3. **Configuration** (redact secrets):
   - Environment variables (without actual keys)
   - Relevant config file sections

4. **Steps to reproduce**:
   - Clear steps to reproduce the issue
   - Expected vs actual behavior

5. **Logs**:
   - Relevant log output
   - Health check response
   - Metrics endpoint output

### Support Channels

- **GitHub Issues**: [github.com/your-org/discubot/issues](https://github.com/your-org/discubot/issues)
- **Documentation**: See `docs/` directory
- **Community**: [Discord/Slack/Forum link]

---

## Common Error Messages

### `ECONNREFUSED`
**Meaning**: Cannot connect to service (database, API, etc.)
**Solution**: Verify service is running and URL is correct

### `ENOTFOUND`
**Meaning**: DNS lookup failed
**Solution**: Check domain name is correct and DNS is configured

### `ETIMEDOUT`
**Meaning**: Request timed out
**Solution**: Check network connectivity, increase timeout, or optimize operation

### `401 Unauthorized`
**Meaning**: Invalid or missing authentication
**Solution**: Verify API keys, tokens, or signatures

### `403 Forbidden`
**Meaning**: Insufficient permissions
**Solution**: Check token scopes, database sharing, or file access

### `404 Not Found`
**Meaning**: Resource doesn't exist
**Solution**: Verify IDs, URLs, or database records

### `429 Too Many Requests`
**Meaning**: Rate limit exceeded
**Solution**: Implement backoff, reduce request rate, or increase limits

### `500 Internal Server Error`
**Meaning**: Server-side error
**Solution**: Check logs, verify configuration, report bug if persistent

---

**Still having issues?** Check the documentation index in README.md or open an issue on GitHub.

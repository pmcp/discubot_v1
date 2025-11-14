# Cloudflare Workers Deployment Notes

## Issues Encountered During Deployment

### Issue 1: reflect-metadata Module Not Found
**Error**: `No such module "reflect-metadata"`

**Root Cause**: The `reflect-metadata` polyfill was required by:
- `@simplewebauthn/server` → `@peculiar/x509` → `tsyringe` → `reflect-metadata`

**Solution**: Disabled WebAuthn in `nuxt.config.ts` since Discubot doesn't use WebAuthn:
```typescript
auth: {
  webAuthn: false
}
```

### Issue 2: Global Scope Violations
**Error**: `Disallowed operation called within global scope`

**Root Cause**: Cloudflare Workers have strict constraints about what can run during module initialization:
- ❌ No async I/O (fetch, database calls)
- ❌ No setTimeout/setInterval
- ❌ No crypto random number generation

**Files Fixed**:
1. `server/plugins/jobCleanup.ts` - Was calling `cleanupOldJobs()` (async) and using `setInterval()`
2. `server/plugins/securityCheck.ts` - Plugin was marked `async`

**Solution**: Made plugins synchronous and removed global scope async operations.

## Cloudflare Workers vs Pages

**Question**: Should we use Pages instead of Workers?

**Answer**: **No, stick with Workers** because:
- ✅ Workers are designed for API endpoints and webhooks
- ✅ Workers support server-side rendering
- ✅ Workers have full access to Cloudflare runtime APIs
- ✅ NuxtHub uses Workers by default
- ❌ Pages are primarily for static sites
- ❌ Pages Functions are more limited

The deployment issues weren't because of Workers - they were because of code that violated Workers' global scope rules.

## Job Cleanup Future Implementation

Since we removed the `setInterval()` based job cleanup, you'll need to implement periodic cleanup using one of these approaches:

### Option 1: Cloudflare Cron Triggers (Recommended)

Create `wrangler.toml` in project root:
```toml
[triggers]
crons = ["0 0 * * *"]  # Daily at midnight UTC
```

Then create an endpoint to handle the cron:
```typescript
// server/routes/_cron/cleanup.get.ts
export default defineEventHandler(async (event) => {
  // Verify this is from Cloudflare Cron
  const cronHeader = getHeader(event, 'cf-cron')
  if (!cronHeader) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  // Run cleanup logic
  await cleanupOldJobs()

  return { success: true }
})
```

### Option 2: NuxtHub Scheduled Tasks

Check if NuxtHub provides built-in scheduled task support (similar to Cloudflare Workers scheduled handlers).

### Option 3: External Cron Service

Use a service like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- GitHub Actions scheduled workflows

To call your cleanup endpoint periodically.

### Option 4: Manual API Endpoint

Create an authenticated admin endpoint:
```typescript
// server/api/admin/cleanup.post.ts
export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)
  if (!user.isAdmin) {
    throw createError({ statusCode: 403 })
  }

  const result = await cleanupOldJobs()
  return result
})
```

Call it manually when needed or from a simple cron service.

## Security Checks

The `securityCheck` plugin was also disabled from running at startup. Consider:

1. Running security checks on first request instead of at startup
2. Creating an admin endpoint to view security status
3. Logging security warnings to a monitoring service

## Key Takeaways

1. **Cloudflare Workers are the right choice** for Discubot
2. **Never use async operations in global scope** - always inside handlers
3. **Never use setInterval/setTimeout in global scope** - use Cron Triggers instead
4. **Test deployments early** to catch environment-specific issues
5. **Read platform documentation** about runtime constraints

## Deployment Commands

```bash
# Deploy to production
npx nuxthub deploy

# View logs
npx nuxthub logs --tail

# Check deployment status
npx nuxthub deployments

# Open admin dashboard
npx nuxthub open
```

## Environment Variables Required

See `DEPLOYMENT.md` for full list. Key variables:
- `ANTHROPIC_API_KEY`
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- `NUXT_PUBLIC_SITE_URL`

## Additional Resources

- [Cloudflare Workers Runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/)
- [Cloudflare Workers Global Scope Limitations](https://developers.cloudflare.com/workers/runtime-apis/handlers/)
- [NuxtHub Documentation](https://hub.nuxt.com/docs)
- [Nuxt Nitro Cloudflare Preset](https://nitro.unjs.io/deploy/providers/cloudflare)
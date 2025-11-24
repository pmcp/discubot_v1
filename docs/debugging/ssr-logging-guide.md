# SSR Error Logging Guide

## What Was Added

I've added comprehensive logging to track the entire request flow when accessing the inbox page during SSR (Server-Side Rendering).

### Files Modified

1. **`app/plugins/error-logger.ts`** (NEW)
   - Global error handler that catches Vue errors, app errors, and page lifecycle events
   - Logs all errors with full stack traces and context

2. **`layers/discubot/app/pages/dashboard/[team]/discubot/inbox.vue`**
   - Step-by-step logging of page initialization
   - Tracks: imports, team context, toast, data fetching, mutations
   - Comprehensive error catching with full error details

3. **`app/composables/useTeam.ts`**
   - Logs team composable initialization
   - Tracks team slug extraction from route params
   - Logs team lookup and validation
   - **CRITICAL**: This composable throws "Team not found" error if team slug doesn't match

4. **`app/middleware/auth.ts`**
   - Logs middleware execution start/end
   - Tracks team fetching from API
   - Logs authentication state
   - Monitors team validation

## How to Use

### 1. View Server Logs

When you refresh the page at `/dashboard/time-line/discubot/inbox`, watch your **server console** (not browser console) for logs prefixed with:

- `[AUTH_MIDDLEWARE]` - Authentication and team loading
- `[USE_TEAM]` - Team context and validation
- `[INBOX SSR]` - Inbox page initialization
- `[ERROR LOGGER]` - Global error handler

### 2. Expected Flow

**Successful Request:**
```
[AUTH_MIDDLEWARE] === START ===
[AUTH_MIDDLEWARE] paramSlug: time-line
[AUTH_MIDDLEWARE] loggedIn: true
[AUTH_MIDDLEWARE] Current teams state: { length: X, teamSlugs: [...] }
[USE_TEAM] Composable called
[USE_TEAM] teamSlug computed: time-line
[USE_TEAM] teams state: { length: X, teams: [...] }
[USE_TEAM] currentTeam computed - START
[USE_TEAM] Team found: true, time-line
[INBOX SSR] === Starting inbox.vue initialization ===
[INBOX SSR] Step 1: DOMPurify imported ✓
[INBOX SSR] Step 2: cheerio imported ✓
[INBOX SSR] Step 3: Team context obtained ✓
[INBOX SSR] Step 4: Toast obtained ✓
[INBOX SSR] Step 5: useCollectionQuery succeeded ✓
[INBOX SSR] Step 6: Crouton mutate obtained ✓
```

**Failed Request - Look For:**
```
[AUTH_MIDDLEWARE] ❌ Failed to fetch teams
[USE_TEAM] ❌ TEAM NOT FOUND ERROR ❌
[INBOX SSR ERROR] ❌❌❌ CAUGHT ERROR IN INBOX PAGE ❌❌❌
[ERROR LOGGER] Vue error / App error
```

### 3. Common Issues to Check

#### Issue 1: Team Not Found
**Symptoms:**
```
[USE_TEAM] ❌ TEAM NOT FOUND ERROR ❌
requestedSlug: time-line
availableTeams: [...]
```

**Cause:** The team slug "time-line" doesn't exist in the user's teams, or teams haven't been loaded yet.

**Fix:** Check if:
- User has a team with slug "time-line"
- Auth middleware successfully fetched teams before page loads
- Teams state is properly shared between middleware and page

#### Issue 2: useCollectionQuery Fails
**Symptoms:**
```
[INBOX SSR] Step 5: Fetching inbox messages...
[INBOX SSR ERROR] ❌❌❌ CAUGHT ERROR IN INBOX PAGE ❌❌❌
```

**Cause:** Database query or Crouton composable failing during SSR.

**Fix:** Check if:
- Database connection is working
- Collection schema is correct
- Proper auth/permissions for querying

#### Issue 3: Module Import Errors
**Symptoms:**
```
[INBOX SSR] Step 1: Importing DOMPurify...
(then crashes before "DOMPurify imported ✓")
```

**Cause:** Module failing to load during SSR (DOMPurify or cheerio).

**Fix:** Check if:
- isomorphic-dompurify is properly installed
- Module is SSR-compatible

### 4. Next Steps After Identifying Error

Once you see the exact error in the logs:

1. **Copy the full error output** including:
   - Error name
   - Error message
   - Error stack
   - Context (which step failed)

2. **Share with me** or analyze:
   - Which step failed?
   - What was the error message?
   - What was the state at that point?

3. **Common fixes:**
   - Team not found → Check team slug in URL matches user's teams
   - Collection query fails → Check database/permissions
   - Import fails → Check SSR compatibility of packages

## Viewing Logs in Production (Cloudflare)

If deployed to NuxtHub/Cloudflare Workers:

```bash
# View real-time logs
npx nuxthub logs

# Or use Cloudflare dashboard
wrangler tail
```

## Example Log Analysis

Here's an example of what to look for:

```
# The error happened during team context retrieval
[INBOX SSR] Step 2: cheerio imported ✓
[INBOX SSR] Step 3: Getting team context...
[USE_TEAM] currentTeam computed - START { teamSlugValue: 'time-line', teamsLength: 0 }
[USE_TEAM] ❌ TEAM NOT FOUND ERROR ❌ { requestedSlug: 'time-line', availableTeams: [] }
```

This tells us:
- Imports succeeded (cheerio loaded)
- Problem is in useTeam composable
- Teams array is empty (teamsLength: 0)
- Requested slug "time-line" but no teams available

**Diagnosis:** Auth middleware didn't populate teams state before page loaded.

## Cleanup

Once you've identified and fixed the issue, you can remove the verbose logging:

1. Keep the error-logger.ts plugin (useful for production)
2. Remove console.log statements from:
   - useTeam.ts
   - auth.ts
   - inbox.vue

Or reduce logging to only errors/warnings.

## Current Status

✅ Logging installed and ready
✅ Server-side logs will show during page refresh
🔍 Waiting for error reproduction to identify root cause

**Next Step:** Refresh the page and check your server console for the detailed logs.

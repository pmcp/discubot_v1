# Tunnel Development Setup

## The Problem

When developing webhook integrations (Slack, Figma, etc.), external services need to reach your local development server. Tools like ngrok and Cloudflare Tunnel provide this, but **Vite blocks requests from external hosts** for security reasons:

```
Blocked request. This host ("xyz.trycloudflare.com") is not allowed.
To allow this host, add "xyz.trycloudflare.com" to `server.allowedHosts` in vite.config.js.
```

## The Solution

We use a **reverse proxy server** that sits between the tunnel and Nuxt. The proxy:
1. Accepts requests from any host (the tunnel domain)
2. Rewrites the `Host` header to `localhost:3000`
3. Forwards to Nuxt
4. Nuxt only sees `localhost` → No blocking!

```
Slack/Figma → Tunnel (https://xyz.trycloudflare.com)
            → Proxy (localhost:3001) [rewrites Host header]
            → Nuxt (localhost:3000) [sees localhost, allows request]
```

## Setup Instructions

### 1. Install Cloudflare Tunnel (One-time)

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Or download from:
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### 2. Start Development (3 Terminals)

**Terminal 1 - Nuxt Dev Server:**
```bash
pnpm dev
```
This runs on `http://localhost:3000` (standard Nuxt dev server)

**Terminal 2 - Proxy Server:**
```bash
pnpm dev:proxy
```
This starts the reverse proxy on `http://localhost:3001`

You'll see:
```
🔧 Proxy server running on http://localhost:3001
   Forwarding to: http://localhost:3000
   Point your tunnel to: http://localhost:3001
```

**Terminal 3 - Cloudflare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:3001
```

This creates a public URL like:
```
https://random-words-here.trycloudflare.com
```

**Important:** Point the tunnel to port **3001** (the proxy), NOT 3000!

### 3. Configure Webhooks

Use the Cloudflare Tunnel URL from Terminal 3 for your webhook configurations:

**Slack:**
- Go to https://api.slack.com/apps → Your App → Event Subscriptions
- Request URL: `https://your-tunnel-url.trycloudflare.com/api/webhooks/slack`

**Figma:**
- Webhook URL: `https://your-tunnel-url.trycloudflare.com/api/webhooks/figma`

**Mailgun:**
- Webhook URL: `https://your-tunnel-url.trycloudflare.com/api/webhooks/mailgun`

## How It Works Technically

### Proxy Server (`proxy-server.mjs`)

```javascript
// Accepts request from tunnel
req.headers.host = "random-words.trycloudflare.com"

// Rewrites to localhost
req.headers.host = "localhost:3000"

// Forwards to Nuxt
proxy.web(req, res) → http://localhost:3000
```

### Why Vite Blocks External Hosts

Vite (Nuxt's dev server) blocks external hosts to prevent:
- DNS rebinding attacks
- Unauthorized access to your dev server
- Security vulnerabilities during development

This is a **security feature**, not a bug!

### Why We Can't Just Configure Vite

We tried multiple approaches:
- ❌ `vite.config.ts` with `allowedHosts: 'all'` (Nuxt ignores separate Vite config)
- ❌ `nuxt.config.ts` with `vite.server.allowedHosts` (Gets overridden)
- ❌ Vite plugins to patch config (Vite checks hosts before plugins run)
- ❌ Environment variables (Not respected)
- ❌ Nuxt CLI flags (No flag to disable host checking)

The **proxy is the only reliable solution** that works across Vite versions.

## Troubleshooting

### "502 Bad Gateway" from tunnel
- Make sure `pnpm dev:proxy` is running (Terminal 2)
- Verify proxy shows: "Proxy server running on http://localhost:3001"
- Test: `curl http://localhost:3001` should return HTML

### "Blocked request" still appears
- Make sure tunnel points to **port 3001**, not 3000
- Check: `cloudflared tunnel --url http://localhost:3001` (note the 3001!)

### Tunnel URL changes on restart
- Cloudflare free tunnels use random URLs
- Update webhook URLs in Slack/Figma/etc. when tunnel restarts
- For static URLs, use Cloudflare Tunnel with an account (paid)

### Can't install cloudflared
Alternative tools (same setup, just change Terminal 3):
```bash
# ngrok (requires account)
ngrok http 3001

# localtunnel
npx localtunnel --port 3001
```

## Production Deployment

**The proxy is NOT needed in production!**

In production:
- Your app runs on a real domain (e.g., `https://yourdomain.com`)
- No Vite dev server (uses built assets)
- Webhooks point directly to your domain
- No host checking issues

The proxy is **only for local development** with tunnels.

## Files Reference

- **`proxy-server.mjs`** - Reverse proxy server implementation
- **`package.json`** - Contains `dev:proxy` script
- **`.env`** - Tunnel setup instructions (commented)

## Alternative: Production-like Development

If you need a more production-like environment without tunnels:

```bash
# Build and preview
pnpm build
pnpm preview

# Or use NuxtHub preview with remote bindings
npx nuxthub preview
```

This runs a production build locally (no Vite host checking), but you lose:
- Hot module replacement (HMR)
- Fast refresh
- Instant updates

The proxy + tunnel approach is better for active development.

## Why Not Just Use NuxtHub Deploy?

You could deploy every change to test webhooks, but:
- ❌ Slow (build + deploy cycle)
- ❌ Costs resources (even on free tier)
- ❌ Can't debug in real-time
- ❌ No console.log or breakpoints

Tunnels with proxy = instant feedback during development!

---

**Summary:** Use the 3-terminal setup (Nuxt + Proxy + Tunnel) for local webhook development. The proxy bypasses Vite's host checking cleanly without security compromises.

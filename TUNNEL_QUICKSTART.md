# Tunnel Development - Quick Start

Need to test webhooks from Slack/Figma locally? Follow these 3 steps:

## Setup (One-time)

```bash
# Install Cloudflare Tunnel
brew install cloudflare/cloudflare/cloudflared
```

## Usage (Every Time)

Open 3 terminals and run:

```bash
# Terminal 1
pnpm dev

# Terminal 2
pnpm dev:proxy

# Terminal 3
cloudflared tunnel --url http://localhost:3001
```

Copy the URL from Terminal 3 (e.g., `https://xyz.trycloudflare.com`) and use it for webhooks:

- **Slack:** `https://xyz.trycloudflare.com/api/webhooks/slack`
- **Figma:** `https://xyz.trycloudflare.com/api/webhooks/figma`

**Important:** Point tunnel to port **3001** (not 3000)!

## Why?

Vite blocks external hosts. The proxy (port 3001) bypasses this by rewriting the Host header.

📖 Full explanation: [docs/setup/tunnel-development.md](./docs/setup/tunnel-development.md)

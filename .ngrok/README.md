# ngrok Tunnel Setup for Local Slack Development

This directory contains ngrok configuration for testing Slack OAuth and webhooks locally.

## Setup (one-time)

1. **Install ngrok** (if not already):
   ```bash
   brew install ngrok
   ```

2. **Add your authtoken** to `.env.local`:
   ```bash
   # Get your token from https://dashboard.ngrok.com/get-started/your-authtoken
   NGROK_AUTHTOKEN=your_authtoken_here
   ```

3. **Create the Dev Slack App**:
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From an app manifest"
   - Select your workspace
   - Paste contents of `slack-dev-manifest.json`
   - Click "Create"
   - Go to "OAuth & Permissions" → "Install to Workspace"
   - Copy the credentials to `.env.local`:
     ```bash
     SLACK_CLIENT_ID_DEV=your_dev_client_id
     SLACK_CLIENT_SECRET_DEV=your_dev_client_secret
     SLACK_SIGNING_SECRET_DEV=your_dev_signing_secret
     ```

## Usage

Run the tunnel alongside your dev server:

```bash
# Terminal 1: Start the tunnel
pnpm tunnel

# Terminal 2: Start the dev server with tunnel URL
pnpm dev:tunnel
```

Or run both together:
```bash
pnpm dev:full
```

## URLs

- **Tunnel URL**: https://preternaturally-choosier-dodie.ngrok-free.dev
- **OAuth Callback**: https://preternaturally-choosier-dodie.ngrok-free.dev/api/oauth/slack/callback
- **Slack Webhooks**: https://preternaturally-choosier-dodie.ngrok-free.dev/api/webhooks/slack

## Switching Between Dev and Prod

The `BASE_URL` environment variable controls which URLs are used:

- **Local only**: `BASE_URL=http://localhost:3000` (default)
- **With tunnel**: `BASE_URL=https://preternaturally-choosier-dodie.ngrok-free.dev`

The `dev:tunnel` script automatically sets this for you.

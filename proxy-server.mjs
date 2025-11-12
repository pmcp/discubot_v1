/**
 * Reverse proxy server to bypass Vite's host checking for tunnels (ngrok, cloudflared, etc.)
 *
 * Problem: Vite blocks requests from external hosts for security
 * Solution: Proxy rewrites Host header to localhost before forwarding to Nuxt
 *
 * Usage:
 *   Terminal 1: pnpm dev           (Nuxt on :3000)
 *   Terminal 2: pnpm dev:proxy     (Proxy on :3001)
 *   Terminal 3: cloudflared tunnel --url http://localhost:3001
 */
import http from 'http'
import httpProxy from 'http-proxy'

const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
})

const server = http.createServer((req, res) => {
  console.log(`[proxy] ${req.method} ${req.url} - Host: ${req.headers.host}`)

  // Rewrite host header to localhost to bypass Vite's check
  req.headers.host = 'localhost:3000'

  proxy.web(req, res, (err) => {
    console.error('[proxy] Error:', err)
    res.writeHead(502)
    res.end('Bad Gateway')
  })
})

server.on('upgrade', (req, socket, head) => {
  req.headers.host = 'localhost:3000'
  proxy.ws(req, socket, head)
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`\n🔧 Proxy server running on http://localhost:${PORT}`)
  console.log(`   Forwarding to: http://localhost:3000`)
  console.log(`   Point your tunnel to: http://localhost:${PORT}\n`)
})

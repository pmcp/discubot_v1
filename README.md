# Discubot

> AI-powered discussion tracker that automatically converts Figma comments and Slack threads into actionable Notion tasks.

**Status**: Production-Ready (Phase 7 Complete)
**Version**: 1.0.0
**License**: MIT

---

## What is Discubot?

Discubot bridges the gap between where discussions happen (Figma, Slack) and where work gets tracked (Notion). It uses AI to:

- **Extract** discussion threads from Figma comments (via Mailgun webhooks) and Slack messages (via Events API)
- **Analyze** content with Claude AI to detect actionable tasks, priorities, and context
- **Create** well-structured Notion tasks with summaries, action items, and participant @mentions
- **Track** all processing through a comprehensive admin dashboard

## Key Features

### Multi-Source Integration
- **Figma** - Monitor file comments via Mailgun email webhooks
- **Slack** - Track workspace conversations via Events API with OAuth 2.0
- **Extensible** - Adapter pattern makes it easy to add new sources

### AI-Powered Analysis
- Automatic task detection (single vs multi-task discussions)
- Smart title generation and content summarization
- Priority and assignee extraction
- Participant mention resolution

### Admin Dashboard
- Real-time job monitoring with 6-stage pipeline visualization
- Source configuration management (Figma/Slack/Notion settings)
- User mapping system for proper @mentions across platforms
- Discussion and task history with full audit trails
- Manual retry for failed jobs

### Production-Ready
- **Security**: Webhook signature verification, rate limiting, input validation
- **Testing**: 235+ tests with 76% passing (42 expected failures without API keys)
- **Monitoring**: Health checks, performance metrics, structured logging
- **Database**: Full persistence with Crouton ORM, 30-day job cleanup

---

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- pnpm package manager
- NuxtHub account (for production deployment)
- Anthropic API key (Claude AI)
- Notion integration token + database
- Figma API token (for Figma integration)
- Slack app (for Slack integration)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/discubot.git
cd discubot

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Configure your environment variables (see CONFIGURATION.md)
# At minimum, set:
# - ANTHROPIC_API_KEY
# - NUXT_PUBLIC_SITE_URL
```

### Development

```bash
# Start the development server
pnpm dev

# Run tests
pnpm test

# Type checking
npx nuxt typecheck

# Lint code
pnpm lint
```

Visit `http://localhost:3000` to access the admin dashboard.

---

## Documentation

### Getting Started
- **[SETUP.md](./SETUP.md)** - Complete development setup guide
- **[CONFIGURATION.md](./CONFIGURATION.md)** - Environment variables and config options
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment to NuxtHub

### Integration Guides
- **[Figma Integration](./docs/guides/figma-integration.md)** - Full Figma setup with Mailgun
- **[Figma Quick Start](./docs/guides/figma-quick-start.md)** - 5-minute Figma testing
- **[Slack Integration](./docs/guides/slack-integration.md)** - Complete Slack setup with OAuth
- **[Slack Quick Start](./docs/guides/slack-quick-start.md)** - 5-minute Slack testing

### Technical Documentation
- **[Database Persistence](./docs/guides/database-persistence.md)** - Crouton ORM patterns
- **[Logging & Monitoring](./docs/guides/logging-monitoring.md)** - Observability setup
- **[Testing Strategy](./docs/guides/testing-strategy.md)** - Test patterns and coverage
- **[Admin UI Polish](./docs/guides/admin-ui-polish.md)** - UI/UX patterns

### Troubleshooting
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[Real-World Testing](./docs/guides/real-world-testing.md)** - Manual testing guide

---

## Architecture

Discubot is built with a modular, domain-driven architecture using Nuxt Layers:

```
layers/
├── discubot/              # Main application layer
│   ├── server/
│   │   ├── adapters/     # Source integrations (Figma, Slack)
│   │   ├── services/     # Core business logic (AI, Notion, User Mapping)
│   │   ├── utils/        # Shared utilities (retry, security, logging)
│   │   └── api/          # API endpoints (webhooks, OAuth, admin)
│   ├── app/
│   │   └── pages/        # Admin dashboard UI
│   └── collections/      # Crouton database collections (4 collections)
```

### Key Components

1. **Adapters** - Platform-specific integrations implementing `DiscussionSourceAdapter` interface
2. **Processor** - 6-stage pipeline orchestrating the full workflow
3. **Services** - AI analysis (Claude), Notion task creation, user mapping
4. **Admin UI** - Nuxt UI 4 dashboard for configuration and monitoring
5. **Database** - 4 Crouton collections: discussions, jobs, tasks, configs

### Processing Pipeline

```
1. Webhook Ingestion → 2. Config Loading → 3. Thread Building
   ↓                      ↓                   ↓
4. AI Analysis → 5. Task Creation → 6. Finalization
   (Claude)       (Notion API)        (Status updates)
```

---

## Tech Stack

- **Framework**: [Nuxt 3](https://nuxt.com/) (v3.x)
- **UI Library**: [Nuxt UI 4](https://ui.nuxt.com/) (CRITICAL: Only v4)
- **Database**: [Drizzle ORM](https://orm.drizzle.team/) + [Crouton](https://github.com/pinegrow/nuxt-crouton)
- **Hosting**: [NuxtHub](https://hub.nuxt.com/) (Cloudflare Edge)
- **AI**: [Anthropic Claude](https://www.anthropic.com/) (via @anthropic-ai/sdk)
- **Testing**: [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)
- **Package Manager**: pnpm (ALWAYS use pnpm)

---

## Development Workflow

### Making Changes

1. **Read** `CLAUDE.md` for development conventions
2. **Check** `docs/PROGRESS_TRACKER.md` for project status
3. **Run** `npx nuxt typecheck` after changes (MANDATORY)
4. **Test** your changes with `pnpm test`
5. **Commit** using conventional commit format

### Commit Format

```bash
<type>: <description>

# Examples:
git commit -m "feat: add user mapping for Slack mentions"
git commit -m "fix: resolve Figma webhook signature verification"
git commit -m "docs: update deployment guide for NuxtHub"
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

---

## Testing

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-ant-... pnpm test

# E2E tests with Playwright
pnpm test:e2e

# Watch mode
pnpm test --watch
```

**Test Coverage**: 235/309 tests passing (76%)
- 42 expected failures (missing ANTHROPIC_API_KEY in test environment)
- 32 skipped tests (E2E placeholders)

---

## Deployment

### NuxtHub (Recommended)

```bash
# Deploy to NuxtHub Edge
nuxthub deploy

# Deploy with environment variables
nuxthub deploy --env ANTHROPIC_API_KEY=sk-ant-...
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete instructions.

### Requirements
- NuxtHub account
- All environment variables configured (see CONFIGURATION.md)
- Database migrations run (`pnpm db:migrate`)
- Webhook URLs updated to production domain

---

## Monitoring

### Health Check
```bash
curl https://your-domain.com/api/health
```

Returns system health with database, AI, and Notion service status.

### Performance Metrics
```bash
curl https://your-domain.com/api/metrics
```

Returns operation durations, success rates, and performance statistics.

### Logs

Production logs are structured JSON for easy parsing:

```json
{
  "level": "info",
  "timestamp": "2025-11-14T10:30:00Z",
  "message": "Discussion processed successfully",
  "context": {
    "discussionId": "disc_123",
    "jobId": "job_456",
    "duration": 2340
  }
}
```

See **[Logging & Monitoring Guide](./docs/guides/logging-monitoring.md)** for dashboard setup.

---

## Security

- ✅ Webhook signature verification (Slack + Mailgun)
- ✅ Timestamp validation (5-minute window, prevents replay attacks)
- ✅ Rate limiting (configurable per endpoint)
- ✅ Input validation (Zod schemas)
- ✅ XSS prevention (sanitization helpers)
- ✅ SQL injection protection (Drizzle ORM parameterization)
- ✅ Environment variable security checks on startup
- ✅ HTTPS required in production (enforced by NuxtHub)

---

## Contributing

We welcome contributions! Please:

1. Read `CLAUDE.md` for code conventions
2. Follow the Nuxt UI 4 patterns (NOT v2/v3)
3. Run `npx nuxt typecheck` before committing
4. Add tests for new features
5. Use conventional commit messages

---

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/discubot/issues)
- **Documentation**: See `docs/` directory
- **Troubleshooting**: See `TROUBLESHOOTING.md`

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## Acknowledgments

Built with:
- [Nuxt](https://nuxt.com/) - The Intuitive Vue Framework
- [Nuxt UI](https://ui.nuxt.com/) - Beautiful UI components
- [Anthropic Claude](https://www.anthropic.com/) - AI-powered analysis
- [Crouton](https://github.com/pinegrow/nuxt-crouton) - Nuxt ORM
- [NuxtHub](https://hub.nuxt.com/) - Edge deployment platform

---

**Status**: ✅ Production-Ready (All 7 phases complete)
**Last Updated**: 2025-11-14
**Next Steps**: See Phase 8+ in `docs/PROGRESS_TRACKER.md` for future enhancements

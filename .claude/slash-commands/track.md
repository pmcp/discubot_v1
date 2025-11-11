---
name: track
description: Set up and manage agent activity tracking
namespace: project
---

# /track - Agent Activity Tracker

Set up and manage agent activity tracking for your project.

## Purpose

Creates a structured folder system to track all agent activities, decisions, and outputs for better project documentation and accountability.

## Folder Structure

When invoked, creates:
```
.agent-reports/
├── daily/
│   └── YYYY-MM-DD/
│       ├── summary.md
│       ├── decisions.md
│       └── agents/
│           ├── template-scout.md
│           ├── api-designer.md
│           └── [agent-name].md
├── features/
│   └── [feature-name]/
│       ├── brief.md
│       ├── implementation.md
│       ├── review.md
│       └── tests.md
├── code-smells/
│   └── YYYY-MM-DD-report.md
└── index.md  # Quick navigation
```

## Tracking Format

### Daily Summary Template
```markdown
# Daily Activity - [Date]

## Completed Tasks
- [ ] Feature: User authentication
- [ ] Fix: Navigation bug
- [ ] Refactor: API error handling

## Agents Used
| Agent | Task | Duration | Output |
|-------|------|----------|--------|
| template-scout | Found pricing template | 2 min | Adapted SaaS template |
| api-designer | Created auth endpoints | 15 min | 4 endpoints added |
| code-smell-detector | Post-build review | 5 min | 3 warnings fixed |

## Key Decisions
1. Used Nuxt UI SaaS template for pricing page
2. Implemented JWT with refresh tokens
3. Moved validation logic to server layer

## Tomorrow's Priority
- Complete test coverage for auth
- Deploy to staging
```

### Feature Documentation
```markdown
# Feature: [Name]

## Brief (from /brief)
[Original requirements and plan]

## Implementation Details
- Components created: X
- API endpoints: Y
- Database changes: Z

## Review Notes
- Code smell check: [PASS/WARNINGS]
- Test coverage: X%
- Performance impact: [metrics]

## Lessons Learned
[What worked, what didn't]
```

## Usage

### Initialize Tracking
```
/track init
```
Creates folder structure and initial templates

### Track Feature
```
/track feature "user-authentication"
```
Creates feature folder and starts documentation

### Daily Summary
```
/track daily
```
Generates daily summary from agent activities

### Generate Reports
```
/track report weekly
/track report feature "user-authentication"
```

## Auto-Tracking Rules

Automatically document when:
1. **/brief** is used → Creates feature folder
2. **@code-smell-detector** runs → Adds to code-smells/
3. **Major refactoring** → Documents in daily/
4. **Test suite runs** → Updates test coverage

## Benefits

1. **Accountability** - Know what agents did
2. **Learning** - Review decisions and patterns
3. **Documentation** - Automatic project history
4. **Debugging** - Trace back agent decisions
5. **Handoff** - Easy project transfer

## Integration with Agents

All agents should output to tracking when they:
- Make architectural decisions
- Find and adapt templates
- Detect and fix issues
- Generate significant code

Example agent integration:
```typescript
// In agent code
const trackingPath = `.agent-reports/daily/${today}/agents/${agentName}.md`
await writeReport(trackingPath, {
  task: "Created pricing component",
  source: "Nuxt UI SaaS template",
  modifications: ["Added custom tiers", "Modified styling"],
  duration: "10 minutes"
})
```

Keep your project's decision history clear and traceable.
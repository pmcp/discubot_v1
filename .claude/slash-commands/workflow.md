---
name: workflow
description: Execute complete development workflow from spec to deployment-ready code
namespace: project
---

# /workflow - Full Development Workflow

Execute a complete development workflow from specification to deployment-ready code.

## Your Role
You are a workflow orchestrator that manages the entire development lifecycle using specialized subagents.

## Workflow Stages

### Stage 1: Planning
- Use @domain-architect to design the architecture
- Create task breakdown
- Identify which layers/domains are involved

### Stage 2: Implementation
- Use @nuxt-ui-builder for UI components
- Use @api-designer for backend endpoints
- Follow the architecture plan strictly

### Stage 3: Testing
- Use @test-fixer to ensure all tests pass
- Generate new tests with /test command
- Verify E2E flows with Playwright

### Stage 4: Review
- Use @code-reviewer-proactive for final review
- Check TypeScript types
- Verify Nuxt UI 4 compliance

## Process

When user provides requirements:

1. **Brief the task** (using /brief internally)
   ```
   Task: [User's requirement]
   Complexity: [Simple/Medium/Complex]
   Domains: [Which layers involved]
   ```

2. **Create implementation plan**
   - List all components needed
   - Define API endpoints
   - Specify test requirements

3. **Execute with subagents**
   - Delegate each part to appropriate agent
   - Maintain coordination between agents
   - Track progress

4. **Quality checks**
   - All tests passing?
   - Code reviewed?
   - Documentation updated?

## Output Format

```markdown
## Workflow Execution: [Task Name]

### ✅ Planning Complete
- Architecture: [Summary]
- Domains: [List]

### ✅ Implementation Complete
- Components: [List]
- APIs: [List]
- Services: [List]

### ✅ Testing Complete
- Unit tests: [Count] passing
- E2E tests: [Count] passing

### ✅ Review Complete
- Type safety: Verified
- Patterns: Compliant
- Performance: Optimized

### 📋 Next Steps
1. [Any manual steps needed]
2. [Deployment instructions]
```

## Coordination Rules

- Never let agents overlap work
- Pass context between agents clearly
- Maintain single source of truth
- Document decisions made

This workflow ensures comprehensive, high-quality delivery for any feature.
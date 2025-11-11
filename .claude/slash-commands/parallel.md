---
name: parallel
description: Execute multiple tasks simultaneously using sub-agents
namespace: project
---

# /parallel - Parallel Task Orchestrator

Execute multiple independent tasks simultaneously using sub-agents for maximum efficiency.

## Your Role
You are a parallel execution coordinator who identifies independent tasks and delegates them to specialized sub-agents running concurrently.

## Process (Anthropic Best Practice)

### 1. Task Analysis
- Identify all required work
- Determine dependencies
- Group independent tasks

### 2. Parallel Execution Pattern
```
For maximum efficiency, whenever you need to perform multiple 
independent operations, invoke all relevant tools simultaneously 
rather than sequentially.
```

### 3. Common Parallel Patterns

#### Multi-File Analysis
When analyzing multiple files:
```
Parallel:
- @code-analyzer review auth.ts
- @security-reviewer check permissions.ts  
- @performance-auditor analyze cache.ts
```

#### Multi-Perspective Review
For comprehensive analysis:
```
Parallel:
- @product-manager define requirements
- @ux-designer create user flow
- @architect design system architecture
```

#### Cross-Domain Testing
For complete test coverage:
```
Parallel:
- Unit tests for utilities
- Integration tests for API
- E2E tests for user flows
```

## Execution Strategy

1. **Identify Parallelizable Work**
   ```markdown
   Independent Tasks:
   - [ ] Task A (no dependencies)
   - [ ] Task B (no dependencies)
   - [ ] Task C (depends on A & B)
   ```

2. **Execute in Waves**
   ```markdown
   Wave 1 (Parallel):
   - Task A
   - Task B
   
   Wave 2 (After Wave 1):
   - Task C
   ```

3. **Aggregate Results**
   ```markdown
   ## Combined Results
   - Task A: [outcome]
   - Task B: [outcome]
   - Task C: [outcome]
   ```

## Best Practices

- **Maximize Parallelism**: Always look for independent tasks
- **Clear Boundaries**: Each sub-agent should have a clear, isolated task
- **No Shared State**: Parallel tasks shouldn't modify the same files
- **Aggregate at End**: Combine results after all parallel tasks complete

## Example Usage

```
User: Review and improve the authentication module

Parallel Orchestrator:
Wave 1 (Parallel):
- Security audit of auth logic
- Performance review of token validation
- UX review of login flow
- Test coverage analysis

Wave 2 (Sequential):
- Implement security fixes
- Optimize performance bottlenecks
- Improve UX based on feedback
- Add missing tests
```

This approach can reduce a 2-hour sequential process to 30 minutes of parallel execution.
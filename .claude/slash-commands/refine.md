---
name: refine
description: Improve code quality through iterative refinement
namespace: project
---

# /refine - Iterative Refinement Assistant

Improve code quality through multiple passes of targeted refinement.

## Your Role
You are an iterative refinement specialist who improves code through systematic passes, each focusing on a specific aspect.

## Process (Claude 4 Best Practice)

### Phase 1: Understand Current State
1. Analyze the existing implementation
2. Identify areas for improvement
3. Create a refinement plan

### Phase 2: Multi-Pass Refinement
Execute these passes in sequence:

1. **Functionality Pass**
   - Ensure all features work correctly
   - Fix any bugs or edge cases
   - Add missing functionality

2. **Performance Pass**
   - Optimize algorithms
   - Reduce unnecessary computations
   - Improve caching strategies

3. **Quality Pass**
   - Improve code readability
   - Add comprehensive error handling
   - Enhance type safety

4. **Testing Pass**
   - Add missing tests
   - Improve test coverage
   - Add edge case tests

5. **Documentation Pass**
   - Update comments
   - Improve function documentation
   - Update README if needed

## Output Format

After each pass, provide:
```markdown
## Pass [N]: [Focus Area]

### Changes Made
- [Specific change 1]
- [Specific change 2]

### Impact
[How this improves the code]

### Next Steps
[What the next pass will focus on]
```

## Key Principles (from Anthropic)

- **Incremental Improvement**: Small, focused changes
- **Preserve Working Code**: Never break what works
- **Document Changes**: Clear explanation of each modification
- **Test After Each Pass**: Verify improvements don't introduce regressions

Use this approach for any code that needs polish, optimization, or enhancement.
# Legacy Config Cleanup Briefing

**Created:** 2025-11-26
**Status:** Planned
**Breaking Changes:** Acceptable (pre-production)

## Summary

The codebase has a hybrid architecture where flows are used but legacy config code remains as fallback. This creates complexity, bugs (like the eyes emoji issue), and maintenance burden. Since we're pre-production, we should remove legacy config support entirely.

## Current State

### Key Files with Legacy Code

| File | Issues |
|------|--------|
| `layers/discubot/server/services/processor.ts` | Fallback pattern (lines 898-917), deprecated `loadSourceConfig()` function, multiple flow-vs-config conditionals |
| `layers/discubot/server/api/webhooks/notion.post.ts` | Only supports legacy configs, no flows support |
| `layers/discubot/server/api/webhooks/resend.post.ts` | Has fallback pattern for both flows and configs |

### Problematic Patterns

1. **Fallback Pattern in Processor (lines 898-917)**
   ```typescript
   try {
     flowData = await loadFlow(...)
   } catch (error) {
     config = await loadSourceConfig(...)  // Falls back to legacy
   }
   ```

2. **Dual-path Conditionals** - Throughout processor.ts:
   - Line 939-947: Initial reaction config
   - Line 969-979: Source workspace ID
   - Line 1106-1114: Thread build config
   - Line 1197-1199: AI settings
   - Line 1253-1393: Entire task creation section

3. **Import Path Issues** - Two files use wrong import path:
   ```typescript
   // WRONG (currently works by accident):
   const { discubotConfigs } = await import('#layers/discubot-configs/server/database/schema')

   // CORRECT:
   const { discubotConfigs } = await import('#layers/discubot/collections/configs/server/database/schema')
   ```
   - `processor.ts` line 263
   - `notion.post.ts` line 110

## Recommended Cleanup Order

### Phase 1: Remove Fallback Pattern
1. Remove `loadSourceConfig()` function from processor.ts
2. Remove the try-catch fallback - make flows required
3. Remove all `else if (config)` branches

### Phase 2: Clean Up Conditionals
1. Replace `flowData ? ... : config` patterns with flows-only code
2. Simplify `threadBuildConfig`, `initialReactionConfig` to just use flowData

### Phase 3: Update Notion Webhook
1. Make `notion.post.ts` flow-aware
2. Remove direct legacy config loading

### Phase 4: Remove Legacy Config Collection (Optional)
1. Remove `layers/discubot/collections/configs/` if no longer needed
2. Or keep if config data needs migration to flows

## Files to Modify

- `layers/discubot/server/services/processor.ts` - Major cleanup
- `layers/discubot/server/api/webhooks/resend.post.ts` - Remove fallback
- `layers/discubot/server/api/webhooks/notion.post.ts` - Add flows support
- `layers/discubot/types/index.ts` - Remove deprecated SourceConfig type (after cleanup)

## Estimated Effort

- Phase 1: ~30 min
- Phase 2: ~45 min
- Phase 3: ~1 hour
- Phase 4: ~30 min (if needed)

## Notes

- The SourceConfig type is marked `@deprecated` but still used for adapter calls
- Consider keeping a minimal SourceConfig-like interface for adapters, built only from flowData
- The `discussion.sourceConfigId` field stores either config ID or flow input ID - consider renaming or documenting this

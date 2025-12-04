# Briefing: Improve Figma AI Analysis Quality

## Problem

When Figma comments are analyzed by AI, the summaries are poor quality because:

1. **Raw UUIDs in content**: `@Maarten Lauwaert (a36f9347-1da7-400e-9ac5-06442413f18d)` appears instead of clean `@Maarten`

2. **Bot mention not excluded**: The first @mention is the bot (triggers webhook) but AI includes it as "two team members tagged"

3. **Author context lost**: AI says "A user tags..." but we know the author is Maarten (from user mappings)

4. **Mapped users not resolved**: We have user mappings (Figma ID → Notion user name) but they're not applied to content before AI analysis

## Example

**Raw Figma comment:**
```
@Legoman @Maarten Lauwaert (a36f9347-1da7-400e-9ac5-06442413f18d) needs to make this bigger
```

**Current AI summary:**
> "A user tags two team members to request that something be made bigger"

**Expected AI summary:**
> "Maarten has asked himself to make this bigger"

## Root Causes

1. **Bracket format not cleaned**: Figma uses `@[userId:displayName]` format - the `convertMentions()` function in processor.ts doesn't handle this

2. **Bot mention not excluded in regular threads**: Only excluded in bootstrap detection, not normal processing

3. **User mapping lookup mismatch**: Mappings use email-based `sourceUserId`, but Figma API provides UUID - lookup fails

## Files to Modify

| File | What to Fix |
|------|-------------|
| `layers/discubot/server/services/processor.ts` | `convertMentions()` function (lines 938-988) - add Figma bracket format handling |
| `layers/discubot/server/services/processor.ts` | `buildThread()` - exclude bot mention, resolve author name |
| `layers/discubot/server/adapters/figma.ts` | `extractMentionsFromComment()` - already extracts mentions, needs to be used for cleaning |

## Fix Strategy

1. **Clean Figma content before AI**:
   - Strip Figma bracket format `@[uuid:displayName]` → just `@displayName`
   - Remove bot mentions from content
   - Apply user mappings: `@displayName` → `@MappedName (notion-uuid)` if mapped

2. **Enrich author context**:
   - Look up author in user mappings
   - Pass resolved author name to AI prompt

3. **Update AI prompt** (optional):
   - Add context about who the author is
   - Clarify that first mention may be the bot (exclude from "tagged users")

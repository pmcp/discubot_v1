# Housekeeping Summary - Crouton Configuration Restructuring

**Date**: 2025-11-12
**Task**: Reorganize crouton config and schemas, rename collections to single words, rename layer to discubot

---

## Changes Made

### 1. Folder Structure

**Before:**
```
/
├── schemas/
│   ├── discussion-schema.json
│   ├── source-config-schema.json
│   ├── sync-job-schema.json
│   └── task-schema.json
└── crouton.config.mjs
```

**After:**
```
/crouton/
├── crouton.config.mjs
└── schemas/
    ├── discussion-schema.json
    ├── config-schema.json    ← renamed
    ├── job-schema.json        ← renamed
    └── task-schema.json
```

### 2. Collection Naming (Single Words)

| Old Name | New Name | Reason |
|----------|----------|--------|
| `discussions` | `discussions` | Already single word ✓ |
| `sourceConfigs` | `configs` | Simplified to single word |
| `syncJobs` | `jobs` | Simplified to single word |
| `tasks` | `tasks` | Already single word ✓ |

### 3. Schema File Naming

| Old File | New File |
|----------|----------|
| `discussion-schema.json` | `discussion-schema.json` (unchanged) |
| `source-config-schema.json` | `config-schema.json` |
| `sync-job-schema.json` | `job-schema.json` |
| `task-schema.json` | `task-schema.json` (unchanged) |

### 4. Layer Name Change

**Before:** `layer: 'discussion'`
**After:** `layer: 'discubot'`

### 5. refTarget Updates in Schema Files

All `refTarget` values updated to match new collection names:

**discussion-schema.json:**
- `"refTarget": "sourceconfigs"` → `"refTarget": "configs"`
- `"refTarget": "syncjobs"` → `"refTarget": "jobs"`

**job-schema.json:**
- `"refTarget": "sourceconfigs"` → `"refTarget": "configs"`

**task-schema.json:**
- `"refTarget": "syncjobs"` → `"refTarget": "jobs"`

### 6. Updated crouton.config.mjs

```javascript
export default {
  collections: [
    { name: 'discussions', fieldsFile: './schemas/discussion-schema.json' },
    { name: 'configs', fieldsFile: './schemas/config-schema.json' },
    { name: 'jobs', fieldsFile: './schemas/job-schema.json' },
    { name: 'tasks', fieldsFile: './schemas/task-schema.json' }
  ],

  targets: [
    {
      layer: 'discubot',
      collections: [
        'discussions',
        'configs',
        'jobs',
        'tasks'
      ]
    }
  ],

  // ... rest of config
}
```

---

## Comparison with Reference (bookings-crouton-config)

### Similarities Achieved

✅ **Single-word collection names** (matches bookings: `bookings`, `locations`, `emailTemplates`)
✅ **Schema files use kebab-case** (config-schema.json, job-schema.json)
✅ **Config and schemas organized in dedicated folder** (`/crouton/`)
✅ **Layer name matches project domain** (`discubot` vs `bookings`)

### Key Differences Found

The bookings config showed us:
1. Consistent naming patterns (single words preferred)
2. Clean folder organization (config + schemas together)
3. Layer name matching primary domain concept
4. Simple, readable refTarget values

---

## Files Modified

### New Files Created
- `/crouton/crouton.config.mjs`
- `/crouton/schemas/discussion-schema.json`
- `/crouton/schemas/config-schema.json`
- `/crouton/schemas/job-schema.json`
- `/crouton/schemas/task-schema.json`

### Files Deleted
- `/schemas/` (entire directory removed)
- `/crouton.config.mjs` (old location)

### Documentation Updates Needed

⚠️ **IMPORTANT**: The following documentation files contain outdated references and should be updated:

1. `/docs/briefings/discubot-crouton-schemas.md`
   - Still references `sourceConfigs`, `syncJobs`
   - Still shows `layer: 'discussion'`
   - Contains outdated file paths
   - **Recommendation**: Comprehensive rewrite to match new structure

2. `/docs/briefings/discubot-architecture-brief.md`
   - May contain references to old collection names
   - Should verify and update if needed

3. `/docs/briefings/discubot-implementation-roadmap.md`
   - May reference old paths and collection names
   - Should verify and update task descriptions

4. `/docs/briefings/discubot-architecture-decisions.md`
   - May need updates to reflect naming decisions
   - Should document reasons for single-word naming choice

---

## Next Steps

### Immediate (Before Regenerating)

1. **Update generator command references**:
   ```bash
   # Old (won't work anymore)
   pnpm crouton generate --config ./crouton.config.mjs

   # New (correct path)
   pnpm crouton generate --config ./crouton/crouton.config.mjs
   ```

2. **If you have existing generated layers**, delete them:
   ```bash
   rm -rf layers/discussion/
   ```

3. **Regenerate with new config**:
   ```bash
   pnpm crouton generate --config ./crouton/crouton.config.mjs
   ```

   Expected output: `layers/discubot/collections/{discussions,configs,jobs,tasks}/...`

### Documentation Updates (Recommended)

1. Create a simplified version of `discubot-crouton-schemas.md` focused on the 4 collections
2. Update all references from `discussion` layer to `discubot`
3. Update file path examples to use `/crouton/` directory
4. Add a "Migration Notes" section explaining the name changes

---

## Benefits of This Reorganization

### Clarity
- ✅ Single-word names are easier to type and remember
- ✅ `configs` and `jobs` are more intuitive than `sourceConfigs` and `syncJobs`
- ✅ Layer name `discubot` immediately identifies the project

### Consistency
- ✅ Matches industry best practices (see bookings-crouton-config)
- ✅ Follows Nuxt conventions for simple, clean naming
- ✅ All collection names now consistent (no camelCase mixing)

### Maintainability
- ✅ Grouped config and schemas in dedicated `/crouton/` folder
- ✅ Easier to locate and modify configuration files
- ✅ Clear separation from application code

### Generated Code Quality
- ✅ Simpler API endpoints: `/api/teams/[id]/configs` vs `/api/teams/[id]/sourceConfigs`
- ✅ Cleaner composable names: `useConfigs` vs `useSourceConfigs`
- ✅ More readable database table names: `configs` vs `sourceConfigs`

---

## Validation Checklist

Before regenerating, verify:

- [ ] `/crouton/crouton.config.mjs` exists and is valid
- [ ] All schema files exist in `/crouton/schemas/`
- [ ] Old `/schemas/` directory is deleted
- [ ] Old `/crouton.config.mjs` is deleted
- [ ] All `refTarget` values use new collection names
- [ ] `layer` is set to `'discubot'`
- [ ] All `fieldsFile` paths are correct (`./schemas/...`)

After regenerating:

- [ ] Layer generated at `/layers/discubot/`
- [ ] All 4 collections present: `discussions`, `configs`, `jobs`, `tasks`
- [ ] Run `npx nuxt typecheck` with no errors
- [ ] Check generated composables use new names (`useConfigs`, `useJobs`)
- [ ] Verify API routes match new names

---

**Status**: ✅ Complete
**Old files removed**: Yes
**New structure in place**: Yes
**Ready for regeneration**: Yes
**Documentation updates needed**: Yes (manual update required)
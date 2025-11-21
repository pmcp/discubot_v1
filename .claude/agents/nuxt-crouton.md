---
name: nuxt-crouton
description: Generate and manage Nuxt-Crouton collections, schemas, and database operations
tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
---

# Nuxt-Crouton Collection Specialist

Manage Nuxt-Crouton collections: generate, configure, run migrations, and maintain schemas.

## What is Nuxt-Crouton?

Nuxt-Crouton is a collection generator for Nuxt that creates:
- Database schema definitions (JSON)
- API endpoints (CRUD operations)
- Vue components (List, Form, Detail)
- TypeScript types
- Database migrations

It supports:
- SQLite, PostgreSQL, MySQL
- Team-based multi-tenancy
- External connectors (SuperSaaS, etc.)
- Nuxt Layers architecture

## Project Configuration

**Location**: `/crouton/crouton.config.mjs`

```javascript
export default {
  // Collections to generate
  collections: [
    { name: 'discussions', fieldsFile: './schemas/discussion-schema.json' },
    { name: 'configs', fieldsFile: './schemas/config-schema.json' },
    // ... more collections
  ],

  // Target layers
  targets: [{
    layer: 'discubot',
    collections: ['discussions', 'configs', 'jobs', 'tasks']
  }],

  // Database
  dialect: 'sqlite',  // or 'postgresql', 'mysql'

  // External connectors
  connectors: {
    users: {
      type: 'supersaas',
      autoInstall: true,
      copyFiles: true,
      updateAppConfig: true
    }
  },

  // Generation flags
  flags: {
    useTeamUtility: true,    // Team-based multi-tenancy
    useMetadata: true,        // createdAt/updatedAt
    autoRelations: true,      // Generate relation stubs
    autoConnectors: true,     // Auto-configure connectors
    force: false,             // Don't overwrite existing
    noTranslations: false,    // Enable i18n
    noDb: false,              // Generate DB schema
    dryRun: false,            // Actually generate
    useMaps: false            // No geocoding
  }
}
```

## Schema Files

**Location**: `/crouton/schemas/*.json`

### Basic Schema Structure

```json
{
  "name": "discussions",
  "fields": [
    {
      "name": "sourceId",
      "type": "string",
      "required": true,
      "indexed": true
    },
    {
      "name": "summary",
      "type": "text",
      "required": false
    },
    {
      "name": "threadData",
      "type": "json",
      "required": false
    },
    {
      "name": "processed",
      "type": "boolean",
      "required": true,
      "default": false
    }
  ],
  "relations": [
    {
      "name": "config",
      "type": "belongsTo",
      "model": "configs",
      "foreignKey": "configId"
    }
  ]
}
```

### Field Types

```javascript
// Text types
"string"      // VARCHAR(255)
"text"        // TEXT (unlimited)
"richtext"    // TEXT with rich formatting

// Numbers
"integer"     // INT
"float"       // FLOAT
"decimal"     // DECIMAL

// Boolean
"boolean"     // BOOLEAN

// Dates
"date"        // DATE
"datetime"    // DATETIME
"timestamp"   // TIMESTAMP

// JSON
"json"        // JSON field

// Relations
"belongsTo"   // Foreign key relation
"hasMany"     // One-to-many relation
"hasOne"      // One-to-one relation

// Special
"email"       // Email with validation
"url"         // URL with validation
"enum"        // Enum type
```

### Field Options

```json
{
  "name": "status",
  "type": "enum",
  "required": true,
  "default": "pending",
  "options": ["pending", "processing", "completed", "failed"],
  "indexed": true,
  "unique": false,
  "comment": "Processing status of the discussion"
}
```

### Relations

```json
{
  "relations": [
    {
      "name": "config",
      "type": "belongsTo",
      "model": "configs",
      "foreignKey": "configId",
      "required": true
    },
    {
      "name": "tasks",
      "type": "hasMany",
      "model": "tasks",
      "foreignKey": "discussionId"
    }
  ]
}
```

## Common Commands

### Generate Collections

```bash
# Generate all collections from config
pnpm crouton generate

# Generate specific collection
pnpm crouton generate discussions

# Dry run (preview without creating)
pnpm crouton generate --dry-run

# Force overwrite existing files
pnpm crouton generate --force
```

### Database Migrations

```bash
# Generate migration from schema changes
pnpm crouton migrate:generate

# Run pending migrations
pnpm crouton migrate:run

# Rollback last migration
pnpm crouton migrate:rollback

# Check migration status
pnpm crouton migrate:status
```

### Schema Operations

```bash
# Validate schema files
pnpm crouton schema:validate

# Show schema diff
pnpm crouton schema:diff

# Export schema as SQL
pnpm crouton schema:export
```

## Generated File Structure

```
layers/discubot/
├── collections/
│   ├── discussions/
│   │   ├── server/
│   │   │   └── api/
│   │   │       └── teams/[id]/discubot-discussions/
│   │   │           ├── index.get.ts       # List
│   │   │           ├── index.post.ts      # Create
│   │   │           ├── [discussionId].get.ts    # Read
│   │   │           ├── [discussionId].patch.ts  # Update
│   │   │           └── [discussionId].delete.ts # Delete
│   │   ├── app/
│   │   │   └── components/
│   │   │       ├── List.vue      # List component
│   │   │       ├── Form.vue      # Form component
│   │   │       └── Detail.vue    # Detail component (optional)
│   │   └── types/
│   │       └── index.ts          # TypeScript types
│   └── [other-collections]/
└── types/
    └── index.ts                  # Shared types
```

## Workflow for Adding a New Collection

### Step 1: Create Schema File

```bash
# Create schema file
touch crouton/schemas/new-collection-schema.json
```

Example schema:

```json
{
  "name": "userMappings",
  "fields": [
    {
      "name": "sourceType",
      "type": "enum",
      "required": true,
      "options": ["slack", "figma", "email"],
      "indexed": true
    },
    {
      "name": "sourceUserId",
      "type": "string",
      "required": true,
      "indexed": true
    },
    {
      "name": "sourceUserName",
      "type": "string",
      "required": false
    },
    {
      "name": "notionUserId",
      "type": "string",
      "required": true
    },
    {
      "name": "active",
      "type": "boolean",
      "required": true,
      "default": true
    }
  ],
  "relations": [
    {
      "name": "config",
      "type": "belongsTo",
      "model": "configs",
      "foreignKey": "configId",
      "required": true
    }
  ],
  "indexes": [
    {
      "fields": ["sourceType", "sourceUserId"],
      "unique": true
    }
  ]
}
```

### Step 2: Update Config

Edit `crouton/crouton.config.mjs`:

```javascript
export default {
  collections: [
    // ... existing collections
    { name: 'userMappings', fieldsFile: './schemas/user-mapping-schema.json' }
  ],

  targets: [{
    layer: 'discubot',
    collections: [
      // ... existing
      'userMappings'
    ]
  }]
}
```

### Step 3: Generate Collection

```bash
# Generate the collection files
pnpm crouton generate userMappings

# Review generated files
# Check: layers/discubot/collections/userMappings/
```

### Step 4: Run Migrations

```bash
# Generate migration
pnpm crouton migrate:generate

# Apply migration
pnpm crouton migrate:run
```

### Step 5: Verify

```bash
# Check that API endpoints work
curl http://localhost:3000/api/teams/TEAM_ID/discubot-usermappings

# Run typecheck
npx nuxt typecheck
```

## Modifying Existing Collections

### Step 1: Update Schema

Edit the schema JSON file:

```json
{
  "name": "discussions",
  "fields": [
    // ... existing fields
    {
      "name": "priority",      // NEW FIELD
      "type": "enum",
      "required": false,
      "options": ["low", "medium", "high"],
      "default": "medium"
    }
  ]
}
```

### Step 2: Regenerate (if needed)

```bash
# Usually DON'T regenerate if you have custom code
# Instead, manually update the affected files

# But if you need to regenerate components:
pnpm crouton generate discussions --force

# WARNING: This will overwrite customizations!
```

### Step 3: Create Migration

```bash
# Generate migration for schema change
pnpm crouton migrate:generate

# Review the migration file
# Then apply it
pnpm crouton migrate:run
```

## Common Patterns

### Team-Scoped Collections

All collections are automatically team-scoped when `useTeamUtility: true`:

```typescript
// API automatically includes teamId in queries
const discussions = await $fetch('/api/teams/TEAM_ID/discubot-discussions')

// Crouton handles the filtering
// No need to manually add teamId filters
```

### JSON Fields

Store complex data in JSON fields:

```json
{
  "name": "metadata",
  "type": "json",
  "required": false
}
```

Usage:

```typescript
await $fetch('/api/teams/TEAM_ID/discubot-discussions', {
  method: 'POST',
  body: {
    sourceId: 'slack-123',
    metadata: {
      channel: '#design',
      author: 'john',
      mentions: ['@jane', '@bob']
    }
  }
})
```

### Relations

```typescript
// belongsTo relation
const discussion = await $fetch('/api/teams/TEAM_ID/discubot-discussions/DISC_ID')
// discussion.config is automatically loaded (if configured)

// hasMany relation
const config = await $fetch('/api/teams/TEAM_ID/discubot-configs/CONFIG_ID')
// config.discussions contains all related discussions
```

## Troubleshooting

### Generated files missing

```bash
# Check config is correct
cat crouton/crouton.config.mjs

# Try regenerating
pnpm crouton generate --force

# Check output for errors
```

### Migration fails

```bash
# Check migration status
pnpm crouton migrate:status

# Rollback if needed
pnpm crouton migrate:rollback

# Fix the issue
# Regenerate migration
pnpm crouton migrate:generate

# Try again
pnpm crouton migrate:run
```

### Type errors after generation

```bash
# Run Nuxt prepare to regenerate types
npx nuxt prepare

# Run typecheck
npx nuxt typecheck

# If errors persist, check schema definitions
```

### API endpoints not working

```bash
# Check server is running
pnpm dev

# Check API endpoint path
# Should be: /api/teams/[teamId]/discubot-[collectionName]

# Check team ID is valid
# Check authentication middleware
```

## Best Practices

1. **Always validate schemas** before generating:
   ```bash
   pnpm crouton schema:validate
   ```

2. **Use migrations** for schema changes (don't manually edit DB)

3. **Don't regenerate** collections with heavy customizations

4. **Backup before force regenerate**:
   ```bash
   cp -r layers/discubot/collections/discussions layers/discubot/collections/discussions.backup
   ```

5. **Use indexed fields** for frequently queried columns:
   ```json
   { "name": "sourceId", "type": "string", "indexed": true }
   ```

6. **Add relations** for data integrity:
   ```json
   {
     "name": "config",
     "type": "belongsTo",
     "model": "configs",
     "foreignKey": "configId",
     "required": true
   }
   ```

7. **Run typecheck** after generation:
   ```bash
   npx nuxt typecheck
   ```

## Completion Checklist

When working with Crouton collections:

- [ ] Schema file created/updated in `crouton/schemas/`
- [ ] Config updated in `crouton/crouton.config.mjs`
- [ ] Schema validated: `pnpm crouton schema:validate`
- [ ] Collection generated: `pnpm crouton generate [name]`
- [ ] Migration created: `pnpm crouton migrate:generate`
- [ ] Migration applied: `pnpm crouton migrate:run`
- [ ] Types regenerated: `npx nuxt prepare`
- [ ] Typecheck passes: `npx nuxt typecheck`
- [ ] API endpoints tested
- [ ] Components verified (List, Form, Detail)

---

**Remember**: Crouton generates boilerplate - you'll customize components and API endpoints for your specific needs!
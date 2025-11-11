export default {
  // Define all collections (4 total - lean approach)
  collections: [
    { name: 'discussions', fieldsFile: './schemas/discussion-schema.json' },
    { name: 'sourceconfigs', fieldsFile: './schemas/source-config-schema.json' },
    { name: 'syncjobs', fieldsFile: './schemas/sync-job-schema.json' },
    { name: 'tasks', fieldsFile: './schemas/task-schema.json' }
  ],

  // Organize into layers
  targets: [
    {
      layer: 'discussion-collections',  // Renamed for clarity
      collections: [
        'discussions',
        'sourceconfigs',
        'syncjobs',
        'tasks'
      ]
    }
  ],

  // Database dialect
  dialect: 'sqlite',

  // External connectors for :referenced collections
  connectors: {
    users: {
      type: 'supersaas',        // SuperSaaS team-based user management
      autoInstall: true,         // Install @friendlyinternet/nuxt-crouton-connector
      copyFiles: true,           // Copy connector files to project
      updateAppConfig: true      // Auto-register in app.config.ts
    }
  },

  // Generation flags
  flags: {
    useTeamUtility: true,    // CRITICAL: Enable team-based multi-tenancy
    useMetadata: true,       // Add createdAt/updatedAt timestamps
    autoRelations: true,     // Generate relation stubs
    autoConnectors: true,    // Auto-configure connectors without prompting
    force: false,            // Don't overwrite existing files
    noTranslations: false,   // Enable i18n (optional, can set to true)
    noDb: false,             // Generate database schema
    dryRun: false,           // Actually generate files
    useMaps: false           // No geocoding needed
  }
}

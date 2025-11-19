<template>
  <CroutonCollection
    :layout="layout"
    collection="discubotConfigs"
    :columns="enhancedColumns"
    :rows="configs || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscubotConfigs"
        :collection="'discubotConfigs'"
        createButton
      />
    </template>

    <!-- Custom cell for OAuth Status -->
    <template #cell-oauthStatus="{ row }">
      <div class="flex items-center gap-2">
        <span
          v-if="hasOAuthConnection(row)"
          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success text-xs font-medium"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          OAuth Connected
        </span>
        <span
          v-else
          class="text-xs text-muted-foreground"
        >
          Not Connected
        </span>
      </div>
    </template>

    <!-- Custom cell for Workspace Name -->
    <template #cell-workspaceName="{ row }">
      <div class="text-sm">
        <span v-if="getWorkspaceName(row)" class="font-medium">
          {{ getWorkspaceName(row) }}
        </span>
        <span v-else class="text-muted-foreground text-xs">
          —
        </span>
      </div>
    </template>

    <!-- Custom cell for Last Updated -->
    <template #cell-lastUpdated="{ row }">
      <div class="text-xs text-muted-foreground">
        {{ formatDate(row.updatedAt) }}
      </div>
    </template>
  </CroutonCollection>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscubotConfigs()

const { items: configs, pending } = await useCollectionQuery(
  'discubotConfigs'
)

// Helper to check if config has OAuth connection
const hasOAuthConnection = (config: any) => {
  return config.sourceType === 'slack' &&
         config.sourceMetadata &&
         config.sourceMetadata?.slackTeamId
}

// Helper to get workspace name from sourceMetadata
const getWorkspaceName = (config: any) => {
  if (!hasOAuthConnection(config)) return null
  return config.sourceMetadata?.slackTeamName || 'Connected Workspace'
}

// Helper to format date
const formatDate = (date: Date | string | number | null | undefined) => {
  if (!date) return '—'
  const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Enhanced columns with OAuth status, workspace name, and last updated
const enhancedColumns = computed(() => {
  // Get the base columns and filter to show only relevant ones
  const relevantColumns = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'sourceType', header: 'Source Type' },
    { key: 'oauthStatus', header: 'OAuth Status' },
    { key: 'workspaceName', header: 'Workspace' },
    { accessorKey: 'active', header: 'Active' },
    { accessorKey: 'lastUpdated', header: 'Last Updated' }
  ]

  return relevantColumns
})
</script>
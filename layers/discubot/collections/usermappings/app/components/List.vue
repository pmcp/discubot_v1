<template>
  <div class="space-y-4">
    <!-- Filters -->
    <div class="flex flex-wrap gap-3 items-center">
      <USelectMenu
        v-model="selectedSourceType"
        :options="sourceTypeOptions"
        placeholder="All Sources"
        class="w-40"
      />

      <USelectMenu
        v-model="selectedMappingType"
        :options="mappingTypeOptions"
        placeholder="All Types"
        class="w-40"
      />

      <USwitch
        v-model="showInactiveOnly"
        label="Inactive Only"
      />

      <div class="flex-1" />

      <UButton
        color="gray"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        @click="refresh"
        :loading="pending"
      >
        Refresh
      </UButton>

      <UButton
        color="gray"
        variant="ghost"
        icon="i-lucide-filter-x"
        @click="clearFilters"
        v-if="hasActiveFilters"
      >
        Clear Filters
      </UButton>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="p-4 bg-muted/50 rounded-lg">
        <div class="text-sm text-muted-foreground">Total Mappings</div>
        <div class="text-2xl font-semibold">{{ stats.total }}</div>
      </div>
      <div class="p-4 bg-blue-500/10 rounded-lg">
        <div class="text-sm text-blue-600 dark:text-blue-400">Slack</div>
        <div class="text-2xl font-semibold text-blue-600 dark:text-blue-400">{{ stats.slack }}</div>
      </div>
      <div class="p-4 bg-purple-500/10 rounded-lg">
        <div class="text-sm text-purple-600 dark:text-purple-400">Figma</div>
        <div class="text-2xl font-semibold text-purple-600 dark:text-purple-400">{{ stats.figma }}</div>
      </div>
      <div class="p-4 bg-amber-500/10 rounded-lg">
        <div class="text-sm text-amber-600 dark:text-amber-400">Inactive</div>
        <div class="text-2xl font-semibold text-amber-600 dark:text-amber-400">{{ stats.inactive }}</div>
      </div>
    </div>

    <!-- Collection Table -->
    <CroutonCollection
      :layout="layout"
      collection="discubotUserMappings"
      :columns="columns"
      :rows="filteredMappings"
      :loading="pending"
    >
      <template #header>
        <CroutonTableHeader
          title="User Mappings"
          :collection="'discubotUserMappings'"
          createButton
        >
          <template #actions>
            <UButton
              color="primary"
              variant="outline"
              icon="i-lucide-upload"
              @click="showBulkImportModal = true"
            >
              Bulk Import
            </UButton>
          </template>
        </CroutonTableHeader>
      </template>
    </CroutonCollection>

    <!-- Bulk Import Modal -->
    <UModal v-model="showBulkImportModal">
      <template #content="{ close }">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">Bulk Import User Mappings</h3>

          <div class="space-y-4">
            <div>
              <p class="text-sm text-muted-foreground mb-3">
                Import multiple user mappings at once. Paste JSON array below.
              </p>

              <div class="bg-muted/30 p-3 rounded text-xs font-mono mb-3">
                <div class="text-muted-foreground mb-1">Example JSON format:</div>
                <pre>{{ bulkImportExample }}</pre>
              </div>
            </div>

            <UFormField label="Import Data" description="Paste JSON array of mappings">
              <UTextarea
                v-model="bulkImportData"
                :rows="12"
                class="font-mono text-sm"
                placeholder='[{"sourceType": "slack", "sourceUserId": "U123ABC", ...}]'
              />
            </UFormField>

            <div v-if="bulkImportErrors.length > 0" class="p-3 bg-red-500/10 rounded">
              <p class="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                Import Errors:
              </p>
              <ul class="text-xs text-red-600 dark:text-red-400 space-y-1 list-disc list-inside">
                <li v-for="(error, i) in bulkImportErrors.slice(0, 5)" :key="i">
                  {{ error }}
                </li>
                <li v-if="bulkImportErrors.length > 5" class="italic">
                  ...and {{ bulkImportErrors.length - 5 }} more errors
                </li>
              </ul>
            </div>

            <div v-if="bulkImportSuccess" class="p-3 bg-green-500/10 rounded">
              <p class="text-sm font-medium text-green-600 dark:text-green-400">
                Successfully imported {{ bulkImportSuccess.imported }} of {{ bulkImportSuccess.total }} mappings
                <span v-if="bulkImportSuccess.failed > 0">
                  ({{ bulkImportSuccess.failed }} failed)
                </span>
              </p>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <UButton
              color="gray"
              variant="ghost"
              @click="closeBulkImportModal"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              @click="handleBulkImport"
              :loading="bulkImportLoading"
              :disabled="!bulkImportData.trim()"
            >
              Import
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscubotUserMappings()
const { currentTeam } = useTeam()
const toast = useToast()

const { items: usermappings, pending, refresh } = await useCollectionQuery(
  'discubotUserMappings'
)

// Filter state
const selectedSourceType = ref<string | null>(null)
const selectedMappingType = ref<string | null>(null)
const showInactiveOnly = ref(false)

// Filter options
const sourceTypeOptions = [
  { label: 'All Sources', value: null },
  { label: 'Slack', value: 'slack' },
  { label: 'Figma', value: 'figma' }
]

const mappingTypeOptions = [
  { label: 'All Types', value: null },
  { label: 'Manual', value: 'manual' },
  { label: 'Auto (Email)', value: 'auto-email' },
  { label: 'Auto (Name)', value: 'auto-name' },
  { label: 'Imported', value: 'imported' }
]

// Computed: check if filters are active
const hasActiveFilters = computed(() => {
  return selectedSourceType.value !== null ||
         selectedMappingType.value !== null ||
         showInactiveOnly.value
})

// Clear all filters
const clearFilters = () => {
  selectedSourceType.value = null
  selectedMappingType.value = null
  showInactiveOnly.value = false
}

// Computed: filtered mappings
const filteredMappings = computed(() => {
  if (!usermappings.value) return []

  let filtered = [...usermappings.value]

  // Filter by source type
  if (selectedSourceType.value) {
    filtered = filtered.filter(m => m.sourceType === selectedSourceType.value)
  }

  // Filter by mapping type
  if (selectedMappingType.value) {
    filtered = filtered.filter(m => m.mappingType === selectedMappingType.value)
  }

  // Filter by active status
  if (showInactiveOnly.value) {
    filtered = filtered.filter(m => !m.active)
  }

  return filtered
})

// Computed: statistics
const stats = computed(() => {
  const all = usermappings.value || []
  return {
    total: all.length,
    slack: all.filter(m => m.sourceType === 'slack').length,
    figma: all.filter(m => m.sourceType === 'figma').length,
    inactive: all.filter(m => !m.active).length
  }
})

// Bulk import state
const showBulkImportModal = ref(false)
const bulkImportData = ref('')
const bulkImportLoading = ref(false)
const bulkImportErrors = ref<string[]>([])
const bulkImportSuccess = ref<any>(null)

// Bulk import example
const bulkImportExample = JSON.stringify([
  {
    sourceType: 'slack',
    sourceUserId: 'U123ABC456',
    sourceUserEmail: 'john@example.com',
    sourceUserName: 'John Doe',
    notionUserId: '123e4567-e89b-12d3-a456-426614174000',
    notionUserName: 'John Doe',
    notionUserEmail: 'john@example.com'
  }
], null, 2)

// Handle bulk import
const handleBulkImport = async () => {
  if (!currentTeam.value?.id) {
    toast.add({
      title: 'Error',
      description: 'No team selected',
      color: 'error'
    })
    return
  }

  bulkImportLoading.value = true
  bulkImportErrors.value = []
  bulkImportSuccess.value = null

  try {
    // Parse JSON
    const mappings = JSON.parse(bulkImportData.value)

    if (!Array.isArray(mappings)) {
      throw new Error('Data must be a JSON array')
    }

    // Call bulk import API
    const response = await $fetch<any>('/api/user-mappings/bulk-import', {
      method: 'POST',
      body: {
        teamId: currentTeam.value.id,
        mappings
      }
    })

    bulkImportSuccess.value = response

    if (response.failed > 0) {
      bulkImportErrors.value = response.errors || []
    }

    // Refresh the list
    await refresh()

    toast.add({
      title: 'Success',
      description: `Imported ${response.imported} of ${response.total} mappings`,
      color: 'success'
    })

    // Clear form if all successful
    if (response.failed === 0) {
      bulkImportData.value = ''
    }
  } catch (error: any) {
    console.error('Bulk import failed:', error)

    if (error instanceof SyntaxError) {
      bulkImportErrors.value = ['Invalid JSON format. Please check your syntax.']
    } else {
      bulkImportErrors.value = [error.data?.message || error.message || 'Import failed']
    }

    toast.add({
      title: 'Error',
      description: bulkImportErrors.value[0],
      color: 'error'
    })
  } finally {
    bulkImportLoading.value = false
  }
}

// Close bulk import modal
const closeBulkImportModal = () => {
  showBulkImportModal.value = false
  bulkImportData.value = ''
  bulkImportErrors.value = []
  bulkImportSuccess.value = null
}
</script>
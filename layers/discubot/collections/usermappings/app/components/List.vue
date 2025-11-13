<template>
  <div class="space-y-4">
    <!-- Filters -->
    <div class="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
      <USelectMenu
        v-model="selectedSourceType"
        :options="sourceTypeOptions"
        placeholder="All Sources"
        class="w-full sm:w-40"
        aria-label="Filter by source type"
      />

      <USelectMenu
        v-model="selectedMappingType"
        :options="mappingTypeOptions"
        placeholder="All Types"
        class="w-full sm:w-40"
        aria-label="Filter by mapping type"
      />

      <div class="flex items-center gap-2">
        <USwitch
          v-model="showInactiveOnly"
          id="inactive-filter"
          aria-label="Show inactive mappings only"
        />
        <label for="inactive-filter" class="text-sm text-muted-foreground cursor-pointer">
          Inactive Only
        </label>
      </div>

      <div class="flex-1 hidden sm:block" />

      <div class="flex gap-2 w-full sm:w-auto">
        <UButton
          color="gray"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          @click="refresh"
          :loading="pending"
          :disabled="pending"
          aria-label="Refresh user mappings"
          class="flex-1 sm:flex-none"
        >
          <span class="hidden sm:inline">Refresh</span>
        </UButton>

        <UButton
          color="gray"
          variant="ghost"
          icon="i-lucide-filter-x"
          @click="clearFilters"
          v-if="hasActiveFilters"
          aria-label="Clear all filters"
          class="flex-1 sm:flex-none"
        >
          <span class="hidden sm:inline">Clear Filters</span>
        </UButton>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4" role="region" aria-label="User mapping statistics">
      <!-- Loading Skeletons -->
      <template v-if="pending">
        <div v-for="i in 4" :key="i" class="p-4 bg-muted/50 rounded-lg animate-pulse">
          <div class="h-4 bg-muted rounded w-24 mb-2"></div>
          <div class="h-8 bg-muted rounded w-16"></div>
        </div>
      </template>

      <!-- Stats Cards -->
      <template v-else>
        <div class="p-3 sm:p-4 bg-muted/50 rounded-lg transition-all hover:shadow-md">
          <div class="text-xs sm:text-sm text-muted-foreground">Total Mappings</div>
          <div class="text-xl sm:text-2xl font-semibold mt-1">{{ stats.total }}</div>
        </div>
        <div class="p-3 sm:p-4 bg-blue-500/10 rounded-lg transition-all hover:shadow-md">
          <div class="text-xs sm:text-sm text-blue-600 dark:text-blue-400">Slack</div>
          <div class="text-xl sm:text-2xl font-semibold text-blue-600 dark:text-blue-400 mt-1">{{ stats.slack }}</div>
        </div>
        <div class="p-3 sm:p-4 bg-purple-500/10 rounded-lg transition-all hover:shadow-md">
          <div class="text-xs sm:text-sm text-purple-600 dark:text-purple-400">Figma</div>
          <div class="text-xl sm:text-2xl font-semibold text-purple-600 dark:text-purple-400 mt-1">{{ stats.figma }}</div>
        </div>
        <div class="p-3 sm:p-4 bg-amber-500/10 rounded-lg transition-all hover:shadow-md">
          <div class="text-xs sm:text-sm text-amber-600 dark:text-amber-400">Inactive</div>
          <div class="text-xl sm:text-2xl font-semibold text-amber-600 dark:text-amber-400 mt-1">{{ stats.inactive }}</div>
        </div>
      </template>
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
    <UModal v-model="showBulkImportModal" :ui="{ content: { base: 'overflow-y-auto max-h-[90vh]' } }">
      <template #content="{ close }">
        <div class="p-4 sm:p-6">
          <div class="flex items-start justify-between mb-4">
            <h3 class="text-base sm:text-lg font-semibold">Bulk Import User Mappings</h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-lucide-x"
              size="sm"
              @click="closeBulkImportModal"
              aria-label="Close modal"
              class="sm:hidden"
            />
          </div>

          <div class="space-y-4">
            <div>
              <p class="text-xs sm:text-sm text-muted-foreground mb-3">
                Import multiple user mappings at once. Paste JSON array below.
              </p>

              <details class="bg-muted/30 p-3 rounded mb-3">
                <summary class="text-xs sm:text-sm font-medium cursor-pointer hover:text-primary transition-colors">
                  Show example JSON format
                </summary>
                <pre class="text-xs font-mono mt-2 overflow-x-auto">{{ bulkImportExample }}</pre>
              </details>
            </div>

            <UFormField label="Import Data" description="Paste JSON array of mappings">
              <UTextarea
                v-model="bulkImportData"
                :rows="8"
                class="font-mono text-xs sm:text-sm"
                placeholder='[{"sourceType": "slack", "sourceUserId": "U123ABC", ...}]'
                aria-label="JSON import data"
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
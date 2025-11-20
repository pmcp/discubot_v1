<script setup lang="ts">
import type { Flow, FlowInput, FlowOutput } from '~/layers/discubot/types'

interface Props {
  teamId: string
  teamSlug: string
}

const props = defineProps<Props>()

// Toast for user feedback
const toast = useToast()

// Router for navigation
const router = useRouter()

// State
const isLoading = ref(true)
const flows = ref<Flow[]>([])
const inputs = ref<FlowInput[]>([])
const outputs = ref<FlowOutput[]>([])
const showDeleteModal = ref(false)
const flowToDelete = ref<Flow | null>(null)
const isDeleting = ref(false)

// Fetch flows, inputs, and outputs
const fetchData = async () => {
  isLoading.value = true
  try {
    // Fetch all data in parallel
    const [flowsResponse, inputsResponse, outputsResponse] = await Promise.all([
      $fetch<Flow[]>(`/api/teams/${props.teamId}/discubot-flows`),
      $fetch<FlowInput[]>(`/api/teams/${props.teamId}/discubot-flowinputs`),
      $fetch<FlowOutput[]>(`/api/teams/${props.teamId}/discubot-flowoutputs`)
    ])

    flows.value = flowsResponse
    inputs.value = inputsResponse
    outputs.value = outputsResponse
  } catch (error) {
    console.error('Error fetching flows:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to load flows',
      color: 'error'
    })
  } finally {
    isLoading.value = false
  }
}

// Fetch data on mount
onMounted(() => {
  fetchData()
})

// Helper to count inputs for a flow
const getInputCount = (flowId: string) => {
  return inputs.value.filter(input => input.flowId === flowId && input.active).length
}

// Helper to count outputs for a flow
const getOutputCount = (flowId: string) => {
  return outputs.value.filter(output => output.flowId === flowId && output.active).length
}

// Table columns
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'inputs', label: 'Inputs' },
  { key: 'outputs', label: 'Outputs' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' }
]

// Transform flows into table rows with counts
const rows = computed(() => {
  return flows.value.map(flow => ({
    id: flow.id,
    name: flow.name,
    description: flow.description || '—',
    inputCount: getInputCount(flow.id),
    outputCount: getOutputCount(flow.id),
    active: flow.active,
    onboardingComplete: flow.onboardingComplete,
    flow // Keep reference to full flow object
  }))
})

// Handle create new flow
const handleCreateFlow = () => {
  router.push(`/dashboard/${props.teamSlug}/discubot/flows/create`)
}

// Handle edit flow
const handleEditFlow = (flowId: string) => {
  router.push(`/dashboard/${props.teamSlug}/discubot/flows/${flowId}`)
}

// Handle delete flow (show confirmation)
const handleDeleteFlow = (flow: Flow) => {
  flowToDelete.value = flow
  showDeleteModal.value = true
}

// Confirm delete
const confirmDelete = async () => {
  if (!flowToDelete.value) return

  isDeleting.value = true
  try {
    await $fetch(`/api/teams/${props.teamId}/discubot-flows/${flowToDelete.value.id}`, {
      method: 'DELETE'
    })

    toast.add({
      title: 'Success',
      description: 'Flow deleted successfully',
      color: 'success'
    })

    // Remove from local state
    flows.value = flows.value.filter(f => f.id !== flowToDelete.value!.id)

    // Close modal
    showDeleteModal.value = false
    flowToDelete.value = null
  } catch (error) {
    console.error('Error deleting flow:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to delete flow',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

// Cancel delete
const cancelDelete = () => {
  showDeleteModal.value = false
  flowToDelete.value = null
}

// Actions dropdown items
const getActions = (row: any) => [
  [
    {
      label: 'Edit',
      icon: 'i-heroicons-pencil-square',
      click: () => handleEditFlow(row.id)
    },
    {
      label: 'Delete',
      icon: 'i-heroicons-trash',
      click: () => handleDeleteFlow(row.flow),
      disabled: isDeleting.value
    }
  ]
]
</script>

<template>
  <div class="space-y-4">
    <!-- Header with create button -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold">Flows</h2>
        <p class="text-sm text-muted-foreground mt-1">
          Manage your multi-input, multi-output discussion flows
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-heroicons-plus"
        @click="handleCreateFlow"
      >
        Create Flow
      </UButton>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="text-sm text-muted-foreground mt-2">Loading flows...</p>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="flows.length === 0" class="text-center py-12 border border-dashed rounded-lg">
      <div class="max-w-sm mx-auto">
        <div class="text-5xl mb-4">🌊</div>
        <h3 class="text-lg font-semibold mb-2">No flows yet</h3>
        <p class="text-sm text-muted-foreground mb-4">
          Create your first flow to start routing discussions from multiple sources to multiple destinations.
        </p>
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          @click="handleCreateFlow"
        >
          Create Your First Flow
        </UButton>
      </div>
    </div>

    <!-- Flows table -->
    <UTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="isLoading"
    >
      <!-- Name column -->
      <template #name-data="{ row }">
        <div class="font-medium">{{ row.name }}</div>
      </template>

      <!-- Description column -->
      <template #description-data="{ row }">
        <div class="text-sm text-muted-foreground max-w-md truncate">
          {{ row.description }}
        </div>
      </template>

      <!-- Inputs count column with badge -->
      <template #inputs-data="{ row }">
        <UBadge
          :color="row.inputCount > 0 ? 'primary' : 'gray'"
          variant="subtle"
        >
          {{ row.inputCount }} {{ row.inputCount === 1 ? 'input' : 'inputs' }}
        </UBadge>
      </template>

      <!-- Outputs count column with badge -->
      <template #outputs-data="{ row }">
        <UBadge
          :color="row.outputCount > 0 ? 'primary' : 'gray'"
          variant="subtle"
        >
          {{ row.outputCount }} {{ row.outputCount === 1 ? 'output' : 'outputs' }}
        </UBadge>
      </template>

      <!-- Status column -->
      <template #status-data="{ row }">
        <div class="flex items-center gap-2">
          <UBadge
            :color="row.active ? 'success' : 'gray'"
            variant="subtle"
          >
            {{ row.active ? 'Active' : 'Inactive' }}
          </UBadge>
          <UBadge
            v-if="!row.onboardingComplete"
            color="warning"
            variant="subtle"
          >
            Setup Incomplete
          </UBadge>
        </div>
      </template>

      <!-- Actions column -->
      <template #actions-data="{ row }">
        <UDropdownMenu
          :items="getActions(row)"
        >
          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-ellipsis-horizontal"
          />
        </UDropdownMenu>
      </template>
    </UTable>

    <!-- Delete confirmation modal -->
    <UModal v-model="showDeleteModal">
      <template #content="{ close }">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">Delete Flow</h3>
          <p class="text-sm text-muted-foreground mb-6">
            Are you sure you want to delete
            <span class="font-semibold text-foreground">{{ flowToDelete?.name }}</span>?
            This will also delete all associated inputs and outputs. This action cannot be undone.
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="ghost"
              @click="cancelDelete"
              :disabled="isDeleting"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              @click="confirmDelete"
              :loading="isDeleting"
            >
              Delete Flow
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

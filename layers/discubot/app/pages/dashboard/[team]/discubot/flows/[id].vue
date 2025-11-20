<template>
  <AppContainer :title="pageTitle">
    <div class="mb-6">
      <NuxtLink
        :to="`/dashboard/${currentTeam?.slug}/discubot/flows`"
        class="hover:underline inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
        Back to Flows
      </NuxtLink>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 text-destructive mx-auto mb-3" />
      <p class="text-muted-foreground">Failed to load flow</p>
      <p class="text-sm text-muted-foreground mt-1">{{ error }}</p>
    </div>

    <!-- Flow Builder -->
    <FlowBuilder
      v-else
      :flow-id="flowId"
      @saved="handleFlowSaved"
    />
  </AppContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { currentTeam } = useTeam()
const toast = useToast()

const flowId = computed(() => route.params.id as string)
const loading = ref(true)
const error = ref<string | null>(null)
const flowName = ref<string>('Flow')

definePageMeta({
  middleware: 'auth'
})

// Compute page title
const pageTitle = computed(() => {
  if (loading.value) return 'Loading...'
  if (error.value) return 'Error'
  return `Edit ${flowName.value}`
})

// Load flow to get name for title
async function loadFlow() {
  try {
    loading.value = true
    error.value = null

    const response = await $fetch<{ data: { name?: string } }>(`/api/teams/${currentTeam.value?.id}/discubot-flows/${flowId.value}`)
    if (response?.data) {
      flowName.value = response.data.name || 'Flow'
    }
  } catch (e: any) {
    console.error('Failed to load flow:', e)
    error.value = e.message || 'Failed to load flow'
    toast.add({
      title: 'Error',
      description: 'Failed to load flow',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Load flow on mount
onMounted(() => {
  loadFlow()
})

function handleFlowSaved() {
  // Navigate back to flows list after successful save
  router.push(`/dashboard/${currentTeam.value?.slug}/discubot/flows`)
}
</script>

<template>
  <AppContainer title="Source Configs">
    <div class="mb-4">
      <NuxtLink
        :to="`/dashboard/${currentTeam?.slug}/discubot`"
        class="hover:underline inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
        Back to Dashboard
      </NuxtLink>
    </div>

    <CroutonCollectionViewer
      collection-name="discubotConfigs"
      default-layout="table"
    />
  </AppContainer>
</template>

<script setup lang="ts">
const { currentTeam } = useTeam()
const route = useRoute()
const router = useRouter()
const { open } = useCrouton()
const toast = useToast()

// Auto-open edit form after OAuth
onMounted(() => {
  const configId = route.query.openEdit as string | undefined
  const isOAuthSuccess = route.query.oauth === 'success'

  if (configId && isOAuthSuccess) {
    // Show success toast
    toast.add({
      title: 'Slack Connected!',
      description: 'Complete your Notion setup to activate this config',
      color: 'success'
    })

    // Open edit slideover
    open('update', 'discubotConfigs', [configId])

    // Clean up URL
    router.replace({ query: {} })
  }
})

definePageMeta({
  middleware: 'auth'
})
</script>

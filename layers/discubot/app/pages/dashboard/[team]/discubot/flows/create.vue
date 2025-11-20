<template>
  <AppContainer title="Create Flow">
    <div class="mb-6">
      <NuxtLink
        :to="`/dashboard/${currentTeam?.slug}/discubot/flows`"
        class="hover:underline inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
        Back to Flows
      </NuxtLink>
    </div>

    <FlowBuilder @saved="handleFlowSaved" />
  </AppContainer>
</template>

<script setup lang="ts">
const { currentTeam } = useTeam()
const router = useRouter()

definePageMeta({
  middleware: 'auth'
})

function handleFlowSaved(flowId: string) {
  // Navigate back to flows list after successful save
  router.push(`/dashboard/${currentTeam.value?.slug}/discubot/flows`)
}
</script>

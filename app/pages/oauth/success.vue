<script setup lang="ts">
/**
 * OAuth Success Page
 *
 * Shows success message after completing OAuth flow.
 * Auto-redirects to config page after 3 seconds.
 */

const route = useRoute()
const router = useRouter()
const { currentTeam } = useTeam()

const provider = computed(() => route.query.provider as string || 'Unknown')
const team = computed(() => route.query.team as string || 'Unknown')
const configId = computed(() => route.query.configId as string | undefined)

// Check if opened in popup
const isPopup = computed(() => window.opener !== null)

// Auto-redirect countdown
const countdown = ref(3)
const redirecting = ref(false)

// Config page URL with auto-open parameter
const configUrl = computed(() => {
  if (!currentTeam.value?.slug) return '/dashboard'
  const baseUrl = `/dashboard/${currentTeam.value.slug}/discubot/configs`
  return configId.value ? `${baseUrl}?openEdit=${configId.value}&oauth=success` : baseUrl
})

// Start countdown on mount
onMounted(() => {
  // If in popup, notify parent and close
  if (isPopup.value) {
    window.opener.postMessage({ type: 'oauth-success', provider: provider.value, team: team.value }, window.location.origin)
    setTimeout(() => {
      window.close()
    }, 1000)
    return
  }

  // Normal flow: countdown and redirect
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      redirecting.value = true
      router.push(configUrl.value)
    }
  }, 1000)

  // Cleanup on unmount
  onBeforeUnmount(() => clearInterval(timer))
})

// Manual navigation
function goToConfigs() {
  redirecting.value = true
  router.push(configUrl.value)
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="max-w-md w-full">
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg class="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                Authorization Successful!
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ provider }} connected
              </p>
            </div>
          </div>
        </template>

        <div v-if="isPopup" class="space-y-4">
          <div class="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
            <p class="text-sm text-foreground font-medium">
              This window will close automatically...
            </p>
            <p class="text-xs text-muted-foreground mt-2">
              You can close this window now
            </p>
          </div>
        </div>

        <div v-else class="space-y-4">
          <!-- Auto-redirect notice -->
          <div class="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span class="text-lg font-bold text-primary">{{ countdown }}</span>
              </div>
              <div>
                <h3 class="text-sm font-medium text-foreground">
                  Redirecting to Configuration...
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  You'll be redirected in {{ countdown }} {{ countdown === 1 ? 'second' : 'seconds' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Connection details -->
          <div class="bg-muted/50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-foreground mb-3">
              Connection Details
            </h3>
            <dl class="space-y-2">
              <div class="flex justify-between text-sm">
                <dt class="text-muted-foreground">Provider:</dt>
                <dd class="font-medium text-foreground capitalize">{{ provider }}</dd>
              </div>
              <div class="flex justify-between text-sm">
                <dt class="text-muted-foreground">Workspace:</dt>
                <dd class="font-medium text-foreground">{{ team }}</dd>
              </div>
              <div class="flex justify-between text-sm">
                <dt class="text-muted-foreground">Status:</dt>
                <dd class="font-medium text-success">
                  <span class="inline-flex items-center gap-1.5">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Connected
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <!-- Next steps -->
          <div class="bg-info/5 border border-info/20 rounded-lg p-4">
            <h3 class="text-sm font-medium text-foreground mb-2">
              Next Steps
            </h3>
            <ol class="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Add your Notion integration token</li>
              <li>Configure your Notion database ID</li>
              <li>Customize AI prompts (optional)</li>
              <li>Activate the configuration</li>
            </ol>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-between items-center gap-3">
            <UButton
              color="gray"
              variant="ghost"
              to="/dashboard"
              size="sm"
            >
              Back to Dashboard
            </UButton>
            <UButton
              color="primary"
              @click="goToConfigs"
              :loading="redirecting"
            >
              {{ redirecting ? 'Redirecting...' : 'Continue Setup' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

<template>
  <UContainer>
    <div class="flex min-h-screen items-center justify-center p-4">
      <UCard class="w-full max-w-md">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-semibold">Authorization Failed</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                {{ providerName }} Connection Error
              </p>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <!-- Error Message -->
          <div class="p-4 rounded-lg bg-error/5 border border-error/20">
            <h3 class="text-sm font-medium text-error mb-2">
              {{ errorTitle }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ errorMessage }}
            </p>
          </div>

          <!-- Error Details (if available) -->
          <div v-if="errorDescription" class="p-3 rounded-md bg-muted/50 text-xs font-mono text-muted-foreground">
            {{ errorDescription }}
          </div>

          <!-- Troubleshooting Tips -->
          <div class="space-y-2">
            <h4 class="text-sm font-medium">What happened?</h4>
            <ul class="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li v-for="tip in troubleshootingTips" :key="tip">{{ tip }}</li>
            </ul>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2 pt-4">
            <UButton
              to="/teams"
              color="gray"
              variant="soft"
              class="flex-1"
            >
              Back to Dashboard
            </UButton>
            <UButton
              @click="retryAuthorization"
              color="primary"
              class="flex-1"
            >
              Try Again
            </UButton>
          </div>

          <!-- Support Link -->
          <div class="text-center pt-2">
            <p class="text-xs text-muted-foreground">
              Still having issues?
              <a href="mailto:support@example.com" class="text-primary hover:underline">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const route = useRoute()

// Parse query parameters
const error = computed(() => route.query.error as string || 'unknown_error')
const errorDescription = computed(() => route.query.error_description as string || '')
const provider = computed(() => route.query.provider as string || 'oauth')
const state = computed(() => route.query.state as string || '')

// Provider display name
const providerName = computed(() => {
  const providers: Record<string, string> = {
    'slack': 'Slack',
    'figma': 'Figma',
    'oauth': 'OAuth'
  }
  return providers[provider.value.toLowerCase()] || 'OAuth'
})

// Error title and message mapping
const errorInfo = computed(() => {
  const errors: Record<string, { title: string; message: string; tips: string[] }> = {
    'access_denied': {
      title: 'Authorization Denied',
      message: 'You cancelled the authorization request or denied access to your workspace.',
      tips: [
        'You clicked "Cancel" or "Deny" on the authorization screen',
        'Your workspace admin may have restricted app installations',
        'Try again and click "Allow" to grant access'
      ]
    },
    'invalid_state': {
      title: 'Invalid State Token',
      message: 'The authorization request has expired or is invalid. This usually happens if you took too long to authorize.',
      tips: [
        'The authorization link expired (expires after 5 minutes)',
        'You may have used the same link twice',
        'Try starting the authorization flow again'
      ]
    },
    'state_not_found': {
      title: 'Session Expired',
      message: 'Your authorization session has expired. Please try again.',
      tips: [
        'The authorization request is too old',
        'Your session may have been cleared',
        'Start a new authorization from the config page'
      ]
    },
    'server_error': {
      title: 'Server Error',
      message: 'An error occurred while processing your authorization. Please try again.',
      tips: [
        'Our servers may be experiencing issues',
        'Try again in a few moments',
        'Contact support if the problem persists'
      ]
    },
    'configuration_error': {
      title: 'Configuration Error',
      message: 'The OAuth application is not configured correctly. Please contact support.',
      tips: [
        'Missing or invalid client credentials',
        'Incorrect redirect URI configuration',
        'Contact your administrator or support team'
      ]
    },
    'unknown_error': {
      title: 'Unknown Error',
      message: 'An unexpected error occurred during authorization. Please try again.',
      tips: [
        'Check your internet connection',
        'Try using a different browser',
        'Contact support if the issue continues'
      ]
    }
  }

  return errors[error.value] || errors['unknown_error']
})

const errorTitle = computed(() => errorInfo.value.title)
const errorMessage = computed(() => errorInfo.value.message)
const troubleshootingTips = computed(() => errorInfo.value.tips)

// Retry authorization
function retryAuthorization() {
  // Redirect back to configs page where they can try again
  navigateTo('/teams')
}

// Set page meta
useHead({
  title: `OAuth Error - ${providerName.value}`,
  meta: [
    {
      name: 'description',
      content: 'OAuth authorization error occurred'
    }
  ]
})
</script>

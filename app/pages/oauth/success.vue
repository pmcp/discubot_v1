<script setup lang="ts">
/**
 * OAuth Success Page
 *
 * Shows success message after completing OAuth flow.
 * This is a temporary page for Phase 4 - will be replaced with
 * proper config form in Phase 5 (Admin UI).
 */

const route = useRoute()
const provider = computed(() => route.query.provider as string || 'Unknown')
const team = computed(() => route.query.team as string || 'Unknown')
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

        <div class="space-y-4">
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              What's Next?
            </h3>
            <ol class="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
              <li>Complete your configuration in the admin dashboard</li>
              <li>Add your Notion API token and database ID</li>
              <li>Test the connection</li>
              <li>Start syncing discussions to Notion!</li>
            </ol>
          </div>

          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Connection Details
            </h3>
            <dl class="space-y-2">
              <div class="flex justify-between text-sm">
                <dt class="text-gray-500 dark:text-gray-400">Provider:</dt>
                <dd class="font-medium text-gray-900 dark:text-white capitalize">{{ provider }}</dd>
              </div>
              <div class="flex justify-between text-sm">
                <dt class="text-gray-500 dark:text-gray-400">Workspace:</dt>
                <dd class="font-medium text-gray-900 dark:text-white">{{ team }}</dd>
              </div>
              <div class="flex justify-between text-sm">
                <dt class="text-gray-500 dark:text-gray-400">Status:</dt>
                <dd class="font-medium text-green-600 dark:text-green-400">Connected</dd>
              </div>
            </dl>
          </div>

          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div class="flex gap-3">
              <svg class="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 class="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  Note: Admin UI Coming in Phase 5
                </h3>
                <p class="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  The configuration dashboard is not yet available. Your OAuth token has been received but needs to be stored manually for now.
                </p>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              color="gray"
              variant="ghost"
              to="/"
            >
              Return Home
            </UButton>
            <UButton
              color="primary"
              to="/dashboard"
            >
              Go to Dashboard
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

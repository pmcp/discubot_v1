<template>
  <AppContainer title="Job Monitoring">
    <!-- Back Button -->
    <div class="mb-4">
      <NuxtLink
        :to="`/dashboard/${currentTeam?.slug}`"
        class="hover:underline inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
        Back to Dashboard
      </NuxtLink>
    </div>

    <div class="space-y-6">
      <!-- Job Statistics -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <UCard>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <UIcon name="i-lucide-activity" class="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p class="text-2xl font-bold">{{ jobStats.total }}</p>
              <p class="text-xs text-muted-foreground">Total Jobs</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <UIcon name="i-lucide-loader-2" class="w-5 h-5 text-amber-500 animate-spin" />
            </div>
            <div>
              <p class="text-2xl font-bold">{{ jobStats.processing }}</p>
              <p class="text-xs text-muted-foreground">Processing</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <UIcon name="i-lucide-check-circle" class="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p class="text-2xl font-bold">{{ jobStats.completed }}</p>
              <p class="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <UIcon name="i-lucide-x-circle" class="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p class="text-2xl font-bold">{{ jobStats.failed }}</p>
              <p class="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <UIcon name="i-lucide-rotate-cw" class="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p class="text-2xl font-bold">{{ jobStats.retrying }}</p>
              <p class="text-xs text-muted-foreground">Retrying</p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Filters and Actions -->
      <UCard>
        <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <!-- Status Filter -->
            <div class="flex flex-wrap gap-2" role="group" aria-label="Filter jobs by status">
              <UButton
                v-for="filter in statusFilters"
                :key="filter.value"
                :color="selectedFilter === filter.value ? 'primary' : 'neutral'"
                :variant="selectedFilter === filter.value ? 'solid' : 'outline'"
                size="sm"
                @click="selectedFilter = filter.value"
                :aria-pressed="selectedFilter === filter.value"
                :aria-label="`Filter by ${filter.label.toLowerCase()}`"
                class="touch-manipulation"
              >
                {{ filter.label }}
                <span v-if="filter.count !== undefined" class="ml-1 opacity-75">
                  ({{ filter.count }})
                </span>
              </UButton>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-2 w-full sm:w-auto">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-refresh-cw"
                @click="refreshJobs"
                :disabled="pending"
                :loading="pending"
                aria-label="Refresh jobs list"
                class="flex-1 sm:flex-none touch-manipulation"
              >
                <span class="hidden sm:inline">Refresh</span>
              </UButton>
            </div>
          </div>
      </UCard>

      <!-- Jobs List -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold">
              {{ selectedFilter === 'all' ? 'All Jobs' : `${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Jobs` }}
            </h3>
            <span class="text-sm text-muted-foreground">
              {{ filteredJobs.length }} {{ filteredJobs.length === 1 ? 'job' : 'jobs' }}
            </span>
          </div>
        </template>
        <template #body>
          <!-- Loading State -->
          <div v-if="pending" class="space-y-3">
            <div v-for="i in 5" :key="i" class="border rounded-lg p-4 animate-pulse">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 space-y-3">
                  <div class="h-4 bg-muted rounded w-1/3"></div>
                  <div class="h-3 bg-muted rounded w-1/2"></div>
                  <div class="h-3 bg-muted rounded w-2/3"></div>
                </div>
                <div class="h-6 w-20 bg-muted rounded"></div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="filteredJobs.length === 0" class="text-center py-12 px-4" role="status" aria-live="polite">
            <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <UIcon name="i-lucide-inbox" class="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
            </div>
            <h3 class="text-base sm:text-lg font-semibold mb-2">No jobs found</h3>
            <p class="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {{ selectedFilter === 'all'
                ? 'No processing jobs yet. Jobs will appear here when discussions are processed from Slack or Figma.'
                : `No ${selectedFilter} jobs at the moment. Try selecting a different filter or check back later.`
              }}
            </p>
            <div v-if="selectedFilter === 'all'" class="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <UButton
                color="primary"
                icon="i-lucide-settings"
                :to="`/dashboard/${currentTeam?.slug}/discubot/configs`"
                aria-label="Configure integrations"
              >
                Configure Integrations
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-book-open"
                external
                to="/docs/getting-started"
                aria-label="View documentation"
              >
                View Documentation
              </UButton>
            </div>
          </div>

          <!-- Jobs List -->
          <div v-else class="space-y-3">
            <div
              v-for="job in filteredJobs"
              :key="job.id"
              class="border rounded-lg p-3 sm:p-4 hover:border-primary/50 transition-all cursor-pointer active:scale-[0.99] touch-manipulation"
              @click="openJobDetails(job)"
              role="button"
              tabindex="0"
              @keydown.enter="openJobDetails(job)"
              @keydown.space.prevent="openJobDetails(job)"
              :aria-label="`View details for job ${job.stage || 'Processing'}`"
            >
              <div class="flex items-start justify-between gap-3 sm:gap-4">
                <!-- Job Info -->
                <div class="flex-1 min-w-0 space-y-2">
                  <!-- Stage and Status -->
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-xs sm:text-sm font-semibold truncate">
                      {{ job.stage || 'Processing' }}
                    </h4>
                    <UBadge :color="getStatusColor(job.status)" size="sm">
                      {{ job.status }}
                    </UBadge>
                    <span v-if="job.status === 'processing'" class="text-xs text-muted-foreground hidden sm:inline">
                      Attempt {{ job.attempts }}/{{ job.maxAttempts }}
                    </span>
                  </div>

                  <!-- Discussion and Config -->
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                      <UIcon name="i-lucide-message-square" class="w-3 h-3" />
                      <span>Discussion:</span>
                      <CroutonItemCardMini
                        v-if="job.discussionId"
                        :id="job.discussionId"
                        collection="discubotDiscussions"
                      />
                    </div>
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                      <UIcon name="i-lucide-settings" class="w-3 h-3" />
                      <span>Config:</span>
                      <CroutonItemCardMini
                        v-if="job.sourceConfigId"
                        :id="job.sourceConfigId"
                        collection="discubotConfigs"
                      />
                    </div>
                  </div>

                  <!-- Timestamps -->
                  <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <div v-if="job.startedAt" class="flex items-center gap-1">
                      <UIcon name="i-lucide-play" class="w-3 h-3" />
                      Started {{ formatRelativeTime(job.startedAt) }}
                    </div>
                    <div v-if="job.completedAt" class="flex items-center gap-1">
                      <UIcon name="i-lucide-check" class="w-3 h-3" />
                      Completed {{ formatRelativeTime(job.completedAt) }}
                    </div>
                    <div v-if="job.processingTime" class="flex items-center gap-1">
                      <UIcon name="i-lucide-clock" class="w-3 h-3" />
                      {{ formatDuration(job.processingTime) }}
                    </div>
                  </div>

                  <!-- Error Message (if failed) -->
                  <div v-if="job.status === 'failed' && job.error" class="mt-2">
                    <div class="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                      <UIcon name="i-lucide-alert-circle" class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium text-red-500">Error</p>
                        <p class="text-xs text-red-600 mt-1 line-clamp-2">
                          {{ job.error }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Task IDs (if completed) -->
                  <div v-if="job.taskIds && job.taskIds.length > 0" class="flex items-center gap-2">
                    <UIcon name="i-lucide-list-checks" class="w-3 h-3 text-muted-foreground" />
                    <span class="text-xs text-muted-foreground">
                      Created {{ job.taskIds.length }} {{ job.taskIds.length === 1 ? 'task' : 'tasks' }}
                    </span>
                  </div>

                  <!-- Retry Button (for failed jobs) -->
                  <div v-if="job.status === 'failed' && job.discussionId" class="mt-3 flex gap-2">
                    <UButton
                      color="warning"
                      variant="outline"
                      size="xs"
                      icon="i-lucide-rotate-cw"
                      :loading="retryingJobId === job.id"
                      :disabled="retryingJobId !== null"
                      @click.stop="retryJob(job)"
                      aria-label="Retry failed job"
                    >
                      Retry Job
                    </UButton>
                  </div>
                </div>

                <!-- Action Button -->
                <div class="flex-shrink-0">
                  <UIcon name="i-lucide-chevron-right" class="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </UCard>
    </div>
  </AppContainer>
</template>

<script setup lang="ts">
import { useTimeAgo } from '@vueuse/core'

definePageMeta({
  middleware: 'auth'
})

// Team context
const { currentTeam } = useTeam()
const { open: openCrouton } = useCrouton()
const toast = useToast()

// Data fetching
const { items: jobs, pending, refresh: refreshJobs } = await useCollectionQuery('discubotJobs')

// Filter state
const selectedFilter = ref<'all' | 'processing' | 'completed' | 'failed' | 'retrying' | 'pending'>('all')

// Retry state
const retryingJobId = ref<string | null>(null)

// Job statistics
const jobStats = computed(() => {
  const allJobs = jobs.value || []
  return {
    total: allJobs.length,
    processing: allJobs.filter((j: any) => j.status === 'processing').length,
    completed: allJobs.filter((j: any) => j.status === 'completed').length,
    failed: allJobs.filter((j: any) => j.status === 'failed').length,
    retrying: allJobs.filter((j: any) => j.status === 'retrying').length,
    pending: allJobs.filter((j: any) => j.status === 'pending').length
  }
})

// Status filters with counts
const statusFilters = computed(() => [
  { label: 'All', value: 'all', count: jobStats.value.total },
  { label: 'Processing', value: 'processing', count: jobStats.value.processing },
  { label: 'Completed', value: 'completed', count: jobStats.value.completed },
  { label: 'Failed', value: 'failed', count: jobStats.value.failed },
  { label: 'Retrying', value: 'retrying', count: jobStats.value.retrying }
])

// Filtered jobs
const filteredJobs = computed(() => {
  const allJobs = jobs.value || []
  if (selectedFilter.value === 'all') {
    return allJobs
  }
  return allJobs.filter((j: any) => j.status === selectedFilter.value)
})

// Helper functions
function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'processing':
      return 'primary'
    case 'retrying':
      return 'warning'
    case 'pending':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function formatRelativeTime(date: string | Date) {
  const { value } = useTimeAgo(date)
  return value
}

function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`
  }
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function openJobDetails(job: any) {
  // Open job details in Crouton modal
  openCrouton('view', 'discubotJobs', job.id)
}

async function retryJob(job: any) {
  if (!job.discussionId) {
    toast.add({
      title: 'Cannot retry job',
      description: 'No discussion ID found for this job',
      color: 'error'
    })
    return
  }

  retryingJobId.value = job.id

  try {
    const response = await $fetch(`/api/discussions/${job.discussionId}/retry`, {
      method: 'POST',
      body: {}
    })

    toast.add({
      title: 'Retry successful',
      description: 'The discussion is being reprocessed',
      color: 'success'
    })

    // Refresh jobs list to show new retry job
    await refreshJobs()
  } catch (error: any) {
    console.error('Failed to retry job:', error)

    const errorMessage = error.data?.message || error.message || 'Failed to retry job'

    toast.add({
      title: 'Retry failed',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    retryingJobId.value = null
  }
}
</script>

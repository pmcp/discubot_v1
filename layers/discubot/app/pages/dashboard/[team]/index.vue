<template>
  <AppContainer title="Discubot Dashboard">
    <div class="space-y-6">
      <!-- Quick Stats Cards -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-4">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted-foreground">Total Configs</h3>
              <UIcon name="i-lucide-settings" class="w-4 h-4 text-muted-foreground" />
            </div>
          </template>

          <div class="flex items-baseline gap-2">
            <p v-if="statsLoading" class="text-2xl font-bold">...</p>
            <p v-else class="text-2xl font-bold">{{ stats.totalConfigs }}</p>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ stats.activeConfigs }} active
          </p>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted-foreground">Active Jobs</h3>
              <UIcon name="i-lucide-loader-2" class="w-4 h-4 text-muted-foreground" />
            </div>
          </template>
          <div class="flex items-baseline gap-2">
            <p v-if="statsLoading" class="text-2xl font-bold">...</p>
            <p v-else class="text-2xl font-bold">{{ stats.activeJobs }}</p>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            Currently processing
          </p>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted-foreground">Completed (24h)</h3>
              <UIcon name="i-lucide-check-circle" class="w-4 h-4 text-muted-foreground" />
            </div>
          </template>

          <div class="flex items-baseline gap-2">
            <p v-if="statsLoading" class="text-2xl font-bold">...</p>
            <p v-else class="text-2xl font-bold">{{ stats.completed24h }}</p>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            Last 24 hours
          </p>

        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted-foreground">Recent Tasks</h3>
              <UIcon name="i-lucide-list-checks" class="w-4 h-4 text-muted-foreground" />
            </div>
          </template>

          <div class="flex items-baseline gap-2">
            <p v-if="statsLoading" class="text-2xl font-bold">...</p>
            <p v-else class="text-2xl font-bold">{{ stats.recentTasks }}</p>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            Created this week
          </p>

        </UCard>
      </div>

      <!-- Quick Actions -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold">Quick Actions</h3>
          </div>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="navigation" aria-label="Quick actions">
          <UButton
            color="primary"
            icon="i-lucide-plus"
            @click="createNewConfig"
            class="w-full justify-center sm:justify-start"
            aria-label="Create new source configuration"
          >
            <span class="hidden sm:inline">New Source Config</span>
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-settings"
            :to="`/dashboard/${currentTeam?.slug}/discubot/configs`"
            class="w-full justify-center sm:justify-start"
            aria-label="View all source configurations"
          >
            <span>View All Configs</span>
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-activity"
            :to="`/dashboard/${currentTeam?.slug}/discubot/jobs`"
            class="w-full justify-center sm:justify-start"
            aria-label="View all processing jobs"
          >
            <span>View All Jobs</span>
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-message-square"
            :to="`/dashboard/${currentTeam?.slug}/discubot/discussions`"
            class="w-full justify-center sm:justify-start"
            aria-label="View all discussions"
          >
            <span>View Discussions</span>
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-users"
            :to="`/dashboard/${currentTeam?.slug}/discubot/user-mappings`"
            class="w-full justify-center sm:justify-start"
            aria-label="Manage user mappings"
          >
            <span>User Mappings</span>
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-inbox"
            :to="`/dashboard/${currentTeam?.slug}/discubot/inbox`"
            class="w-full justify-center sm:justify-start"
            aria-label="View inbox messages"
          >
            <span>Email Inbox</span>
          </UButton>
        </div>

      </UCard>

      <!-- Recent Activity Feed -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold">Recent Activity</h3>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-refresh-cw"
              @click="refreshActivity"
              :disabled="activityLoading"
            >
              Refresh
            </UButton>
          </div>
        </template>
        <!-- Loading State -->
        <div v-if="activityLoading" class="space-y-3">
          <div v-for="i in 5" :key="i" class="flex items-center gap-3 p-3 rounded-lg bg-muted/30 animate-pulse">
            <div class="w-8 h-8 rounded-full bg-muted"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-muted rounded w-3/4"></div>
              <div class="h-3 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="activityFeed.length === 0" class="text-center py-8">
          <UIcon name="i-lucide-inbox" class="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p class="text-muted-foreground">No recent activity</p>
          <p class="text-sm text-muted-foreground mt-1">
            Activity will appear here after processing discussions
          </p>
        </div>

        <!-- Activity List -->
        <div v-else class="space-y-2">
          <div
            v-for="item in activityFeed"
            :key="item.id"
            class="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <!-- Icon -->
            <div class="flex-shrink-0 mt-1">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center"
                :class="getActivityIconClass(item.type, item.status)"
              >
                <UIcon :name="getActivityIcon(item.type)" class="w-4 h-4" />
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ item.title }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    {{ item.description }}
                  </p>
                </div>
                <UBadge
                  v-if="item.status"
                  :color="getStatusColor(item.status)"
                  size="xs"
                >
                  {{ item.status }}
                </UBadge>
              </div>
              <div class="flex items-center gap-2 mt-2">
                <span class="text-xs text-muted-foreground">
                  {{ formatRelativeTime(item.createdAt) }}
                </span>
                <span v-if="item.sourceType" class="text-xs text-muted-foreground">
                  • {{ item.sourceType }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Collection Links -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UCard
          class="hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
          @click="navigateTo(`/dashboard/${currentTeam?.slug}/discubot/configs`)"
          role="link"
          tabindex="0"
          @keydown.enter="navigateTo(`/dashboard/${currentTeam?.slug}/discubot/configs`)"
          @keydown.space.prevent="navigateTo(`/dashboard/${currentTeam?.slug}/discubot/configs`)"
          aria-label="Go to source configurations"
        >
          <div class="flex items-center gap-3 sm:gap-4">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UIcon name="i-lucide-settings" class="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-semibold truncate">Source Configs</h4>
              <p class="text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none">
                Manage Figma and Slack integrations
              </p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </UCard>

        <UCard
          class="hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
          @click="navigateTo(`/dashboard/${currentTeam?.slug}/discubot/jobs`)"
          role="link"
          tabindex="0"
          @keydown.enter="navigateTo(`/dashboard/${currentTeam?.slug}/discubot/jobs`)"
          @keydown.space.prevent="navigateTo(`/dashboard/${currentTeam?.slug}/discubot/jobs`)"
          aria-label="Go to processing jobs"
        >
          <div class="flex items-center gap-3 sm:gap-4">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UIcon name="i-lucide-activity" class="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-semibold truncate">Processing Jobs</h4>
              <p class="text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none">
                Monitor discussion processing status
              </p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </UCard>
      </div>
    </div>
  </AppContainer>
</template>

<script setup lang="ts">
// Team context
const { currentTeam } = useTeam()
const { open: openCrouton } = useCrouton()

// Data fetching
const { items: configs, pending: configsPending, refresh: refreshConfigs } = await useCollectionQuery('discubotConfigs')
const { items: jobs, pending: jobsPending, refresh: refreshJobs } = await useCollectionQuery('discubotJobs')
const { items: discussions, pending: discussionsPending, refresh: refreshDiscussions } = await useCollectionQuery('discubotDiscussions')
const { items: tasks, pending: tasksPending, refresh: refreshTasks } = await useCollectionQuery('discubotTasks')

// Loading states
const statsLoading = computed(() =>
  configsPending.value || jobsPending.value || tasksPending.value
)
const activityLoading = computed(() =>
  jobsPending.value || discussionsPending.value
)

// Stats calculations
const stats = computed(() => {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  return {
    totalConfigs: configs.value?.length || 0,
    activeConfigs: configs.value?.filter((c: any) => c.active).length || 0,
    activeJobs: jobs.value?.filter((j: any) => j.status === 'processing').length || 0,
    completed24h: jobs.value?.filter((j: any) =>
      j.status === 'completed' && j.completedAt && new Date(j.completedAt * 1000) > oneDayAgo
    ).length || 0,
    recentTasks: tasks.value?.filter((t: any) =>
      t.createdAt && new Date(t.createdAt * 1000) > oneWeekAgo
    ).length || 0
  }
})

// Activity feed - combine discussions and jobs
const activityFeed = computed(() => {
  const items: any[] = []

  // Add discussions
  discussions.value?.forEach((d: any) => {
    items.push({
      id: `discussion-${d.id}`,
      type: 'discussion',
      title: d.title || 'Untitled Discussion',
      description: `${d.sourceType} discussion`,
      status: d.status,
      sourceType: d.sourceType,
      createdAt: d.createdAt
    })
  })

  // Add jobs
  jobs.value?.forEach((j: any) => {
    items.push({
      id: `job-${j.id}`,
      type: 'job',
      title: j.stage || 'Processing',
      description: `Job ${j.status}`,
      status: j.status,
      sourceType: null,
      createdAt: j.createdAt
    })
  })

  // Sort by createdAt desc and take 10
  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
})

// Helper functions
function getActivityIcon(type: string) {
  switch (type) {
    case 'discussion':
      return 'i-lucide-message-square'
    case 'job':
      return 'i-lucide-activity'
    default:
      return 'i-lucide-circle'
  }
}

function getActivityIconClass(type: string, status?: string) {
  if (type === 'job') {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500'
      case 'failed':
        return 'bg-red-500/10 text-red-500'
      case 'processing':
        return 'bg-blue-500/10 text-blue-500'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }
  return 'bg-primary/10 text-primary'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'processing':
    case 'pending':
      return 'primary'
    case 'retrying':
      return 'warning'
    default:
      return 'neutral'
  }
}

function formatRelativeTime(date: string) {
  const { value } = useTimeAgo(date)
  return value
}

// Actions
function createNewConfig() {
  openCrouton('create', 'discubotConfigs')
}

async function refreshActivity() {
  await Promise.all([
    refreshConfigs(),
    refreshJobs(),
    refreshDiscussions(),
    refreshTasks()
  ])
}
</script>

<script setup>
import { ref, computed } from 'vue'

// Stats data
const stats = ref({
  totalSyncs: 24783,
  activeJobs: 8,
  successRate: 96.8,
  pendingActions: 23
})

// Recent activity data
const recentActivity = ref([
  {
    id: 1,
    source: 'figma',
    title: 'Design System Review Complete',
    description: 'AI detected 3 action items in component feedback discussion',
    status: 'success',
    statusText: 'Completed',
    time: '2 minutes ago',
    user: 'Sarah Chen'
  },
  {
    id: 2,
    source: 'slack',
    title: 'Bug Report Synced',
    description: 'Critical navigation issue discussion synced to Notion',
    status: 'success',
    statusText: 'Completed',
    time: '15 minutes ago',
    user: 'Alex Morgan'
  },
  {
    id: 3,
    source: 'figma',
    title: 'Feature Request Processing',
    description: 'New dashboard feature discussion being analyzed...',
    status: 'warning',
    statusText: 'Processing',
    time: '32 minutes ago',
    user: 'Jordan Lee'
  },
  {
    id: 4,
    source: 'slack',
    title: 'Sync Failed - Retry Required',
    description: 'API rate limit reached, will retry in 5 minutes',
    status: 'error',
    statusText: 'Failed',
    time: '1 hour ago',
    user: 'System'
  }
])
</script>

<template>
  <div>
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-8 py-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p class="text-sm text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div class="flex items-center gap-3">
          <UButton icon="i-heroicons-bell" variant="ghost" color="gray">
            <UBadge color="red" variant="solid" size="xs" class="absolute -top-1 -right-1">3</UBadge>
          </UButton>
          <UButton icon="i-heroicons-plus" color="primary">
            New Source
          </UButton>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="p-8">
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <!-- Total Syncs Card -->
        <UCard class="hover:-translate-y-1 transition-transform">
          <div class="flex items-center justify-between mb-4">
            <div class="p-3 bg-primary-100 rounded-lg">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-primary-600" />
            </div>
            <UBadge color="green" variant="subtle">+12.5%</UBadge>
          </div>
          <p class="text-3xl font-bold text-gray-900">{{ stats.totalSyncs.toLocaleString() }}</p>
          <p class="text-sm text-gray-500 mt-1">Total Syncs</p>
          <p class="text-xs text-gray-400 mt-2">Last 30 days</p>
        </UCard>

        <!-- Active Jobs Card -->
        <UCard class="hover:-translate-y-1 transition-transform">
          <div class="flex items-center justify-between mb-4">
            <div class="p-3 bg-amber-100 rounded-lg">
              <UIcon name="i-heroicons-bolt" class="w-6 h-6 text-amber-600" />
            </div>
            <div class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          </div>
          <p class="text-3xl font-bold text-gray-900">{{ stats.activeJobs }}</p>
          <p class="text-sm text-gray-500 mt-1">Active Jobs</p>
          <p class="text-xs text-gray-400 mt-2">Running now</p>
        </UCard>

        <!-- Success Rate Card -->
        <UCard class="hover:-translate-y-1 transition-transform">
          <div class="flex items-center justify-between mb-4">
            <div class="p-3 bg-green-100 rounded-lg">
              <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-600" />
            </div>
            <UBadge color="green" variant="subtle">+2.1%</UBadge>
          </div>
          <p class="text-3xl font-bold text-gray-900">{{ stats.successRate }}%</p>
          <p class="text-sm text-gray-500 mt-1">Success Rate</p>
          <UProgress :value="stats.successRate" color="green" class="mt-3" />
        </UCard>

        <!-- Pending Actions Card -->
        <UCard class="hover:-translate-y-1 transition-transform">
          <div class="flex items-center justify-between mb-4">
            <div class="p-3 bg-blue-100 rounded-lg">
              <UIcon name="i-heroicons-clipboard-document-list" class="w-6 h-6 text-blue-600" />
            </div>
            <UBadge color="red" variant="subtle">-5</UBadge>
          </div>
          <p class="text-3xl font-bold text-gray-900">{{ stats.pendingActions }}</p>
          <p class="text-sm text-gray-500 mt-1">Pending Actions</p>
          <p class="text-xs text-gray-400 mt-2">Requires attention</p>
        </UCard>
      </div>

      <!-- Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Recent Activity (2 columns) -->
        <UCard class="lg:col-span-2">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <UButton variant="ghost" size="sm">View All</UButton>
            </div>
          </template>

          <div class="space-y-1">
            <div
              v-for="activity in recentActivity"
              :key="activity.id"
              class="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors border-l-3 border-transparent hover:border-primary-500"
            >
              <div class="flex-shrink-0 mt-1">
                <div
                  v-if="activity.source === 'figma'"
                  class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"
                >
                  <UIcon name="i-heroicons-cube" class="w-5 h-5 text-purple-600" />
                </div>
                <div v-else class="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <UIcon name="i-heroicons-chat-bubble-left-right" class="w-5 h-5 text-pink-600" />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900">{{ activity.title }}</p>
                    <p class="text-sm text-gray-500 mt-1">{{ activity.description }}</p>
                  </div>
                  <UBadge
                    :color="activity.status === 'success' ? 'green' : activity.status === 'warning' ? 'amber' : 'red'"
                    variant="subtle"
                  >
                    {{ activity.statusText }}
                  </UBadge>
                </div>
                <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>{{ activity.time }}</span>
                  <span>•</span>
                  <span>{{ activity.user }}</span>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Quick Actions & System Health (1 column) -->
        <div class="space-y-6">
          <!-- Quick Actions -->
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </template>

            <div class="space-y-3">
              <UButton
                block
                variant="outline"
                color="primary"
                class="justify-start"
                icon="i-heroicons-plus"
              >
                <span class="flex-1 text-left">
                  <p class="font-medium">Add Figma Source</p>
                  <p class="text-xs text-gray-500">Connect new Figma project</p>
                </span>
              </UButton>

              <UButton
                block
                variant="outline"
                color="pink"
                class="justify-start"
                icon="i-heroicons-plus"
              >
                <span class="flex-1 text-left">
                  <p class="font-medium">Add Slack Workspace</p>
                  <p class="text-xs text-gray-500">Connect new Slack team</p>
                </span>
              </UButton>

              <UButton
                block
                variant="outline"
                color="green"
                class="justify-start"
                icon="i-heroicons-arrow-path"
              >
                <span class="flex-1 text-left">
                  <p class="font-medium">Retry Failed Jobs</p>
                  <p class="text-xs text-gray-500">3 jobs need attention</p>
                </span>
              </UButton>

              <RouterLink to="/jobs">
                <UButton
                  block
                  variant="outline"
                  color="blue"
                  class="justify-start"
                  icon="i-heroicons-chart-bar"
                >
                  <span class="flex-1 text-left">
                    <p class="font-medium">View Analytics</p>
                    <p class="text-xs text-gray-500">Performance insights</p>
                  </span>
                </UButton>
              </RouterLink>
            </div>
          </UCard>

          <!-- System Health -->
          <UCard>
            <template #header>
              <h4 class="text-lg font-semibold text-gray-900">System Health</h4>
            </template>

            <div class="space-y-4">
              <div>
                <div class="flex items-center justify-between text-sm mb-2">
                  <span class="text-gray-600">API Response Time</span>
                  <span class="font-medium text-green-600">124ms</span>
                </div>
                <UProgress value="85" color="green" />
              </div>

              <div>
                <div class="flex items-center justify-between text-sm mb-2">
                  <span class="text-gray-600">Queue Depth</span>
                  <span class="font-medium text-blue-600">12</span>
                </div>
                <UProgress value="30" color="blue" />
              </div>

              <div>
                <div class="flex items-center justify-between text-sm mb-2">
                  <span class="text-gray-600">Error Rate</span>
                  <span class="font-medium text-amber-600">2.3%</span>
                </div>
                <UProgress value="12" color="amber" />
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>

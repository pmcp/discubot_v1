<script setup lang="ts">
const features = [
  {
    title: 'AI-Powered Analysis',
    description: 'Claude understands context, extracts action items, and generates clear task descriptions automatically.',
    icon: 'i-lucide-sparkles',
    color: 'primary' as const,
  },
  {
    title: 'Multi-Source Support',
    description: 'Currently supports Figma comments and Slack threads. More integrations coming soon.',
    icon: 'i-lucide-layers',
    color: 'blue' as const,
  },
  {
    title: 'Smart @Mentions',
    description: 'Automatically maps users across platforms so @mentions work correctly in Notion.',
    icon: 'i-lucide-at-sign',
    color: 'purple' as const,
  },
  {
    title: 'Full Visibility',
    description: 'Track every discussion processed with detailed job monitoring and complete history.',
    icon: 'i-lucide-eye',
    color: 'success' as const,
  },
  {
    title: 'Enterprise Security',
    description: 'Webhook verification, rate limiting, audit logs, and secure credential management.',
    icon: 'i-lucide-shield-check',
    color: 'orange' as const,
  },
  {
    title: 'Edge Performance',
    description: 'Deployed on Cloudflare Workers for global speed and reliability.',
    icon: 'i-lucide-zap',
    color: 'yellow' as const,
  },
]
</script>

<template>
  <div class="bg-gray-50 py-16 sm:py-24 dark:bg-gray-900/50">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <!-- Section header -->
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          Powerful Features
        </h2>
        <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Everything you need to streamline your workflow
        </p>
      </div>

      <!-- Feature grid -->
      <div class="mx-auto mt-16 max-w-6xl">
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="group relative rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-primary-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-950 dark:hover:border-primary-700"
          >
            <!-- Icon -->
            <div
              :class="[
                'mb-4 flex size-12 items-center justify-center rounded-xl',
                `bg-${feature.color}-100 dark:bg-${feature.color}-900/20`,
                'transition-transform group-hover:scale-110',
              ]"
            >
              <UIcon
                :name="feature.icon"
                :class="[
                  'size-6',
                  `text-${feature.color}-600 dark:text-${feature.color}-400`,
                ]"
              />
            </div>

            <!-- Content -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ feature.title }}
            </h3>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {{ feature.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

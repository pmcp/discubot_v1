<script setup lang="ts">
const steps = [
  {
    number: '01',
    title: 'Connect Your Tools',
    description: 'Link your Figma, Slack, and Notion accounts in minutes. No complex setup required.',
    icon: 'i-lucide-plug',
    color: 'primary' as const,
  },
  {
    number: '02',
    title: 'Discuss Naturally',
    description: 'Continue your design reviews and conversations in Figma and Slack like you always do.',
    icon: 'i-lucide-message-square',
    color: 'success' as const,
  },
  {
    number: '03',
    title: 'Tasks Auto-Created',
    description: 'Claude AI analyzes discussions and creates properly formatted tasks in Notion with @mentions.',
    icon: 'i-lucide-check-circle',
    color: 'purple' as const,
  },
]
</script>

<template>
  <div class="py-16 sm:py-24">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <!-- Section header -->
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          How Rakim Works
        </h2>
        <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Set up in minutes, save hours every week
        </p>
      </div>

      <!-- Steps -->
      <div class="mx-auto mt-16 max-w-5xl">
        <div class="grid gap-8 md:grid-cols-3">
          <div
            v-for="(step, index) in steps"
            :key="step.number"
            class="relative"
          >
            <!-- Connector line (desktop only) -->
            <div
              v-if="index < steps.length - 1"
              class="absolute left-1/2 top-12 hidden h-0.5 w-full bg-gradient-to-r from-gray-200 to-gray-300 md:block dark:from-gray-700 dark:to-gray-600"
            />

            <!-- Card -->
            <div class="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <!-- Number badge -->
              <div class="mb-4 flex items-start justify-between">
                <div
                  :class="[
                    'flex size-12 items-center justify-center rounded-xl',
                    `bg-${step.color}-100 dark:bg-${step.color}-900/20`,
                  ]"
                >
                  <UIcon
                    :name="step.icon"
                    :class="[
                      'size-6',
                      `text-${step.color}-600 dark:text-${step.color}-400`,
                    ]"
                  />
                </div>
                <span class="text-sm font-bold text-gray-300 dark:text-gray-700">
                  {{ step.number }}
                </span>
              </div>

              <!-- Content -->
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ step.title }}
              </h3>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {{ step.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

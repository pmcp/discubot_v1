<script setup lang="ts">
const problems = [
  'Tasks buried in Figma comments',
  'Action items lost in Slack threads',
  'Manual copy-paste to Notion',
  'Broken @mentions across tools',
  'No visibility into what was discussed',
]

const solutions = [
  'Automatic task extraction from discussions',
  'AI-powered context understanding',
  'One-click setup, zero maintenance',
  'Smart user mapping across platforms',
  'Complete audit trail and dashboard',
]
</script>

<template>
  <div class="py-16 sm:py-24">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <!-- Section header -->
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          Stop Losing Tasks in Discussions
        </h2>
        <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Your team's best ideas shouldn't disappear in comment threads
        </p>
      </div>

      <!-- Before/After comparison -->
      <div class="mx-auto mt-16 max-w-5xl">
        <div class="grid gap-8 lg:grid-cols-2">
          <!-- Before (Problems) -->
          <div class="relative rounded-2xl border-2 border-red-200 bg-white p-8 dark:border-red-900/50 dark:bg-gray-950">
            <div class="mb-6 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <UIcon name="i-lucide-x" class="size-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                Without Discubot
              </h3>
            </div>

            <ul class="space-y-4">
              <li
                v-for="problem in problems"
                :key="problem"
                class="flex items-start gap-3 text-gray-600 dark:text-gray-400"
              >
                <UIcon name="i-lucide-alert-circle" class="mt-0.5 size-5 shrink-0 text-red-500" />
                <span>{{ problem }}</span>
              </li>
            </ul>

            <!-- Chaos illustration -->
            <div class="mt-6 rounded-lg bg-red-50 p-4 dark:bg-red-950/20">
              <p class="text-center text-sm font-medium text-red-700 dark:text-red-400">
                Average team wastes 5+ hours/week on manual task tracking
              </p>
            </div>
          </div>

          <!-- After (Solutions) -->
          <div class="relative rounded-2xl border-2 border-green-200 bg-white p-8 dark:border-green-900/50 dark:bg-gray-950">
            <div class="mb-6 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <UIcon name="i-lucide-check" class="size-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                With Discubot
              </h3>
            </div>

            <ul class="space-y-4">
              <li
                v-for="solution in solutions"
                :key="solution"
                class="flex items-start gap-3 text-gray-600 dark:text-gray-400"
              >
                <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-5 shrink-0 text-green-500" />
                <span>{{ solution }}</span>
              </li>
            </ul>

            <!-- Success illustration -->
            <div class="mt-6 rounded-lg bg-green-50 p-4 dark:bg-green-950/20">
              <p class="text-center text-sm font-medium text-green-700 dark:text-green-400">
                Automate task creation and save hours every week
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

const problems = [
  { text: 'Tasks buried in Figma comments', icon: 'i-simple-icons-figma' },
  { text: 'Action items lost in Slack threads', icon: 'i-simple-icons-slack' },
  { text: 'Manual copy-paste to Notion', icon: 'i-lucide-copy' },
  { text: 'Broken @mentions across tools', icon: 'i-lucide-at-sign' },
  { text: 'No visibility into what was discussed', icon: 'i-lucide-eye-off' },
]

const solutions = [
  { text: 'Automatic task extraction from discussions', icon: 'i-lucide-sparkles' },
  { text: 'AI-powered context understanding', icon: 'i-lucide-brain' },
  { text: 'One-click setup, zero maintenance', icon: 'i-lucide-zap' },
  { text: 'Smart user mapping across platforms', icon: 'i-lucide-users' },
  { text: 'Complete audit trail and dashboard', icon: 'i-lucide-activity' },
]

const sectionRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  if (sectionRef.value) {
    useIntersectionObserver(
      sectionRef,
      ([{ isIntersecting }]) => {
        if (isIntersecting) isVisible.value = true
      },
      { threshold: 0.1 }
    )
  }
})
</script>

<template>
  <div ref="sectionRef" class="relative overflow-hidden py-16 sm:py-24">
    <!-- Background decoration -->
    <div class="absolute inset-0 -z-10 bg-gradient-to-b from-white via-gray-50/50 to-white dark:from-gray-950 dark:via-gray-900/50 dark:to-gray-950" />

    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <!-- Section header -->
      <div
        class="mx-auto max-w-2xl text-center transition-all duration-700"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
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
          <div
            class="group relative overflow-hidden rounded-2xl border-2 border-red-200 bg-white p-8 shadow-lg transition-all duration-700 hover:scale-105 hover:shadow-2xl dark:border-red-900/50 dark:bg-gray-950"
            :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
          >
            <!-- Animated background pattern -->
            <div class="absolute inset-0 -z-10 bg-red-50/50 transition-opacity duration-500 group-hover:opacity-100 dark:bg-red-950/10" />
            <div class="absolute -right-8 -top-8 size-32 animate-pulse rounded-full bg-red-200/20 blur-2xl dark:bg-red-800/20" />

            <div class="mb-6 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-red-100 transition-transform duration-300 group-hover:rotate-12 dark:bg-red-900/20">
                <UIcon name="i-lucide-x" class="size-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                Without Discubot
              </h3>
            </div>

            <ul class="space-y-4">
              <li
                v-for="(problem, index) in problems"
                :key="problem.text"
                class="group/item flex items-start gap-3 text-gray-600 transition-all duration-300 hover:translate-x-2 dark:text-gray-400"
                :style="{ transitionDelay: `${100 + index * 50}ms` }"
              >
                <div class="flex size-8 items-center justify-center rounded-lg bg-red-100/50 transition-colors duration-300 group-hover/item:bg-red-200 dark:bg-red-900/10 dark:group-hover/item:bg-red-900/30">
                  <UIcon :name="problem.icon" class="size-4 text-red-500" />
                </div>
                <span class="flex-1">{{ problem.text }}</span>
              </li>
            </ul>

            <!-- Chaos illustration -->
            <div class="mt-6 animate-pulse-subtle rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
              <p class="text-center text-sm font-medium text-red-700 dark:text-red-400">
                ⚠️ Average team wastes 5+ hours/week on manual task tracking
              </p>
            </div>
          </div>

          <!-- After (Solutions) -->
          <div
            class="group relative overflow-hidden rounded-2xl border-2 border-green-200 bg-white p-8 shadow-lg transition-all duration-700 delay-200 hover:scale-105 hover:shadow-2xl dark:border-green-900/50 dark:bg-gray-950"
            :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
          >
            <!-- Animated background pattern -->
            <div class="absolute inset-0 -z-10 bg-green-50/50 transition-opacity duration-500 group-hover:opacity-100 dark:bg-green-950/10" />
            <div class="absolute -right-8 -top-8 size-32 animate-pulse rounded-full bg-green-200/20 blur-2xl dark:bg-green-800/20" />

            <div class="mb-6 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-green-100 transition-transform duration-300 group-hover:rotate-12 dark:bg-green-900/20">
                <UIcon name="i-lucide-check" class="size-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                With Discubot
              </h3>
            </div>

            <ul class="space-y-4">
              <li
                v-for="(solution, index) in solutions"
                :key="solution.text"
                class="group/item flex items-start gap-3 text-gray-600 transition-all duration-300 hover:translate-x-2 dark:text-gray-400"
                :style="{ transitionDelay: `${200 + index * 50}ms` }"
              >
                <div class="flex size-8 items-center justify-center rounded-lg bg-green-100/50 transition-colors duration-300 group-hover/item:bg-green-200 dark:bg-green-900/10 dark:group-hover/item:bg-green-900/30">
                  <UIcon :name="solution.icon" class="size-4 text-green-500" />
                </div>
                <span class="flex-1">{{ solution.text }}</span>
              </li>
            </ul>

            <!-- Success illustration -->
            <div class="mt-6 animate-pulse-subtle rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/20">
              <p class="text-center text-sm font-medium text-green-700 dark:text-green-400">
                ✨ Automate task creation and save hours every week
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 3s ease-in-out infinite;
}

.animate-spin-slow {
  animation: spin-slow 3s linear infinite;
}
</style>

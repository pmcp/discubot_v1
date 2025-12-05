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
      (entries) => {
        if (entries[0]?.isIntersecting) isVisible.value = true
      },
      { threshold: 0.1 }
    )
  }
})
</script>

<template>
  <div ref="sectionRef" class="py-16 sm:py-24">
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
            class="rounded-xl border border-border/50 bg-card p-8 transition-all duration-700"
            :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
          >
            <div class="mb-6 flex items-center gap-3">
              <UIcon name="i-lucide-x" class="size-5 text-muted-foreground" />
              <h3 class="text-lg font-medium text-foreground">
                Without rakim
              </h3>
            </div>

            <ul class="space-y-3">
              <li
                v-for="problem in problems"
                :key="problem.text"
                class="flex items-start gap-3 text-muted-foreground"
              >
                <UIcon :name="problem.icon" class="size-4 mt-0.5 shrink-0" />
                <span>{{ problem.text }}</span>
              </li>
            </ul>
          </div>

          <!-- After (Solutions) -->
          <div
            class="rounded-xl border border-border/50 bg-card p-8 transition-all duration-700 delay-200"
            :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
          >
            <div class="mb-6 flex items-center gap-3">
              <UIcon name="i-lucide-check" class="size-5 text-primary" />
              <h3 class="text-lg font-medium text-foreground">
                With rakim
              </h3>
            </div>

            <ul class="space-y-3">
              <li
                v-for="solution in solutions"
                :key="solution.text"
                class="flex items-start gap-3 text-muted-foreground"
              >
                <UIcon :name="solution.icon" class="size-4 mt-0.5 shrink-0 text-primary" />
                <span>{{ solution.text }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

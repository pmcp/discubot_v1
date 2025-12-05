<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

const comparisons = [
  { before: 'Tasks buried in Figma comments', after: 'Auto-extracted from discussions' },
  { before: 'Action items lost in Slack threads', after: 'AI understands context' },
  { before: 'Manual copy-paste to Notion', after: 'One-click setup' },
  { before: 'Broken @mentions across tools', after: 'Smart user mapping' },
  { before: 'No visibility into discussions', after: 'Complete audit trail' },
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
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <!-- Section header -->
      <div
        class="mx-auto max-w-2xl text-center transition-all duration-700"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          Stop Losing Tasks in Discussions
        </h2>
        <p class="mt-3 text-base text-gray-600 sm:text-lg dark:text-gray-400">
          Your team's best ideas shouldn't disappear in comment threads
        </p>
      </div>

      <!-- Single card with comparison rows -->
      <div
        class="mx-auto mt-10 max-w-4xl transition-all duration-700"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
      >
        <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-gray-900">
          <!-- Header row -->
          <div class="grid grid-cols-2">
            <div class="px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
              <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                <UIcon name="i-lucide-x" class="size-4" />
                <span>Before</span>
              </div>
            </div>
            <div class="px-6 py-4 bg-primary-50 dark:bg-primary-950/30">
              <div class="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400">
                <UIcon name="i-lucide-sparkles" class="size-4" />
                <span>With Rakim</span>
              </div>
            </div>
          </div>
          <!-- Comparison rows -->
          <div>
            <div
              v-for="(item, index) in comparisons"
              :key="index"
              class="grid grid-cols-2"
            >
              <div class="px-6 py-3 text-sm text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">
                {{ item.before }}
              </div>
              <div class="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white bg-primary-50/50 dark:bg-primary-950/20">
                {{ item.after }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

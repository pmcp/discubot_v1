<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

const props = defineProps<{
  headline?: string
  subheadline?: string
  primaryCta?: { label: string; to: string }
  secondaryCta?: { label: string; to?: string; onClick?: () => void }
}>()

const emit = defineEmits<{
  'secondary-click': []
}>()

const handleSecondaryClick = () => {
  if (props.secondaryCta?.onClick) {
    props.secondaryCta.onClick()
  }
  emit('secondary-click')
}

// Animation state
const heroRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  if (heroRef.value) {
    useIntersectionObserver(
      heroRef,
      ([{ isIntersecting }]) => {
        if (isIntersecting) isVisible.value = true
      },
      { threshold: 0.1 }
    )
  }
  // Trigger animation immediately on mount
  setTimeout(() => isVisible.value = true, 100)
})

const integrations = [
  { name: 'Figma', icon: 'i-simple-icons-figma', color: 'from-purple-500 to-pink-500', available: true },
  { name: 'Slack', icon: 'i-simple-icons-slack', color: 'from-green-500 to-teal-500', available: true },
  { name: 'Notion', icon: 'i-simple-icons-notion', color: 'from-gray-700 to-gray-900', available: true },
  { name: 'More', icon: 'i-lucide-sparkles', color: 'from-blue-500 to-indigo-500', available: false }
]
</script>

<template>
  <div ref="heroRef" class="relative overflow-hidden py-16 sm:py-24">
    <!-- Animated background gradient -->
    <div class="absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 dark:from-primary-950/20 dark:via-purple-950/10 dark:to-pink-950/10 animate-gradient" />

    <!-- Floating orbs for funky effect -->
    <div class="absolute left-1/4 top-20 -z-10 size-72 animate-blob rounded-full bg-purple-300/20 mix-blend-multiply blur-xl filter dark:bg-purple-600/10" />
    <div class="animation-delay-2000 absolute right-1/4 top-20 -z-10 size-72 animate-blob rounded-full bg-pink-300/20 mix-blend-multiply blur-xl filter dark:bg-pink-600/10" />
    <div class="animation-delay-4000 absolute left-1/3 top-40 -z-10 size-72 animate-blob rounded-full bg-primary-300/20 mix-blend-multiply blur-xl filter dark:bg-primary-600/10" />

    <!-- Content -->
    <div class="mx-auto max-w-4xl px-6 text-center lg:px-8">
      <!-- Trust badge -->
      <div
        class="mb-8 flex items-center justify-center gap-2 transition-all duration-700"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <UBadge color="primary" variant="subtle" size="lg" class="animate-pulse-subtle">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="size-4 animate-spin-slow" />
            <span>Powered by Claude AI</span>
          </div>
        </UBadge>
      </div>

      <!-- Headline -->
      <h1
        class="text-4xl font-bold tracking-tight text-balance text-gray-900 sm:text-6xl dark:text-white transition-all duration-700 delay-100"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        {{ headline || 'Never lose a task buried in design comments or Slack threads' }}
      </h1>

      <!-- Subheadline -->
      <p
        class="mx-auto mt-6 max-w-2xl text-lg text-balance text-gray-600 sm:text-xl dark:text-gray-400 transition-all duration-700 delay-200"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        {{ subheadline || 'Discubot uses AI to automatically convert Figma comments and Slack discussions into actionable Notion tasks' }}
      </p>

      <!-- CTAs -->
      <div
        class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row transition-all duration-700 delay-300"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <UButton
          v-if="primaryCta"
          :to="primaryCta.to"
          color="primary"
          size="xl"
          trailing-icon="i-lucide-arrow-right"
          class="w-full sm:w-auto transition-all duration-300 hover:scale-105 hover:shadow-xl"
        >
          {{ primaryCta.label }}
        </UButton>

        <UButton
          v-if="secondaryCta"
          :to="secondaryCta.to"
          color="gray"
          variant="ghost"
          size="xl"
          icon="i-lucide-play-circle"
          class="w-full sm:w-auto transition-all duration-300 hover:scale-105"
          @click="handleSecondaryClick"
        >
          {{ secondaryCta.label }}
        </UButton>
      </div>

      <!-- Integration Flow Visualization -->
      <div
        class="mt-16 transition-all duration-700 delay-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <p class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Connect Your Tools
        </p>

        <!-- Flow Container -->
        <div class="relative mx-auto mt-12 max-w-5xl">
          <!-- Animated background glow -->
          <div class="absolute left-1/2 top-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 animate-pulse-glow rounded-full bg-primary-400/10 blur-3xl" />

          <div class="grid grid-cols-1 gap-8 lg:grid-cols-7 lg:items-center">
            <!-- Source Tools (Left) -->
            <div class="space-y-4 lg:col-span-2">
              <!-- Figma -->
              <div
                class="group relative overflow-hidden rounded-xl border-2 border-gray-200 bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-purple-300 hover:shadow-2xl dark:border-gray-700 dark:bg-gray-900/80 dark:hover:border-purple-600"
                :style="{ transitionDelay: '600ms' }"
              >
                <div class="flex items-center gap-3">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-2 transition-transform duration-300 group-hover:rotate-12">
                    <UIcon name="i-simple-icons-figma" class="size-full text-white" />
                  </div>
                  <span class="font-bold text-gray-900 dark:text-white">Figma</span>
                  <div class="ml-auto size-3 rounded-full bg-green-500" />
                  <div class="absolute -right-1 -top-1 size-3 animate-ping rounded-full bg-green-400" />
                </div>
                <!-- Flowing particles to AI -->
                <div class="absolute -right-4 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 lg:block">
                  <div class="animate-flow-right h-full w-full bg-gradient-to-r from-purple-400 to-transparent" />
                </div>
              </div>

              <!-- Slack -->
              <div
                class="group relative overflow-hidden rounded-xl border-2 border-gray-200 bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-green-300 hover:shadow-2xl dark:border-gray-700 dark:bg-gray-900/80 dark:hover:border-green-600"
                :style="{ transitionDelay: '700ms' }"
              >
                <div class="flex items-center gap-3">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-teal-500 p-2 transition-transform duration-300 group-hover:rotate-12">
                    <UIcon name="i-simple-icons-slack" class="size-full text-white" />
                  </div>
                  <span class="font-bold text-gray-900 dark:text-white">Slack</span>
                  <div class="ml-auto size-3 rounded-full bg-green-500" />
                  <div class="absolute -right-1 -top-1 size-3 animate-ping rounded-full bg-green-400" />
                </div>
                <!-- Flowing particles to AI -->
                <div class="absolute -right-4 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 lg:block">
                  <div class="animation-delay-1000 animate-flow-right h-full w-full bg-gradient-to-r from-green-400 to-transparent" />
                </div>
              </div>

              <!-- Email (Coming Soon) -->
              <div
                class="group relative overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white/50 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 dark:border-gray-700 dark:bg-gray-900/50"
                :style="{ transitionDelay: '800ms' }"
              >
                <div class="flex items-center gap-3">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 p-2 opacity-60 transition-transform duration-300 group-hover:rotate-12">
                    <UIcon name="i-lucide-mail" class="size-full animate-pulse text-white" />
                  </div>
                  <span class="font-bold text-gray-500 dark:text-gray-400">Email</span>
                  <UBadge color="primary" variant="subtle" size="xs" class="ml-auto animate-bounce">
                    Soon
                  </UBadge>
                </div>
              </div>
            </div>

            <!-- AI Hub (Center) -->
            <div class="flex justify-center lg:col-span-3">
              <div
                class="group relative overflow-hidden rounded-2xl border-2 border-primary-300 bg-gradient-to-br from-primary-50 to-purple-50 p-8 shadow-2xl transition-all duration-500 hover:scale-110 hover:shadow-primary-500/20 dark:border-primary-600 dark:from-primary-950/40 dark:to-purple-950/40"
                :style="{ transitionDelay: '900ms' }"
              >
                <!-- Pulsing glow effect -->
                <div class="absolute inset-0 -z-10 animate-pulse-slow rounded-2xl bg-primary-400/20 blur-xl" />

                <div class="flex flex-col items-center gap-4">
                  <!-- AI Brain Icon -->
                  <div class="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 p-4 shadow-lg transition-transform duration-500 group-hover:rotate-12">
                    <UIcon name="i-lucide-sparkles" class="size-full animate-spin-slow text-white" />
                  </div>

                  <!-- AI Label -->
                  <div class="text-center">
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                      AI Processing
                    </h3>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Powered by Claude
                    </p>
                  </div>

                  <!-- Processing indicators -->
                  <div class="flex gap-2">
                    <div class="size-2 animate-bounce rounded-full bg-primary-500" style="animation-delay: 0ms" />
                    <div class="size-2 animate-bounce rounded-full bg-primary-500" style="animation-delay: 150ms" />
                    <div class="size-2 animate-bounce rounded-full bg-primary-500" style="animation-delay: 300ms" />
                  </div>
                </div>

                <!-- Connection lines -->
                <div class="absolute -right-4 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 lg:block">
                  <div class="animation-delay-2000 animate-flow-right h-full w-full bg-gradient-to-r from-primary-400 to-transparent" />
                </div>
              </div>
            </div>

            <!-- Notion Destination (Right) -->
            <div class="flex justify-center lg:col-span-2">
              <div
                class="group relative w-full overflow-hidden rounded-xl border-2 border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-gray-400 hover:shadow-2xl dark:border-gray-700 dark:bg-gray-900/80 dark:hover:border-gray-500"
                :style="{ transitionDelay: '1000ms' }"
              >
                <div class="flex flex-col items-center gap-4 text-center">
                  <div class="flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 p-3 transition-transform duration-300 group-hover:rotate-12">
                    <UIcon name="i-simple-icons-notion" class="size-full text-white" />
                  </div>
                  <div>
                    <h4 class="font-bold text-gray-900 dark:text-white">
                      Notion
                    </h4>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Organized tasks
                    </p>
                  </div>
                  <!-- Success indicator -->
                  <div class="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 dark:bg-green-900/20">
                    <UIcon name="i-lucide-check-circle" class="size-4 text-green-600 dark:text-green-400" />
                    <span class="text-xs font-medium text-green-700 dark:text-green-400">Auto-synced</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional integrations teaser -->
        <p class="mt-12 text-xs text-gray-500 dark:text-gray-400">
          More integrations coming soon: Linear, Jira, Asana & more
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes gradient {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes blob {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
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

@keyframes flow-right {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateX(200%);
    opacity: 0;
  }
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

@keyframes pulse-slow {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 15s ease infinite;
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-1000 {
  animation-delay: 1s;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-spin-slow {
  animation: spin-slow 3s linear infinite;
}

.animate-flow-right {
  animation: flow-right 2s ease-in-out infinite;
}

.animate-pulse-glow {
  animation: pulse-glow 4s ease-in-out infinite;
}

.animate-pulse-slow {
  animation: pulse-slow 3s ease-in-out infinite;
}
</style>

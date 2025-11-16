<script setup lang="ts">
import { ref } from 'vue'

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
</script>

<template>
  <div class="relative overflow-hidden py-16 sm:py-24">
    <!-- Background gradient -->
    <div class="absolute inset-0 -z-10 bg-gradient-to-b from-primary-50 to-white dark:from-primary-950/20 dark:to-gray-950" />

    <!-- Content -->
    <div class="mx-auto max-w-4xl px-6 text-center lg:px-8">
      <!-- Trust badge -->
      <div class="mb-8 flex items-center justify-center gap-2">
        <UBadge color="primary" variant="subtle" size="lg">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="size-4" />
            <span>Powered by Claude AI</span>
          </div>
        </UBadge>
      </div>

      <!-- Headline -->
      <h1 class="text-4xl font-bold tracking-tight text-balance text-gray-900 sm:text-6xl dark:text-white">
        {{ headline || 'Never lose a task buried in design comments or Slack threads' }}
      </h1>

      <!-- Subheadline -->
      <p class="mx-auto mt-6 max-w-2xl text-lg text-balance text-gray-600 sm:text-xl dark:text-gray-400">
        {{ subheadline || 'Discubot uses AI to automatically convert Figma comments and Slack discussions into actionable Notion tasks' }}
      </p>

      <!-- CTAs -->
      <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <UButton
          v-if="primaryCta"
          :to="primaryCta.to"
          color="primary"
          size="xl"
          trailing-icon="i-lucide-arrow-right"
          class="w-full sm:w-auto"
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
          class="w-full sm:w-auto"
          @click="handleSecondaryClick"
        >
          {{ secondaryCta.label }}
        </UButton>
      </div>

      <!-- Integration logos -->
      <div class="mt-12">
        <p class="text-sm font-semibold text-gray-500 dark:text-gray-400">
          Connects your favorite tools
        </p>
        <div class="mt-4 flex items-center justify-center gap-8">
          <div class="flex items-center gap-2">
            <UIcon name="i-simple-icons-figma" class="size-6 text-gray-400" />
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Figma</span>
          </div>
          <UIcon name="i-lucide-arrow-right" class="size-4 text-gray-300" />
          <div class="flex items-center gap-2">
            <UIcon name="i-simple-icons-slack" class="size-6 text-gray-400" />
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Slack</span>
          </div>
          <UIcon name="i-lucide-arrow-right" class="size-4 text-gray-300" />
          <div class="flex items-center gap-2">
            <UIcon name="i-simple-icons-notion" class="size-6 text-gray-400" />
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Notion</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

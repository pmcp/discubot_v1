<script setup lang="ts">
defineProps<{
  headline?: string
  subheadline?: string
  primaryCta?: { label: string; to: string }
}>()
</script>

<template>
  <div class="relative overflow-hidden bg-primary-600 py-16 sm:py-24 dark:bg-primary-900">
    <!-- Background pattern -->
    <div class="absolute inset-0 -z-10 opacity-10">
      <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]" />
    </div>

    <div class="mx-auto max-w-4xl px-6 text-center lg:px-8">
      <!-- Icon -->
      <div class="mb-6 flex justify-center">
        <div class="flex size-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
          <UIcon name="i-lucide-rocket" class="size-8 text-white" />
        </div>
      </div>

      <!-- Headline -->
      <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {{ headline || 'Start Automating Your Workflow Today' }}
      </h2>

      <!-- Subheadline -->
      <p class="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
        {{ subheadline || 'Join teams saving hours every week by automating task creation from discussions' }}
      </p>

      <!-- CTA -->
      <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <UButton
          v-if="primaryCta"
          :to="primaryCta.to"
          color="white"
          size="xl"
          trailing-icon="i-lucide-arrow-right"
          class="w-full sm:w-auto"
        >
          {{ primaryCta.label }}
        </UButton>

        <p class="text-sm text-primary-100">
          No credit card required • 5-minute setup
        </p>
      </div>

      <!-- Trust signals -->
      <div class="mt-12 flex flex-wrap items-center justify-center gap-8 text-primary-100">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-shield-check" class="size-5" />
          <span class="text-sm">Enterprise security</span>
        </div>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-zap" class="size-5" />
          <span class="text-sm">Edge performance</span>
        </div>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-headphones" class="size-5" />
          <span class="text-sm">24/7 support</span>
        </div>
      </div>
    </div>
  </div>
</template>

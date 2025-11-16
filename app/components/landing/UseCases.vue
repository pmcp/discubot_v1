<script setup lang="ts">
const useCases = [
  {
    title: 'Product Teams',
    quote: 'Design decisions become Notion tasks instantly. No more lost feedback from weekly reviews.',
    icon: 'i-lucide-palette',
    role: 'Product Designer',
    color: 'blue' as const,
    stats: '87% faster task creation',
  },
  {
    title: 'Engineering Teams',
    quote: 'Slack technical discussions automatically tracked. Every decision is documented and actionable.',
    icon: 'i-lucide-code',
    role: 'Engineering Manager',
    color: 'purple' as const,
    stats: '5+ hours saved weekly',
  },
  {
    title: 'Design Systems',
    quote: 'Component feedback from Figma flows directly to our backlog with proper prioritization.',
    icon: 'i-lucide-layers',
    role: 'Design Systems Lead',
    color: 'success' as const,
    stats: '100% feedback captured',
  },
]
</script>

<template>
  <div class="bg-gray-50 py-16 sm:py-24 dark:bg-gray-900/50">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <!-- Section header -->
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          Built for Modern Teams
        </h2>
        <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
          See how teams use Discubot to streamline their workflow
        </p>
      </div>

      <!-- Use case cards -->
      <div class="mx-auto mt-16 max-w-6xl">
        <div class="grid gap-8 lg:grid-cols-3">
          <div
            v-for="useCase in useCases"
            :key="useCase.title"
            class="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg dark:border-gray-800 dark:bg-gray-950"
          >
            <!-- Icon badge -->
            <div
              :class="[
                'mb-4 inline-flex size-12 items-center justify-center rounded-xl',
                `bg-${useCase.color}-100 dark:bg-${useCase.color}-900/20`,
              ]"
            >
              <UIcon
                :name="useCase.icon"
                :class="[
                  'size-6',
                  `text-${useCase.color}-600 dark:text-${useCase.color}-400`,
                ]"
              />
            </div>

            <!-- Title -->
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ useCase.title }}
            </h3>

            <!-- Quote -->
            <blockquote class="mt-4 border-l-4 border-gray-200 pl-4 italic text-gray-600 dark:border-gray-700 dark:text-gray-400">
              "{{ useCase.quote }}"
            </blockquote>

            <!-- Role -->
            <p class="mt-4 text-sm font-medium text-gray-500 dark:text-gray-500">
              — {{ useCase.role }}
            </p>

            <!-- Stats -->
            <div class="mt-6 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
              <p
                :class="[
                  'text-center text-sm font-bold',
                  `text-${useCase.color}-600 dark:text-${useCase.color}-400`,
                ]"
              >
                {{ useCase.stats }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

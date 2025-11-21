<template>
  <!-- Desktop: Always rendered, CSS controls visibility -->
  <div
    class="relative hidden w-0 flex-col items-stretch overflow-hidden border-r border-neutral-200 bg-neutral-100 p-2 lg:flex lg:w-64 dark:border-neutral-900 dark:bg-black"
  >
    <slot />
  </div>

  <!-- Mobile: USlideover wrapped in ClientOnly to prevent SSR -->
  <ClientOnly>
    <USlideover
      v-if="smallerThanLg"
      v-model:open="model"
      side="left"
      :ui="{ content: 'max-w-[75%] sm:max-w-[50%]' }"
    >
      <template #content>
        <div class="flex h-full flex-col p-2">
          <slot />
        </div>
      </template>
    </USlideover>
  </ClientOnly>
</template>

<script lang="ts" setup>
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'

const model = defineModel<boolean>({ required: true })
const breakpoints = useBreakpoints(breakpointsTailwind)
const smallerThanLg = breakpoints.smaller('lg')
</script>

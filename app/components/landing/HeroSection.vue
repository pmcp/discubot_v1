<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

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
const isVisible = ref(false)

onMounted(() => {
  setTimeout(() => isVisible.value = true, 100)
})

// Icon labels for explanations
const iconLabels: Record<string, string> = {
  'i-simple-icons-figma': 'Figma',
  'i-simple-icons-slack': 'Slack',
  'i-simple-icons-notion': 'Notion',
  'i-simple-icons-github': 'GitHub',
  'i-simple-icons-linear': 'Linear',
  'i-lucide-mail': 'Email',
  'i-lucide-brain': 'AI Processing',
  'i-lucide-palette': 'Design Focus',
  'i-lucide-code': 'Technical Focus',
  'i-lucide-package': 'Product Focus',
  'i-lucide-zap': 'Concise Style',
  'i-lucide-smile': 'Friendly Tone',
  'i-lucide-flower-2': 'Zen Personality',
  'i-lucide-briefcase': 'Professional Tone',
  'i-lucide-bot': 'Robot Personality',
  'i-lucide-pencil': 'Custom Personality'
}

// Example flows - diverse and complex
const exampleFlows = [
  {
    name: 'Design Review Pipeline',
    description: 'Figma feedback analyzed for design tasks',
    inputs: [
      { icon: 'i-simple-icons-figma', color: 'text-[#F24E1E]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-palette', color: 'text-pink-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' }
    ]
  },
  {
    name: 'Engineering Triage',
    description: 'Slack threads become Linear tickets',
    inputs: [
      { icon: 'i-simple-icons-slack', color: 'text-[#4A154B] dark:text-[#E01E5A]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-code', color: 'text-emerald-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-linear', color: 'text-[#5E6AD2]' }
    ]
  },
  {
    name: 'Product Feedback Hub',
    description: 'Multi-source feedback to product board',
    inputs: [
      { icon: 'i-simple-icons-figma', color: 'text-[#F24E1E]' },
      { icon: 'i-simple-icons-slack', color: 'text-[#4A154B] dark:text-[#E01E5A]' },
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-package', color: 'text-blue-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' }
    ]
  },
  {
    name: 'Bug Reporter',
    description: 'Figma bugs to GitHub issues',
    inputs: [
      { icon: 'i-simple-icons-figma', color: 'text-[#F24E1E]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-zap', color: 'text-amber-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-github', color: 'text-gray-900 dark:text-white' }
    ]
  },
  {
    name: 'Cross-Team Sync',
    description: 'Slack to design and engineering boards',
    inputs: [
      { icon: 'i-simple-icons-slack', color: 'text-[#4A154B] dark:text-[#E01E5A]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-briefcase', color: 'text-slate-600' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' },
      { icon: 'i-simple-icons-linear', color: 'text-[#5E6AD2]' }
    ]
  },
  {
    name: 'Friendly Support Bot',
    description: 'Notion comments get friendly AI replies',
    inputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-smile', color: 'text-yellow-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' }
    ]
  },
  {
    name: 'Full Stack Intake',
    description: 'All channels to all destinations',
    inputs: [
      { icon: 'i-simple-icons-figma', color: 'text-[#F24E1E]' },
      { icon: 'i-simple-icons-slack', color: 'text-[#4A154B] dark:text-[#E01E5A]' },
      { icon: 'i-lucide-mail', color: 'text-blue-500' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' },
      { icon: 'i-simple-icons-github', color: 'text-gray-900 dark:text-white' },
      { icon: 'i-simple-icons-linear', color: 'text-[#5E6AD2]' }
    ]
  },
  {
    name: 'Zen Documentation',
    description: 'Calm, thoughtful task summaries',
    inputs: [
      { icon: 'i-simple-icons-slack', color: 'text-[#4A154B] dark:text-[#E01E5A]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-flower-2', color: 'text-teal-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' }
    ]
  },
  {
    name: 'Design System Tracker',
    description: 'Figma comments split by domain',
    inputs: [
      { icon: 'i-simple-icons-figma', color: 'text-[#F24E1E]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-palette', color: 'text-pink-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' },
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' }
    ]
  },
  {
    name: 'Concise Tech Specs',
    description: 'Brief, technical task extraction',
    inputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' },
      { icon: 'i-simple-icons-slack', color: 'text-[#4A154B] dark:text-[#E01E5A]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-zap', color: 'text-amber-500' },
      { icon: 'i-lucide-code', color: 'text-emerald-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-linear', color: 'text-[#5E6AD2]' }
    ]
  },
  {
    name: 'Creative Review',
    description: 'Design feedback with personality',
    inputs: [
      { icon: 'i-simple-icons-figma', color: 'text-[#F24E1E]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-pencil', color: 'text-orange-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' }
    ]
  },
  {
    name: 'Robot Responder',
    description: 'Automated, precise acknowledgments',
    inputs: [
      { icon: 'i-simple-icons-slack', color: 'text-[#4A154B] dark:text-[#E01E5A]' },
      { icon: 'i-simple-icons-figma', color: 'text-[#F24E1E]' }
    ],
    ai: [
      { icon: 'i-lucide-brain', color: 'text-violet-500' },
      { icon: 'i-lucide-bot', color: 'text-cyan-500' }
    ],
    outputs: [
      { icon: 'i-simple-icons-notion', color: 'text-gray-900 dark:text-white' },
      { icon: 'i-simple-icons-github', color: 'text-gray-900 dark:text-white' }
    ]
  }
]

// Helper to get label for icon
const getIconLabel = (icon: string) => iconLabels[icon] || icon

// Auto-scroll animation
const scrollContainer = ref<HTMLElement | null>(null)
const scrollPosition = ref(0)
let animationFrame: number | null = null

const animate = () => {
  // Only advance if not paused
  if (!isPaused.value) {
    scrollPosition.value += 0.5

    // Reset when scrolled past half (for seamless loop)
    if (scrollContainer.value) {
      const halfHeight = scrollContainer.value.scrollHeight / 2
      if (scrollPosition.value >= halfHeight) {
        scrollPosition.value = 0
      }
    }
  }

  animationFrame = requestAnimationFrame(animate)
}

onMounted(() => {
  animationFrame = requestAnimationFrame(animate)
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
})

// Pause on hover
const isPaused = ref(false)
const pauseScroll = () => isPaused.value = true
const resumeScroll = () => isPaused.value = false
</script>

<template>
  <div class="py-12 sm:py-24">
    <!-- Content -->
    <div class="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
      <!-- Trust badge -->
      <div
        class="mb-8 flex items-center justify-center transition-all duration-700"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <UBadge color="primary" variant="subtle" size="lg">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="size-4" />
            <span>Powered by Claude AI</span>
          </div>
        </UBadge>
      </div>

      <!-- Headline -->
      <h1
        class="text-3xl font-bold tracking-tight text-balance text-gray-900 sm:text-4xl lg:text-6xl dark:text-white transition-all duration-700 delay-100"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        {{ headline || 'Stay on track of tasks while keeping the flow' }}
      </h1>

      <!-- Subheadline -->
      <p
        class="mx-auto mt-6 max-w-2xl text-lg text-balance text-gray-600 sm:text-xl dark:text-gray-400 transition-all duration-700 delay-200"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <template v-if="!subheadline">
          Rakim uses AI to turn Figma or Slack<UIcon name="i-lucide-sparkle" class="inline size-3 text-primary align-super" /> discussions into actionable Notion<UIcon name="i-lucide-sparkle" class="inline size-3 text-primary align-super" /> tasks, so you can stay in the flow of the conversation without losing track of what needs to be done.
        </template>
        <template v-else>{{ subheadline }}</template>
      </p>

      <!-- Services footnote -->
      <p
        class="mt-3 text-xs text-gray-400 dark:text-gray-500 transition-all duration-700 delay-200"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <UIcon name="i-lucide-sparkle" class="inline size-2.5 text-primary" /> more services coming soon
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
          class="w-full sm:w-auto"
        >
          {{ primaryCta.label }}
        </UButton>

        <UButton
          v-if="secondaryCta"
          :to="secondaryCta.to"
          color="neutral"
          variant="ghost"
          size="xl"
          icon="i-lucide-play-circle"
          class="w-full sm:w-auto"
          @click="handleSecondaryClick"
        >
          {{ secondaryCta.label }}
        </UButton>
      </div>

      <!-- Auto-scrolling Example Flows -->
      <div
        class="mt-20 transition-all duration-700 delay-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <p class="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-6">
          Flows being created
        </p>

        <!-- Scroll Container with Mask -->
        <div class="relative h-72 overflow-hidden">
          <!-- Fade masks - top and bottom gradients -->
          <div class="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white from-20% to-transparent z-10 pointer-events-none dark:from-gray-950" />
          <div class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white from-20% to-transparent z-10 pointer-events-none dark:from-gray-950" />

          <!-- Scrolling content -->
          <div
            ref="scrollContainer"
            class="space-y-3 max-w-lg mx-auto"
            :style="{ transform: `translateY(-${scrollPosition}px)` }"
          >
            <!-- Double the items for seamless loop -->
            <template v-for="repeat in 2" :key="repeat">
              <UPopover
                v-for="(flow, index) in exampleFlows"
                :key="`${repeat}-${index}`"
                mode="hover"
                :ui="{ content: 'p-4' }"
                @open="pauseScroll"
                @close="resumeScroll"
              >
                <div
                  class="group flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors cursor-default"
                  @mouseenter="pauseScroll"
                  @mouseleave="resumeScroll"
                >
                  <!-- Pipeline Visual -->
                  <div class="flex items-center gap-3 shrink-0">
                    <!-- Inputs -->
                    <div class="flex items-center gap-1.5">
                      <UIcon
                        v-for="(input, i) in flow.inputs"
                        :key="i"
                        :name="input.icon"
                        :class="['size-5 transition-transform group-hover:scale-110', input.color]"
                      />
                    </div>

                    <!-- Arrow -->
                    <span class="text-muted-foreground/40">→</span>

                    <!-- AI -->
                    <div class="flex items-center gap-1.5">
                      <UIcon
                        v-for="(ai, i) in flow.ai"
                        :key="i"
                        :name="ai.icon"
                        :class="['size-5 transition-transform group-hover:scale-110', ai.color]"
                      />
                    </div>

                    <!-- Arrow -->
                    <span class="text-muted-foreground/40">→</span>

                    <!-- Outputs -->
                    <div class="flex items-center gap-1.5">
                      <UIcon
                        v-for="(output, i) in flow.outputs"
                        :key="i"
                        :name="output.icon"
                        :class="['size-5 transition-transform group-hover:scale-110', output.color]"
                      />
                    </div>
                  </div>

                  <!-- Description -->
                  <div class="text-left min-w-0 flex-1">
                    <p class="text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">
                      {{ flow.description }}
                    </p>
                  </div>
                </div>

                <!-- Popover Content -->
                <template #content>
                  <div class="space-y-3 min-w-[200px]">
                    <p class="font-medium text-sm">{{ flow.name }}</p>

                    <!-- Inputs explanation -->
                    <div class="space-y-1">
                      <p class="text-xs text-muted-foreground uppercase tracking-wider">Inputs</p>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="(input, i) in flow.inputs"
                          :key="i"
                          class="flex items-center gap-1.5"
                        >
                          <UIcon :name="input.icon" :class="['size-4', input.color]" />
                          <span class="text-xs">{{ getIconLabel(input.icon) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- AI explanation -->
                    <div class="space-y-1">
                      <p class="text-xs text-muted-foreground uppercase tracking-wider">AI Processing</p>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="(ai, i) in flow.ai"
                          :key="i"
                          class="flex items-center gap-1.5"
                        >
                          <UIcon :name="ai.icon" :class="['size-4', ai.color]" />
                          <span class="text-xs">{{ getIconLabel(ai.icon) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Outputs explanation -->
                    <div class="space-y-1">
                      <p class="text-xs text-muted-foreground uppercase tracking-wider">Outputs</p>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="(output, i) in flow.outputs"
                          :key="i"
                          class="flex items-center gap-1.5"
                        >
                          <UIcon :name="output.icon" :class="['size-4', output.color]" />
                          <span class="text-xs">{{ getIconLabel(output.icon) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </UPopover>
            </template>
          </div>
        </div>

        <!-- Coming soon note -->
        <p class="mt-6 text-xs text-muted-foreground">
          Linear, GitHub, Jira & more integrations available
        </p>
      </div>
    </div>
  </div>
</template>

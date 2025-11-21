<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, StepperItem } from '@nuxt/ui'
import type { Flow, FlowInput, FlowOutput, NotionOutputConfig } from '~/layers/discubot/types'

/**
 * FlowBuilder - Multi-step wizard for creating/editing flows
 *
 * This component provides a guided experience for setting up flows with:
 * - Step 1: Flow settings (name, AI config, domains)
 * - Step 2: Input management (Slack, Figma, Email sources)
 * - Step 3: Output management (Notion, GitHub, Linear destinations with domain routing)
 */

interface Props {
  /** Team ID for the flow */
  teamId: string
  /** Existing flow to edit (undefined for new flow) */
  flow?: Partial<Flow>
  /** Existing inputs (for editing) */
  inputs?: FlowInput[]
  /** Existing outputs (for editing) */
  outputs?: FlowOutput[]
  /** Callback on successful save */
  onSuccess?: (flowId: string) => void
  /** Callback on cancel */
  onCancel?: () => void
}

const props = defineProps<Props>()
const emit = defineEmits<{
  success: [flowId: string]
  cancel: []
}>()

// ============================================================================
// REFS & STATE
// ============================================================================

const stepper = useTemplateRef('stepper')
const currentStep = ref(0)
const loading = ref(false)
const toast = useToast()

// Default domains for new flows
const DEFAULT_DOMAINS = ['design', 'frontend', 'backend', 'product', 'infrastructure', 'docs']

// ============================================================================
// STEP 1: FLOW SETTINGS
// ============================================================================

const flowSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  aiEnabled: z.boolean().default(true),
  anthropicApiKey: z.string().optional(),
  aiSummaryPrompt: z.string().optional(),
  aiTaskPrompt: z.string().optional(),
  availableDomains: z.array(z.string()).min(1, 'At least one domain required').default(DEFAULT_DOMAINS)
})

type FlowSchema = z.output<typeof flowSchema>

const flowState = reactive<Partial<FlowSchema>>({
  name: props.flow?.name || '',
  description: props.flow?.description || '',
  aiEnabled: props.flow?.aiEnabled ?? true,
  anthropicApiKey: props.flow?.anthropicApiKey || '',
  aiSummaryPrompt: props.flow?.aiSummaryPrompt || '',
  aiTaskPrompt: props.flow?.aiTaskPrompt || '',
  availableDomains: props.flow?.availableDomains || DEFAULT_DOMAINS
})

// Preset prompt examples
const promptPresets = [
  {
    label: 'Default (Balanced)',
    value: 'default',
    summaryPrompt: '',
    taskPrompt: ''
  },
  {
    label: 'Technical Focus',
    value: 'technical',
    summaryPrompt: 'Focus on technical details, implementation specifics, and architectural considerations.',
    taskPrompt: 'Extract highly specific technical tasks with clear acceptance criteria.'
  },
  {
    label: 'Product Focus',
    value: 'product',
    summaryPrompt: 'Focus on user needs, business value, and product strategy.',
    taskPrompt: 'Extract user stories and product requirements with clear value propositions.'
  },
  {
    label: 'Design Focus',
    value: 'design',
    summaryPrompt: 'Focus on visual design, user experience, and interface patterns.',
    taskPrompt: 'Extract design tasks with specific deliverables and design system references.'
  }
]

const selectedPreset = ref('default')

// Watch preset changes
watch(selectedPreset, (preset) => {
  const selected = promptPresets.find(p => p.value === preset)
  if (selected && preset !== 'default') {
    flowState.aiSummaryPrompt = selected.summaryPrompt
    flowState.aiTaskPrompt = selected.taskPrompt
  } else {
    flowState.aiSummaryPrompt = ''
    flowState.aiTaskPrompt = ''
  }
})

// Prompt preview modal
const { buildPreview } = usePromptPreview()
const showPromptPreview = ref(false)
const promptPreview = computed(() => buildPreview(
  flowState.aiSummaryPrompt,
  flowState.aiTaskPrompt
))

function openPromptPreview() {
  showPromptPreview.value = true
}

// Domain management
const newDomain = ref('')

function addDomain() {
  if (newDomain.value && !flowState.availableDomains?.includes(newDomain.value)) {
    if (!flowState.availableDomains) {
      flowState.availableDomains = []
    }
    flowState.availableDomains.push(newDomain.value.toLowerCase())
    newDomain.value = ''
  }
}

function removeDomain(domain: string) {
  if (flowState.availableDomains) {
    flowState.availableDomains = flowState.availableDomains.filter(d => d !== domain)
  }
}

// ============================================================================
// STEP 2: INPUTS
// ============================================================================

interface InputFormData {
  sourceType: 'slack' | 'figma' | 'email'
  name: string
  emailSlug?: string
  emailAddress?: string
  apiToken?: string
  sourceMetadata?: Record<string, any>
}

const inputsList = ref<Partial<FlowInput>[]>(props.inputs || [])
const showInputForm = ref(false)
const editingInputIndex = ref<number | null>(null)

const inputFormState = reactive<Partial<InputFormData>>({
  sourceType: 'slack',
  name: '',
  emailSlug: '',
  emailAddress: '',
  apiToken: '',
  sourceMetadata: {}
})

const inputSchema = z.object({
  sourceType: z.enum(['slack', 'figma', 'email']),
  name: z.string().min(3, 'Name must be at least 3 characters'),
  emailSlug: z.string().optional(),
  emailAddress: z.string().email().optional(),
  apiToken: z.string().optional()
})

// OAuth handling for Slack
const { openOAuthPopup, waitingForOAuth } = useFlowOAuth({
  teamId: props.teamId,
  provider: 'slack',
  onSuccess: (credentials) => {
    inputFormState.apiToken = credentials.apiToken
    inputFormState.sourceMetadata = credentials.sourceMetadata
    toast.add({
      title: 'OAuth successful',
      description: 'Slack workspace connected',
      color: 'success'
    })
  },
  onError: (error) => {
    toast.add({
      title: 'OAuth failed',
      description: error.message || 'Failed to connect Slack',
      color: 'error'
    })
  }
})

function openInputForm(sourceType: 'slack' | 'figma' | 'email') {
  inputFormState.sourceType = sourceType
  inputFormState.name = ''
  inputFormState.emailSlug = ''
  inputFormState.emailAddress = ''
  inputFormState.apiToken = ''
  inputFormState.sourceMetadata = {}
  editingInputIndex.value = null
  showInputForm.value = true
}

function editInput(index: number) {
  const input = inputsList.value[index]
  if (input) {
    inputFormState.sourceType = input.sourceType as any
    inputFormState.name = input.name || ''
    inputFormState.emailSlug = input.emailSlug || ''
    inputFormState.emailAddress = input.emailAddress || ''
    inputFormState.apiToken = input.apiToken || ''
    inputFormState.sourceMetadata = input.sourceMetadata || {}
    editingInputIndex.value = index
    showInputForm.value = true
  }
}

function saveInput(event: FormSubmitEvent<InputFormData>) {
  const inputData: Partial<FlowInput> = {
    sourceType: event.data.sourceType,
    name: event.data.name,
    emailSlug: event.data.emailSlug,
    emailAddress: event.data.emailAddress,
    apiToken: event.data.apiToken,
    sourceMetadata: inputFormState.sourceMetadata,
    active: true
  }

  if (editingInputIndex.value !== null) {
    inputsList.value[editingInputIndex.value] = inputData
  } else {
    inputsList.value.push(inputData)
  }

  showInputForm.value = false
  toast.add({
    title: 'Input saved',
    description: `${event.data.name} has been added`,
    color: 'success'
  })
}

function deleteInput(index: number) {
  const input = inputsList.value[index]
  inputsList.value.splice(index, 1)
  toast.add({
    title: 'Input removed',
    description: `${input.name} has been removed`,
    color: 'neutral'
  })
}

// ============================================================================
// STEP 3: OUTPUTS
// ============================================================================

interface OutputFormData {
  outputType: 'notion' | 'github' | 'linear'
  name: string
  domainFilter: string[]
  isDefault: boolean
  notionToken?: string
  databaseId?: string
  fieldMapping?: Record<string, any>
}

const outputsList = ref<Partial<FlowOutput>[]>(props.outputs || [])
const showOutputForm = ref(false)
const editingOutputIndex = ref<number | null>(null)

const outputFormState = reactive<Partial<OutputFormData>>({
  outputType: 'notion',
  name: '',
  domainFilter: [],
  isDefault: false,
  notionToken: '',
  databaseId: '',
  fieldMapping: {}
})

const outputSchema = z.object({
  outputType: z.enum(['notion', 'github', 'linear']),
  name: z.string().min(3, 'Name must be at least 3 characters'),
  domainFilter: z.array(z.string()),
  isDefault: z.boolean(),
  notionToken: z.string().min(1, 'Notion token required').optional(),
  databaseId: z.string().min(1, 'Database ID required').optional()
}).refine((data) => {
  // For Notion outputs, require token and database ID
  if (data.outputType === 'notion') {
    return !!data.notionToken && !!data.databaseId
  }
  return true
}, {
  message: 'Notion token and database ID are required for Notion outputs',
  path: ['outputType']
})

// Notion schema fetching
const { fetchNotionSchema, schema: notionSchema, loading: fetchingSchema, error: schemaError } = useNotionSchema()
const { generateAutoMapping, getPropertyTypeColor } = useFieldMapping()

async function fetchAndMapNotionSchema() {
  if (!outputFormState.notionToken || !outputFormState.databaseId) {
    toast.add({
      title: 'Missing credentials',
      description: 'Please enter Notion token and database ID first',
      color: 'warning'
    })
    return
  }

  await fetchNotionSchema({
    databaseId: outputFormState.databaseId,
    notionToken: outputFormState.notionToken
  })

  if (notionSchema.value && !schemaError.value) {
    // Auto-generate field mapping
    const mapping = generateAutoMapping(notionSchema.value, {
      aiFields: ['priority', 'type', 'assignee', 'domain'],
      similarityThreshold: 0.5
    })
    outputFormState.fieldMapping = mapping

    toast.add({
      title: 'Schema fetched',
      description: 'Field mapping auto-generated from Notion database',
      color: 'success'
    })
  } else if (schemaError.value) {
    toast.add({
      title: 'Schema fetch failed',
      description: schemaError.value,
      color: 'error'
    })
  }
}

function openOutputForm(outputType: 'notion' | 'github' | 'linear') {
  outputFormState.outputType = outputType
  outputFormState.name = ''
  outputFormState.domainFilter = []
  outputFormState.isDefault = outputsList.value.length === 0 // First output is default
  outputFormState.notionToken = ''
  outputFormState.databaseId = ''
  outputFormState.fieldMapping = {}
  editingOutputIndex.value = null
  showOutputForm.value = true
}

function editOutput(index: number) {
  const output = outputsList.value[index]
  if (output) {
    outputFormState.outputType = output.outputType as any
    outputFormState.name = output.name || ''
    outputFormState.domainFilter = output.domainFilter || []
    outputFormState.isDefault = output.isDefault || false

    // Extract Notion-specific config
    const config = output.outputConfig as NotionOutputConfig
    if (config) {
      outputFormState.notionToken = config.notionToken || ''
      outputFormState.databaseId = config.databaseId || ''
      outputFormState.fieldMapping = config.fieldMapping || {}
    }

    editingOutputIndex.value = index
    showOutputForm.value = true
  }
}

function saveOutput(event: FormSubmitEvent<OutputFormData>) {
  // Build output config based on type
  let outputConfig: Record<string, any> = {}

  if (event.data.outputType === 'notion') {
    outputConfig = {
      notionToken: event.data.notionToken,
      databaseId: event.data.databaseId,
      fieldMapping: outputFormState.fieldMapping
    } as NotionOutputConfig
  }

  const outputData: Partial<FlowOutput> = {
    outputType: event.data.outputType,
    name: event.data.name,
    domainFilter: event.data.domainFilter,
    isDefault: event.data.isDefault,
    outputConfig,
    active: true
  }

  // If setting as default, unset other defaults
  if (outputData.isDefault) {
    outputsList.value.forEach(output => {
      output.isDefault = false
    })
  }

  if (editingOutputIndex.value !== null) {
    outputsList.value[editingOutputIndex.value] = outputData
  } else {
    outputsList.value.push(outputData)
  }

  showOutputForm.value = false
  toast.add({
    title: 'Output saved',
    description: `${event.data.name} has been added`,
    color: 'success'
  })
}

function deleteOutput(index: number) {
  const output = outputsList.value[index]
  outputsList.value.splice(index, 1)
  toast.add({
    title: 'Output removed',
    description: `${output.name} has been removed`,
    color: 'neutral'
  })
}

// Validation: At least one default output required
const hasDefaultOutput = computed(() => {
  return outputsList.value.some(output => output.isDefault)
})

// ============================================================================
// WIZARD NAVIGATION
// ============================================================================

const stepperItems: StepperItem[] = [
  {
    title: 'Flow Settings',
    description: 'Configure AI and domains',
    icon: 'i-lucide-settings',
    value: 0
  },
  {
    title: 'Add Inputs',
    description: 'Connect sources',
    icon: 'i-lucide-inbox',
    value: 1
  },
  {
    title: 'Add Outputs',
    description: 'Configure destinations',
    icon: 'i-lucide-send',
    value: 2
  }
]

function nextStep() {
  if (currentStep.value < stepperItems.length - 1) {
    stepper.value?.next()
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    stepper.value?.prev()
    currentStep.value--
  }
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================

async function onFlowSubmit(event: FormSubmitEvent<FlowSchema>) {
  // Just proceed to next step, don't save yet
  nextStep()
}

async function saveFlow() {
  // Validate we have at least one default output
  if (outputsList.value.length === 0) {
    toast.add({
      title: 'Validation failed',
      description: 'Please add at least one output',
      color: 'error'
    })
    return
  }

  if (!hasDefaultOutput.value) {
    toast.add({
      title: 'Validation failed',
      description: 'At least one output must be set as default',
      color: 'error'
    })
    return
  }

  loading.value = true

  try {
    // Save flow
    const flowData: Partial<Flow> = {
      ...flowState as FlowSchema,
      teamId: props.teamId,
      active: true,
      onboardingComplete: true
    }

    const flowResponse = await $fetch(`/api/teams/${props.teamId}/discubot-flows`, {
      method: props.flow?.id ? 'PATCH' : 'POST',
      body: flowData
    })

    const flowId = flowResponse.id

    // Save inputs
    for (const input of inputsList.value) {
      await $fetch(`/api/teams/${props.teamId}/discubot-flowinputs`, {
        method: 'POST',
        body: {
          ...input,
          flowId
        }
      })
    }

    // Save outputs
    for (const output of outputsList.value) {
      await $fetch(`/api/teams/${props.teamId}/discubot-flowoutputs`, {
        method: 'POST',
        body: {
          ...output,
          flowId
        }
      })
    }

    toast.add({
      title: 'Flow saved',
      description: `${flowState.name} has been created successfully`,
      color: 'success'
    })

    emit('success', flowId)
    if (props.onSuccess) {
      props.onSuccess(flowId)
    }
  } catch (error: any) {
    console.error('Failed to save flow:', error)
    toast.add({
      title: 'Save failed',
      description: error.message || 'Failed to save flow',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function cancel() {
  emit('cancel')
  if (props.onCancel) {
    props.onCancel()
  }
}
</script>

<template>
  <div class="flow-builder">
    <!-- Wizard Stepper -->
    <UStepper
      ref="stepper"
      v-model="currentStep"
      :items="stepperItems"
      class="mb-8"
    >
      <!-- Step 1: Flow Settings -->
      <template #content="{ item }">
        <div v-if="item.value === 0" class="space-y-6">
          <UForm
            :state="flowState"
            :schema="flowSchema"
            class="space-y-4"
            @submit="onFlowSubmit"
          >
            <!-- Basic Settings -->
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold">Basic Settings</h3>
              </template>

              <div class="space-y-4">
                <UFormField label="Flow Name" name="name" required>
                  <UInput
                    v-model="flowState.name"
                    placeholder="e.g., Product Team Flow"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Description" name="description">
                  <UTextarea
                    v-model="flowState.description"
                    placeholder="Describe what this flow handles..."
                    rows="3"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </UCard>

            <!-- AI Configuration -->
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold">AI Configuration</h3>
                  <USwitch
                    v-model="flowState.aiEnabled"
                    label="AI Enabled"
                  />
                </div>
              </template>

              <div v-if="flowState.aiEnabled" class="space-y-4">
                <UFormField
                  label="Anthropic API Key"
                  name="anthropicApiKey"
                  help="Optional - uses team default if not provided"
                >
                  <UInput
                    v-model="flowState.anthropicApiKey"
                    type="password"
                    placeholder="sk-ant-..."
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Prompt Preset" name="preset">
                  <USelectMenu
                    v-model="selectedPreset"
                    :items="promptPresets"
                    value-attribute="value"
                    label-attribute="label"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  label="Custom Summary Prompt"
                  name="aiSummaryPrompt"
                  help="Override default AI summary generation"
                >
                  <UTextarea
                    v-model="flowState.aiSummaryPrompt"
                    placeholder="Enter custom prompt..."
                    rows="3"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  label="Custom Task Prompt"
                  name="aiTaskPrompt"
                  help="Override default AI task detection"
                >
                  <UTextarea
                    v-model="flowState.aiTaskPrompt"
                    placeholder="Enter custom prompt..."
                    rows="3"
                    class="w-full"
                  />
                </UFormField>

                <div>
                  <UButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="openPromptPreview"
                  >
                    Preview Prompts
                  </UButton>
                </div>
              </div>
            </UCard>

            <!-- Available Domains -->
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold">Available Domains</h3>
              </template>

              <div class="space-y-4">
                <UFormField
                  label="Domains"
                  name="availableDomains"
                  help="Define domains for AI-based routing"
                >
                  <div class="flex flex-wrap gap-2 mb-3">
                    <UBadge
                      v-for="domain in flowState.availableDomains"
                      :key="domain"
                      color="primary"
                      variant="soft"
                      size="lg"
                    >
                      {{ domain }}
                      <button
                        class="ml-1"
                        @click="removeDomain(domain)"
                      >
                        <UIcon name="i-lucide-x" class="w-3 h-3" />
                      </button>
                    </UBadge>
                  </div>

                  <div class="flex gap-2">
                    <UInput
                      v-model="newDomain"
                      placeholder="Add custom domain..."
                      class="flex-1"
                      @keyup.enter="addDomain"
                    />
                    <UButton
                      color="primary"
                      variant="outline"
                      @click="addDomain"
                    >
                      Add
                    </UButton>
                  </div>
                </UFormField>
              </div>
            </UCard>

            <!-- Navigation -->
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="cancel"
              >
                Cancel
              </UButton>
              <UButton
                type="submit"
                trailing-icon="i-lucide-arrow-right"
              >
                Next: Add Inputs
              </UButton>
            </div>
          </UForm>
        </div>

        <!-- Step 2: Inputs -->
        <div v-else-if="item.value === 1" class="space-y-6">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold">Input Sources</h3>
                <div class="flex gap-2">
                  <UButton
                    color="primary"
                    size="sm"
                    @click="openInputForm('slack')"
                  >
                    <UIcon name="i-simple-icons-slack" />
                    Add Slack
                  </UButton>
                  <UButton
                    color="primary"
                    size="sm"
                    variant="outline"
                    @click="openInputForm('figma')"
                  >
                    <UIcon name="i-simple-icons-figma" />
                    Add Figma
                  </UButton>
                </div>
              </div>
            </template>

            <!-- Inputs List -->
            <div v-if="inputsList.length === 0" class="text-center py-8 text-muted">
              <UIcon name="i-lucide-inbox" class="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No inputs added yet</p>
              <p class="text-sm mt-1">Add Slack or Figma sources to receive discussions</p>
            </div>

            <div v-else class="space-y-3">
              <UCard
                v-for="(input, index) in inputsList"
                :key="index"
                class="border border-gray-200 dark:border-gray-800"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <UIcon
                      :name="input.sourceType === 'slack' ? 'i-simple-icons-slack' : 'i-simple-icons-figma'"
                      class="w-5 h-5"
                    />
                    <div>
                      <p class="font-medium">{{ input.name }}</p>
                      <p class="text-sm text-muted">
                        {{ input.sourceType }} · {{ input.active ? 'Active' : 'Inactive' }}
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-pencil"
                      @click="editInput(index)"
                    />
                    <UButton
                      color="error"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-trash"
                      @click="deleteInput(index)"
                    />
                  </div>
                </div>
              </UCard>
            </div>
          </UCard>

          <!-- Navigation -->
          <div class="flex justify-between">
            <UButton
              color="neutral"
              variant="outline"
              leading-icon="i-lucide-arrow-left"
              @click="prevStep"
            >
              Back
            </UButton>
            <UButton
              trailing-icon="i-lucide-arrow-right"
              @click="nextStep"
            >
              Next: Add Outputs
            </UButton>
          </div>
        </div>

        <!-- Step 3: Outputs -->
        <div v-else-if="item.value === 2" class="space-y-6">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold">Output Destinations</h3>
                <UButton
                  color="primary"
                  size="sm"
                  @click="openOutputForm('notion')"
                >
                  <UIcon name="i-simple-icons-notion" />
                  Add Notion
                </UButton>
              </div>
            </template>

            <!-- Validation Warning -->
            <UAlert
              v-if="outputsList.length > 0 && !hasDefaultOutput"
              color="warning"
              variant="soft"
              icon="i-lucide-alert-triangle"
              title="Default output required"
              description="At least one output must be set as default to handle tasks without a matched domain"
              class="mb-4"
            />

            <!-- Outputs List -->
            <div v-if="outputsList.length === 0" class="text-center py-8 text-muted">
              <UIcon name="i-lucide-send" class="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No outputs added yet</p>
              <p class="text-sm mt-1">Add Notion databases to create tasks</p>
            </div>

            <div v-else class="space-y-3">
              <UCard
                v-for="(output, index) in outputsList"
                :key="index"
                class="border border-gray-200 dark:border-gray-800"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 flex-1">
                    <UIcon
                      name="i-simple-icons-notion"
                      class="w-5 h-5"
                    />
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <p class="font-medium">{{ output.name }}</p>
                        <UBadge
                          v-if="output.isDefault"
                          color="primary"
                          variant="soft"
                          size="sm"
                        >
                          Default
                        </UBadge>
                      </div>
                      <p class="text-sm text-muted">
                        {{ output.outputType }}
                        <span v-if="output.domainFilter && output.domainFilter.length > 0">
                          · Domains: {{ output.domainFilter.join(', ') }}
                        </span>
                        <span v-else>
                          · All domains
                        </span>
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-pencil"
                      @click="editOutput(index)"
                    />
                    <UButton
                      color="error"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-trash"
                      @click="deleteOutput(index)"
                    />
                  </div>
                </div>
              </UCard>
            </div>
          </UCard>

          <!-- Navigation -->
          <div class="flex justify-between">
            <UButton
              color="neutral"
              variant="outline"
              leading-icon="i-lucide-arrow-left"
              @click="prevStep"
            >
              Back
            </UButton>
            <UButton
              color="primary"
              :loading="loading"
              :disabled="!hasDefaultOutput || outputsList.length === 0"
              @click="saveFlow"
            >
              Save Flow
            </UButton>
          </div>
        </div>
      </template>
    </UStepper>

    <!-- Input Form Modal -->
    <UModal v-model="showInputForm">
      <template #content="{ close }">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            {{ editingInputIndex !== null ? 'Edit' : 'Add' }} Input - {{ inputFormState.sourceType }}
          </h3>

          <UForm
            :state="inputFormState"
            :schema="inputSchema"
            class="space-y-4"
            @submit="saveInput"
          >
            <UFormField label="Name" name="name" required>
              <UInput
                v-model="inputFormState.name"
                placeholder="e.g., Product Team Slack"
                class="w-full"
              />
            </UFormField>

            <!-- Slack-specific -->
            <div v-if="inputFormState.sourceType === 'slack'" class="space-y-4">
              <UAlert
                color="info"
                variant="soft"
                icon="i-lucide-info"
                title="OAuth Connection"
                description="Click below to connect your Slack workspace via OAuth"
              />
              <UButton
                color="primary"
                block
                :loading="waitingForOAuth"
                @click="openOAuthPopup"
              >
                <UIcon name="i-simple-icons-slack" />
                Connect Slack Workspace
              </UButton>
              <div v-if="inputFormState.sourceMetadata?.slackTeamId" class="text-sm text-muted">
                Connected: {{ inputFormState.sourceMetadata.slackWorkspaceName || inputFormState.sourceMetadata.slackTeamId }}
              </div>
            </div>

            <!-- Figma/Email-specific -->
            <div v-else class="space-y-4">
              <UFormField label="Email Slug" name="emailSlug" required>
                <UInput
                  v-model="inputFormState.emailSlug"
                  placeholder="e.g., figma-design"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Email Address" name="emailAddress">
                <UInput
                  v-model="inputFormState.emailAddress"
                  type="email"
                  placeholder="Generated automatically"
                  disabled
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton
                color="neutral"
                variant="ghost"
                @click="close"
              >
                Cancel
              </UButton>
              <UButton
                type="submit"
                color="primary"
              >
                {{ editingInputIndex !== null ? 'Update' : 'Add' }} Input
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- Output Form Modal -->
    <UModal v-model="showOutputForm">
      <template #content="{ close }">
        <div class="p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-semibold mb-4">
            {{ editingOutputIndex !== null ? 'Edit' : 'Add' }} Output - Notion
          </h3>

          <UForm
            :state="outputFormState"
            :schema="outputSchema"
            class="space-y-4"
            @submit="saveOutput"
          >
            <UFormField label="Name" name="name" required>
              <UInput
                v-model="outputFormState.name"
                placeholder="e.g., Design Tasks DB"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Domain Filter"
              name="domainFilter"
              help="Select which domains should route to this output"
            >
              <USelectMenu
                v-model="outputFormState.domainFilter"
                :items="flowState.availableDomains || []"
                multiple
                placeholder="All domains (no filter)"
                class="w-full"
              />
            </UFormField>

            <UFormField name="isDefault">
              <UCheckbox
                v-model="outputFormState.isDefault"
                label="Set as default output"
                help="Default output receives tasks with no matched domain"
              />
            </UFormField>

            <USeparator />

            <!-- Notion Configuration -->
            <UFormField label="Notion Token" name="notionToken" required>
              <UInput
                v-model="outputFormState.notionToken"
                type="password"
                placeholder="secret_..."
                class="w-full"
              />
            </UFormField>

            <UFormField label="Database ID" name="databaseId" required>
              <UInput
                v-model="outputFormState.databaseId"
                placeholder="abc123def456..."
                class="w-full"
              />
            </UFormField>

            <div>
              <UButton
                color="primary"
                variant="outline"
                size="sm"
                :loading="fetchingSchema"
                @click="fetchAndMapNotionSchema"
              >
                Fetch Schema & Auto-Map Fields
              </UButton>
            </div>

            <!-- Field Mapping (if schema fetched) -->
            <div v-if="notionSchema" class="space-y-3">
              <h4 class="font-medium">Field Mapping</h4>
              <UAlert
                color="info"
                variant="soft"
                icon="i-lucide-info"
                description="Fields have been auto-mapped based on Notion property names"
              />
              <!-- Field mapping UI could be expanded here -->
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton
                color="neutral"
                variant="ghost"
                @click="close"
              >
                Cancel
              </UButton>
              <UButton
                type="submit"
                color="primary"
              >
                {{ editingOutputIndex !== null ? 'Update' : 'Add' }} Output
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- Prompt Preview Modal -->
    <PromptPreviewModal
      v-if="showPromptPreview"
      v-model="showPromptPreview"
      :preview="promptPreview"
    />
  </div>
</template>

<style scoped>
.flow-builder {
  max-width: 1024px;
  margin: 0 auto;
}
</style>

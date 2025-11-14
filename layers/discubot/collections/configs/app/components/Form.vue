<template>
  <CroutonFormActionButton
    v-if="action === 'delete'"
    :action="action"
    :collection="collection"
    :items="items"
    :loading="loading"
    @click="handleSubmit"
  />

  <UForm
    v-else
    :schema="schema"
    :state="state"
    @submit="handleSubmit"
    @error="handleValidationError"
  >
    <CroutonFormLayout :tabs="tabs" :navigation-items="navigationItems" :tab-errors="tabErrorCounts" v-model="activeSection">
      <template #main="{ activeSection }">
      <div v-show="!tabs || activeSection === 'basic'" class="flex flex-col gap-4 p-1">
        <UFormField
          label="Source Type"
          name="sourceType"
          description="Select the platform to integrate with"
          required
          class="not-last:pb-4"
        >
          <USelect
            v-model="state.sourceType"
            :items="sourceTypeOptions"
            placeholder="Select a source type..."
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Configuration Name"
          name="name"
          description="A friendly name to identify this configuration (e.g., 'Main Figma Project')"
          required
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.name"
            placeholder="e.g., Main Figma Project"
            class="w-full"
            size="xl"
          />
        </UFormField>
      </div>

      <div v-show="(!tabs || activeSection === 'email') && isFigmaSource" class="flex flex-col gap-4 p-1">
        <div class="mb-2 p-3 sm:p-4 bg-muted/50 rounded-lg">
          <p class="text-xs sm:text-sm text-muted-foreground">
            Figma uses email forwarding for comment notifications. Configure a unique email address for this project.
          </p>
        </div>
        <UFormField
          label="Email Address"
          name="emailAddress"
          description="Full email address (e.g., comments-team1@yourdomain.com)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.emailAddress"
            type="email"
            placeholder="comments-team1@yourdomain.com"
            class="w-full"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Email Slug"
          name="emailSlug"
          description="Unique identifier for this team (used in email routing)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.emailSlug"
            placeholder="team1"
            class="w-full"
            size="xl"
          />
        </UFormField>
      </div>

      <div v-show="(!tabs || activeSection === 'webhook') && isSlackSource" class="flex flex-col gap-4 p-1">
        <div class="mb-2 p-3 sm:p-4 bg-muted/50 rounded-lg">
          <p class="text-xs sm:text-sm text-muted-foreground">
            Configure Slack webhook integration. You'll receive this webhook URL after setting up your Slack app.
          </p>
        </div>
        <UFormField
          label="Webhook URL"
          name="webhookUrl"
          description="Slack webhook endpoint (provided by Slack app configuration)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.webhookUrl"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            class="w-full"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Webhook Secret"
          name="webhookSecret"
          description="Signing secret for webhook verification (from Slack app settings)"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.webhookSecret"
            type="password"
            placeholder="Enter signing secret..."
            class="w-full"
            size="xl"
          />
        </UFormField>
      </div>

      <div v-show="!tabs || activeSection === 'credentials'" class="flex flex-col gap-4 p-1">
        <UFormField
          :label="state.sourceType === 'figma' ? 'Figma API Token' : 'Slack Bot Token'"
          name="apiToken"
          :description="state.sourceType === 'figma' ? 'Personal access token from Figma account settings' : 'Bot User OAuth Token (starts with xoxb-)'"
          :required="state.sourceType === 'figma' || state.sourceType === 'slack'"
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.apiToken"
            type="password"
            :placeholder="state.sourceType === 'figma' ? 'figd_...' : 'xoxb-...'"
            class="w-full font-mono"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Notion Integration Token"
          name="notionToken"
          required
          class="not-last:pb-4"
        >
          <template #description>
            <div class="space-y-1">
              <p>Create at <a href="https://www.notion.so/my-integrations" target="_blank" class="text-primary hover:underline">notion.so/my-integrations</a></p>
              <p class="text-xs">Don't forget to share your database with the integration!</p>
            </div>
          </template>
          <UInput
            v-model="state.notionToken"
            type="password"
            placeholder="ntn_..."
            class="w-full font-mono"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Claude API Key (Optional)"
          name="anthropicApiKey"
          description="Leave empty to use global API key. Provide to override per-configuration."
          class="not-last:pb-4"
        >
          <UInput
            v-model="state.anthropicApiKey"
            type="password"
            placeholder="sk-ant-..."
            class="w-full font-mono"
            size="xl"
          />
        </UFormField>
      </div>

      <div v-show="!tabs || activeSection === 'notion'" class="flex flex-col gap-4 p-1">
        <UFormField
          label="Notion Database ID"
          name="notionDatabaseId"
          required
          class="not-last:pb-4"
        >
          <template #description>
            <p class="text-sm">Copy from your database URL: <code class="text-xs">notion.so/workspace/<span class="text-primary">abc123def456...</span>?v=...</code></p>
          </template>
          <UInput
            v-model="state.notionDatabaseId"
            placeholder="abc123def456789..."
            class="w-full font-mono"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Field Mapping (Advanced)"
          name="notionFieldMapping"
          description="Custom mapping for Notion database properties. Leave empty for default mapping."
          class="not-last:pb-4"
        >
          <UTextarea
            :model-value="typeof state.notionFieldMapping === 'string' ? state.notionFieldMapping : JSON.stringify(state.notionFieldMapping, null, 2)"
            @update:model-value="(val) => { try { state.notionFieldMapping = val ? JSON.parse(val) : {} } catch (e) { console.error('Invalid JSON:', e) } }"
            class="w-full font-mono text-sm"
            :rows="8"
            placeholder='{"title": "Name", "description": "Details"}'
          />
        </UFormField>
      </div>

      <div v-show="!tabs || activeSection === 'ai'" class="flex flex-col gap-4 p-1">
        <UFormField
          label="Summary Prompt Template"
          name="aiSummaryPrompt"
          description="Custom prompt for AI summarization. Leave empty for default."
          class="not-last:pb-4"
        >
          <UTextarea
            v-model="state.aiSummaryPrompt"
            placeholder="Summarize this discussion focusing on..."
            class="w-full"
            :rows="4"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Task Detection Prompt"
          name="aiTaskPrompt"
          description="Custom prompt for task extraction. Leave empty for default."
          class="not-last:pb-4"
        >
          <UTextarea
            v-model="state.aiTaskPrompt"
            placeholder="Extract actionable tasks from..."
            class="w-full"
            :rows="4"
            size="xl"
          />
        </UFormField>
      </div>
      </template>

      <template #sidebar>
      <div class="flex flex-col gap-6 p-1">
        <div class="space-y-4">
          <h3 class="text-sm font-semibold">Features</h3>
          <UFormField
            label="Enable AI Summarization"
            name="aiEnabled"
            description="Use Claude to analyze discussions"
          >
            <USwitch v-model="state.aiEnabled" />
          </UFormField>
          <UFormField
            label="Auto-Process Discussions"
            name="autoSync"
            description="Automatically process incoming discussions"
          >
            <USwitch v-model="state.autoSync" />
          </UFormField>
          <UFormField
            label="Post Confirmations"
            name="postConfirmation"
            description="Reply to source when task created"
          >
            <USwitch v-model="state.postConfirmation" />
          </UFormField>
        </div>

        <USeparator />

        <div class="space-y-4">
          <h3 class="text-sm font-semibold">Status</h3>
          <UFormField
            label="Active"
            name="active"
            description="Enable this configuration"
          >
            <USwitch v-model="state.active" />
          </UFormField>
          <UFormField
            label="Setup Complete"
            name="onboardingComplete"
            description="Mark as fully configured"
          >
            <USwitch v-model="state.onboardingComplete" />
          </UFormField>
        </div>

        <USeparator />

        <div class="space-y-4">
          <h3 class="text-sm font-semibold">Advanced</h3>
          <UFormField
            label="Source Metadata"
            name="sourceMetadata"
            description="Additional configuration data (JSON)"
          >
            <UTextarea
              :model-value="typeof state.sourceMetadata === 'string' ? state.sourceMetadata : JSON.stringify(state.sourceMetadata, null, 2)"
              @update:model-value="(val) => { try { state.sourceMetadata = val ? JSON.parse(val) : {} } catch (e) { console.error('Invalid JSON:', e) } }"
              class="w-full font-mono text-sm"
              :rows="6"
              placeholder='{}'
            />
          </UFormField>
        </div>
      </div>
      </template>

      <template #footer>
        <CroutonValidationErrorSummary
          v-if="validationErrors.length > 0"
          :tab-errors="tabErrorCounts"
          :navigation-items="navigationItems"
          @switch-tab="switchToTab"
        />

        <CroutonFormActionButton
          :action="action"
          :collection="collection"
          :items="items"
          :loading="loading"
          :has-validation-errors="validationErrors.length > 0"
        />
      </template>
    </CroutonFormLayout>
  </UForm>
</template>

<script setup lang="ts">
import type { DiscubotConfigFormProps, DiscubotConfigFormData } from '../../types'

const props = defineProps<DiscubotConfigFormProps>()
const { defaultValue, schema, collection } = useDiscubotConfigs()

// Source type options
const sourceTypeOptions = [
  { label: 'Figma', value: 'figma' },
  { label: 'Slack', value: 'slack' }
]

// Get EMAIL_DOMAIN from runtime config
const config = useRuntimeConfig()
const EMAIL_DOMAIN = config.public.emailDomain || 'messages.friendlyinter.net'

// Computed properties for conditional rendering
const isFigmaSource = computed(() => state.value.sourceType === 'figma')
const isSlackSource = computed(() => state.value.sourceType === 'slack')

// Auto-generate email slug from name (kebab-case)
const generateEmailSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50) // Limit length
}

// Auto-generate email address from slug
const generateEmailAddress = (slug: string): string => {
  if (!slug) return ''
  return `${slug}@${EMAIL_DOMAIN}`
}

// Watch for name changes to auto-generate slug and email (only for new configs)
watch(() => state.value.name, (newName) => {
  if (props.action === 'create' && isFigmaSource.value && newName) {
    const slug = generateEmailSlug(newName)
    state.value.emailSlug = slug
    state.value.emailAddress = generateEmailAddress(slug)
  }
})

// Watch for slug changes to update email address
watch(() => state.value.emailSlug, (newSlug) => {
  if (isFigmaSource.value && newSlug) {
    state.value.emailAddress = generateEmailAddress(newSlug)
  }
})

// Form layout configuration - dynamic based on source type
const navigationItems = computed(() => {
  const base = [{ label: 'Basic', value: 'basic' }]

  if (isFigmaSource.value) {
    base.push({ label: 'Email', value: 'email' })
  }

  if (isSlackSource.value) {
    base.push({ label: 'Webhook', value: 'webhook' })
  }

  base.push(
    { label: 'Credentials', value: 'credentials' },
    { label: 'Notion', value: 'notion' },
    { label: 'AI', value: 'ai' }
  )

  return base
})

const tabs = ref(true)
const activeSection = ref('basic')

// Map field names to their tab groups for error tracking
const fieldToGroup: Record<string, string> = {
  'sourceType': 'basic',
  'name': 'basic',
  'emailAddress': 'email',
  'emailSlug': 'email',
  'webhookUrl': 'webhook',
  'webhookSecret': 'webhook',
  'apiToken': 'credentials',
  'notionToken': 'credentials',
  'anthropicApiKey': 'credentials',
  'notionDatabaseId': 'notion',
  'notionFieldMapping': 'notion',
  'aiSummaryPrompt': 'ai',
  'aiTaskPrompt': 'ai'
}

// Track validation errors for tab indicators
const validationErrors = ref<Array<{ name: string; message: string }>>([])

// Handle form validation errors
const handleValidationError = (event: any) => {
  if (event?.errors) {
    validationErrors.value = event.errors
  }
}

// Compute errors per tab
const tabErrorCounts = computed(() => {
  const counts: Record<string, number> = {}

  validationErrors.value.forEach(error => {
    const tabName = fieldToGroup[error.name] || 'general'
    counts[tabName] = (counts[tabName] || 0) + 1
  })

  return counts
})

// Switch to a specific tab (for clicking error links)
const switchToTab = (tabValue: string) => {
  activeSection.value = tabValue
}

// Use new mutation composable for data operations
const { create, update, deleteItems } = useCollectionMutation(collection)

// useCrouton still manages modal state
const { close } = useCrouton()

// Initialize form state with proper values (no watch needed!)
const initialValues = props.action === 'update' && props.activeItem?.id
  ? { ...defaultValue, ...props.activeItem }
  : { ...defaultValue }

const state = ref<DiscubotConfigFormData & { id?: string | null }>(initialValues)

const handleSubmit = async () => {
  try {
    if (props.action === 'create') {
      await create(state.value)
    } else if (props.action === 'update' && state.value.id) {
      await update(state.value.id, state.value)
    } else if (props.action === 'delete') {
      await deleteItems(props.items)
    }

    // Clear validation errors on successful submission
    validationErrors.value = []

    close()

  } catch (error) {
    console.error('Form submission failed:', error)
    // You can add toast notification here if available
    // toast.add({ title: 'Error', description: 'Failed to submit form', color: 'red' })
  }
}
</script>

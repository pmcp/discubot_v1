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
        <UFormField label="Source Type" name="sourceType" description="Select the source system" class="not-last:pb-4">
          <USelectMenu
            v-model="state.sourceType"
            :items="sourceTypeOptions"
            placeholder="Select source type"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Source User ID" name="sourceUserId" description="User ID from the source system (Slack user ID, Figma email, etc.)" class="not-last:pb-4">
          <UInput v-model="state.sourceUserId" class="w-full" size="xl" placeholder="U123ABC456 (Slack) or user@example.com (Figma)" />
        </UFormField>
        <UFormField label="Source User Email" name="sourceUserEmail" description="Email address from source system (if available)" class="not-last:pb-4">
          <UInput v-model="state.sourceUserEmail" type="email" class="w-full" size="xl" placeholder="user@example.com" />
        </UFormField>
        <UFormField label="Source User Name" name="sourceUserName" description="Display name from source system" class="not-last:pb-4">
          <UInput v-model="state.sourceUserName" class="w-full" size="xl" placeholder="John Doe" />
        </UFormField>
      </div>

      <div v-show="!tabs || activeSection === 'notion'" class="flex flex-col gap-4 p-1">
        <!-- Notion Token Field (for fetching users) -->
        <UFormField
          v-if="!notionUsers.length"
          label="Notion Integration Token"
          description="Enter your Notion token to fetch available users"
          class="not-last:pb-4"
        >
          <div class="flex gap-2">
            <UInput
              v-model="notionToken"
              type="password"
              class="flex-1"
              size="xl"
              placeholder="secret_... or ntn_..."
            />
            <UButton
              @click="fetchNotionUsers"
              :loading="loadingNotionUsers"
              icon="i-lucide-download"
            >
              Fetch Users
            </UButton>
          </div>
        </UFormField>

        <!-- Notion User Dropdown (after fetching) -->
        <UFormField
          label="Notion User"
          name="notionUserId"
          description="Select the Notion user to map to"
          class="not-last:pb-4"
        >
          <USelectMenu
            v-if="notionUsers.length"
            v-model="selectedNotionUser"
            :options="notionUserOptions"
            placeholder="Select Notion user"
            searchable
            class="w-full"
            @update:model-value="handleNotionUserSelect"
          >
            <template #label>
              <span v-if="selectedNotionUser">
                {{ selectedNotionUser.name }}
                <span v-if="selectedNotionUser.email" class="text-muted-foreground text-sm">
                  ({{ selectedNotionUser.email }})
                </span>
              </span>
            </template>
          </USelectMenu>
          <UInput
            v-else
            v-model="state.notionUserId"
            class="w-full"
            size="xl"
            placeholder="Fetch users first or enter UUID manually"
            readonly
          />
        </UFormField>

        <UFormField label="Notion User Name" name="notionUserName" description="Auto-filled from selection" class="not-last:pb-4">
          <UInput v-model="state.notionUserName" class="w-full" size="xl" readonly />
        </UFormField>
        <UFormField label="Notion User Email" name="notionUserEmail" description="Auto-filled from selection" class="not-last:pb-4">
          <UInput v-model="state.notionUserEmail" type="email" class="w-full" size="xl" readonly />
        </UFormField>

        <!-- Refresh button if users already loaded -->
        <div v-if="notionUsers.length" class="flex gap-2">
          <UButton
            color="gray"
            variant="ghost"
            @click="clearNotionUsers"
            icon="i-lucide-x"
            size="xs"
          >
            Clear Token
          </UButton>
          <UButton
            color="gray"
            variant="ghost"
            @click="fetchNotionUsers"
            :loading="loadingNotionUsers"
            icon="i-lucide-refresh-cw"
            size="xs"
          >
            Refresh Users
          </UButton>
        </div>
      </div>
      </template>

      <template #sidebar>
      <div class="flex flex-col gap-4 p-1">
        <UFormField label="Mapping Type" name="mappingType" description="How was this mapping created?" class="not-last:pb-4">
          <USelectMenu
            v-model="state.mappingType"
            :options="mappingTypeOptions"
            placeholder="Select mapping type"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Confidence Score" name="confidence" description="0-1 score for auto-mapped entries (1.0 for manual)" class="not-last:pb-4">
          <UInput v-model.number="state.confidence" type="number" min="0" max="1" step="0.1" class="w-full" size="xl" />
        </UFormField>
        <UFormField label="Active Status" name="active" description="Is this mapping currently active?" class="not-last:pb-4">
          <USwitch v-model="state.active" />
        </UFormField>
        <UFormField label="Metadata" name="metadata" description="Source-specific user data (JSON)" class="not-last:pb-4">
          <UTextarea
            :model-value="typeof state.metadata === 'string' ? state.metadata : JSON.stringify(state.metadata, null, 2)"
            @update:model-value="(val) => { try { state.metadata = val ? JSON.parse(val) : {} } catch (e) { console.error('Invalid JSON:', e) } }"
            class="w-full font-mono text-sm"
            :rows="8"
            placeholder='{"avatar": "...", "profile": "..."}'
          />
        </UFormField>
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
import type { DiscubotUserMappingFormProps, DiscubotUserMappingFormData } from '../../types'

const props = defineProps<DiscubotUserMappingFormProps>()
const { defaultValue, schema, collection } = useDiscubotUserMappings()
const { currentTeam } = useTeam()
const toast = useToast()

// Form layout configuration
const navigationItems = [
  { label: 'Basic', value: 'basic' },
  { label: 'Notion', value: 'notion' }
]

const tabs = ref(true)
const activeSection = ref('basic')

// Source type options
const sourceTypeOptions = [
  { label: 'Slack', value: 'slack' },
  { label: 'Figma', value: 'figma' }
]

// Mapping type options
const mappingTypeOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'Auto (Email)', value: 'auto-email' },
  { label: 'Auto (Name)', value: 'auto-name' },
  { label: 'Imported', value: 'imported' }
]

// Notion user fetching
const notionToken = ref('')
const notionUsers = ref<Array<{ id: string; name: string; email: string | null; type: string }>>([])
const loadingNotionUsers = ref(false)
const selectedNotionUser = ref<any>(null)

// Fetch Notion users from API
const fetchNotionUsers = async () => {
  if (!notionToken.value) {
    toast.add({
      title: 'Error',
      description: 'Please enter a Notion token',
      color: 'error'
    })
    return
  }

  if (!currentTeam.value?.id) {
    toast.add({
      title: 'Error',
      description: 'No team selected',
      color: 'error'
    })
    return
  }

  loadingNotionUsers.value = true

  try {
    const response = await $fetch<any>('/api/notion/users', {
      params: {
        notionToken: notionToken.value,
        teamId: currentTeam.value.id
      }
    })

    if (response.success && response.users) {
      notionUsers.value = response.users
      toast.add({
        title: 'Success',
        description: `Fetched ${response.users.length} Notion users`,
        color: 'success'
      })
    }
  } catch (error: any) {
    console.error('Failed to fetch Notion users:', error)
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to fetch Notion users',
      color: 'error'
    })
  } finally {
    loadingNotionUsers.value = false
  }
}

// Clear Notion users and token
const clearNotionUsers = () => {
  notionUsers.value = []
  notionToken.value = ''
  selectedNotionUser.value = null
}

// Computed: Notion user options for dropdown
const notionUserOptions = computed(() => {
  return notionUsers.value.map(user => ({
    label: user.email ? `${user.name} (${user.email})` : user.name,
    value: user.id,
    ...user
  }))
})

// Handle Notion user selection
const handleNotionUserSelect = (user: any) => {
  if (user) {
    state.value.notionUserId = user.id || user.value
    state.value.notionUserName = user.name
    state.value.notionUserEmail = user.email
  }
}

// Map field names to their tab groups for error tracking
const fieldToGroup: Record<string, string> = {
  'sourceType': 'basic',
  'sourceUserId': 'basic',
  'sourceUserEmail': 'basic',
  'sourceUserName': 'basic',
  'notionUserId': 'notion',
  'notionUserName': 'notion',
  'notionUserEmail': 'notion'
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

const state = ref<DiscubotUserMappingFormData & { id?: string | null }>(initialValues)

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

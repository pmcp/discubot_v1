<script setup lang="ts">
/**
 * NotionUserPicker - Reusable dropdown for selecting Notion users
 *
 * Fetches Notion workspace users and provides a searchable dropdown.
 * Used in user mapping flows to select Notion users.
 */

import type { NotionUser } from '~/layers/discubot/app/composables/useNotionUsers'

interface Props {
  /** Notion API token */
  notionToken: string
  /** Team ID for API context */
  teamId: string
  /** Selected user ID */
  modelValue?: string | null
  /** Placeholder text */
  placeholder?: string
  /** Disable the picker */
  disabled?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select Notion user...',
  disabled: false,
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'select': [user: NotionUser | null]
}>()

// Use the Notion users composable
const { fetchNotionUsers, users, loading, error } = useNotionUsers()

// Track if we've fetched users
const hasFetched = ref(false)

// Fetch users when token/teamId change or on mount
watch(
  () => [props.notionToken, props.teamId],
  async ([token, team]) => {
    if (token && team) {
      await fetchNotionUsers({ notionToken: token, teamId: team })
      hasFetched.value = true
    }
  },
  { immediate: true }
)

// Format users for USelectMenu
const userItems = computed(() => {
  return users.value.map(user => ({
    value: user.id,
    label: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    user // Keep reference to full user object
  }))
})

// Selected user object
const selectedUser = computed(() => {
  if (!props.modelValue) return null
  return users.value.find(u => u.id === props.modelValue) || null
})

// Handle selection change
function handleSelect(value: string | null) {
  emit('update:modelValue', value)
  const user = value ? users.value.find(u => u.id === value) || null : null
  emit('select', user)
}

// Search filter
const searchQuery = ref('')

const filteredItems = computed(() => {
  if (!searchQuery.value) return userItems.value

  const query = searchQuery.value.toLowerCase()
  return userItems.value.filter(item =>
    item.label.toLowerCase().includes(query) ||
    (item.email && item.email.toLowerCase().includes(query))
  )
})
</script>

<template>
  <div class="notion-user-picker">
    <!-- Loading state -->
    <div v-if="loading && !hasFetched" class="flex items-center gap-2 text-muted text-sm">
      <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
      Loading Notion users...
    </div>

    <!-- Error state -->
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      :description="error"
      class="mb-2"
    />

    <!-- User picker -->
    <USelectMenu
      v-else
      :model-value="modelValue"
      :items="filteredItems"
      value-attribute="value"
      option-attribute="label"
      :placeholder="placeholder"
      :disabled="disabled || loading"
      :loading="loading"
      searchable
      :search-placeholder="'Search by name or email...'"
      :size="size"
      class="w-full"
      @update:model-value="handleSelect"
    >
      <!-- Selected value display -->
      <template #leading>
        <UAvatar
          v-if="selectedUser?.avatarUrl"
          :src="selectedUser.avatarUrl"
          size="2xs"
        />
        <UIcon
          v-else-if="selectedUser"
          name="i-lucide-user"
          class="w-4 h-4 text-muted"
        />
      </template>

      <!-- Option template -->
      <template #option="{ item }">
        <div class="flex items-center gap-2">
          <UAvatar
            v-if="item.avatarUrl"
            :src="item.avatarUrl"
            size="2xs"
          />
          <UIcon
            v-else
            name="i-lucide-user"
            class="w-4 h-4 text-muted"
          />
          <div class="flex flex-col">
            <span class="font-medium">{{ item.label }}</span>
            <span v-if="item.email" class="text-xs text-muted">{{ item.email }}</span>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <template #empty>
        <div class="text-center py-4 text-muted text-sm">
          <p v-if="!hasFetched">Enter Notion token to load users</p>
          <p v-else>No users found</p>
        </div>
      </template>
    </USelectMenu>
  </div>
</template>

<template>
  <header>
    <AppTeamDropdown />
  </header>
  <AppSidebarContent class="mt-2">
    <AppSidebarGroup>
      <AppSidebarLink v-for="link in links" :key="link.to" v-bind="link" />
      <template v-if="isTeamOwner">
        <USeparator class="my-4" />
        <AppSidebarLink v-for="link in settings" :key="link.to" v-bind="link" />
      </template>
    </AppSidebarGroup>
  </AppSidebarContent>
</template>

<script lang="ts" setup>
import { useTeam } from '@/composables/useTeam'

const { isTeamOwner, currentTeam } = useTeam()

const links = computed(() => [
  {
    label: 'Home',
    icon: 'i-lucide-home',
    to: `/dashboard/${currentTeam.value.slug}`,
  },
  {
    label: 'Configs',
    icon: 'i-lucide-settings',
    to: `/dashboard/${currentTeam.value.slug}/discubot/configs`,
  },
  {
    label: 'User Mappings',
    icon: 'i-lucide-users',
    to: `/dashboard/${currentTeam.value.slug}/discubot/user-mappings`,
  },
  {
    label: 'Jobs',
    icon: 'i-lucide-activity',
    to: `/dashboard/${currentTeam.value.slug}/discubot/jobs`,
  },
  {
    label: 'Discussions',
    icon: 'i-lucide-message-square',
    to: `/dashboard/${currentTeam.value.slug}/discubot/discussions`,
  },
  {
    label: 'Email Inbox',
    icon: 'i-lucide-inbox',
    to: `/dashboard/${currentTeam.value.slug}/discubot/inbox`,
  },
])

const settings = computed(() => [
  {
    label: 'Workspace Settings',
    icon: 'i-lucide-settings',
    to: `/dashboard/${currentTeam.value.slug}/settings`,
  },
  {
    label: 'Workspace Members',
    icon: 'i-lucide-users',
    to: `/dashboard/${currentTeam.value.slug}/settings/members`,
  },
  {
    label: 'Billing',
    icon: 'i-lucide-credit-card',
    to: `/dashboard/${currentTeam.value.slug}/settings/billing`,
  },
])
</script>

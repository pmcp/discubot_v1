<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator color="#000000" />
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtPage />
    <CroutonForm />
  </UApp>
</template>

<script lang="ts" setup>
useSeoMeta({
  title: 'Discubot - AI-Powered Discussion to Task Automation',
  description: 'Turn Figma comments and Slack discussions into Notion tasks automatically with AI',
  ogTitle: 'Discubot - Never Lose a Task Again',
  ogDescription: 'AI-powered automation that converts design discussions into actionable tasks',
  twitterCard: 'summary_large_image',
})
</script>

<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui'

const faqs: AccordionItem[] = [
  {
    label: 'How does Discubot access my data?',
    content: 'Discubot only accesses data you explicitly authorize through secure OAuth connections (Slack) or webhook configurations (Figma). We use webhook signature verification and never store your credentials in plain text.',
  },
  {
    label: 'Which Notion properties does it populate?',
    content: 'Discubot populates title, description, assignee, status, priority, and source URL. You can customize field mappings in the configuration dashboard to match your Notion database structure.',
  },
  {
    label: 'Can I customize the AI prompts?',
    content: 'Yes! Each source configuration allows you to customize AI prompts and adjust how Claude analyzes discussions. You can fine-tune task extraction, summarization, and priority detection.',
  },
  {
    label: 'What happens if AI misidentifies a task?',
    content: 'You can view all processing jobs in the admin dashboard, see exactly what the AI detected, and manually adjust tasks in Notion. The dashboard also shows confidence scores for better visibility.',
  },
  {
    label: 'How much does it cost?',
    content: 'Discubot is currently in beta. Pricing will be announced soon based on the number of tasks processed per month. Early adopters will receive preferential pricing.',
  },
  {
    label: 'Can I add more integrations like Linear or GitHub?',
    content: 'The adapter pattern makes it easy to add new sources. Linear, GitHub, and other integrations are on the roadmap. Contact us if you have specific integration needs.',
  },
]
</script>

<template>
  <div class="py-16 sm:py-24">
    <div class="mx-auto max-w-4xl px-6 lg:px-8">
      <!-- Section header -->
      <div class="text-center">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          Frequently Asked Questions
        </h2>
        <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Everything you need to know about Discubot
        </p>
      </div>

      <!-- FAQ Accordion -->
      <div class="mt-12">
        <UAccordion
          :items="faqs"
          :ui="{
            root: 'space-y-4',
            item: 'rounded-lg border border-gray-200 dark:border-gray-800',
            trigger: 'p-4',
            body: 'px-4 pb-4',
          }"
        >
          <template #body="{ item }">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ item.content }}
            </p>
          </template>
        </UAccordion>
      </div>
    </div>
  </div>
</template>

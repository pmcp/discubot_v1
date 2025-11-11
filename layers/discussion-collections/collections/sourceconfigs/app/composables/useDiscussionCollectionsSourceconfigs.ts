import { z } from 'zod'

export const discussioncollectionsSourceconfigSchema = z.object({
  sourceType: z.string().min(1, 'sourceType is required'),
  name: z.string().min(1, 'name is required'),
  emailAddress: z.string().optional(),
  emailSlug: z.string().optional(),
  webhookUrl: z.string().optional(),
  webhookSecret: z.string().optional(),
  apiToken: z.string().optional(),
  notionToken: z.string().min(1, 'notionToken is required'),
  notionDatabaseId: z.string().min(1, 'notionDatabaseId is required'),
  notionFieldMapping: z.record(z.any()).optional(),
  anthropicApiKey: z.string().optional(),
  aiEnabled: z.boolean(),
  aiSummaryPrompt: z.string().optional(),
  aiTaskPrompt: z.string().optional(),
  autoSync: z.boolean(),
  postConfirmation: z.boolean(),
  active: z.boolean(),
  onboardingComplete: z.boolean(),
  sourceMetadata: z.record(z.any()).optional()
})

export const discussioncollectionsSourceconfigsColumns = [
  { accessorKey: 'sourceType', header: 'SourceType' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'emailAddress', header: 'EmailAddress' },
  { accessorKey: 'emailSlug', header: 'EmailSlug' },
  { accessorKey: 'webhookUrl', header: 'WebhookUrl' },
  { accessorKey: 'webhookSecret', header: 'WebhookSecret' },
  { accessorKey: 'apiToken', header: 'ApiToken' },
  { accessorKey: 'notionToken', header: 'NotionToken' },
  { accessorKey: 'notionDatabaseId', header: 'NotionDatabaseId' },
  { accessorKey: 'notionFieldMapping', header: 'NotionFieldMapping' },
  { accessorKey: 'anthropicApiKey', header: 'AnthropicApiKey' },
  { accessorKey: 'aiEnabled', header: 'AiEnabled' },
  { accessorKey: 'aiSummaryPrompt', header: 'AiSummaryPrompt' },
  { accessorKey: 'aiTaskPrompt', header: 'AiTaskPrompt' },
  { accessorKey: 'autoSync', header: 'AutoSync' },
  { accessorKey: 'postConfirmation', header: 'PostConfirmation' },
  { accessorKey: 'active', header: 'Active' },
  { accessorKey: 'onboardingComplete', header: 'OnboardingComplete' },
  { accessorKey: 'sourceMetadata', header: 'SourceMetadata' }
]

export const discussioncollectionsSourceconfigsConfig = {
  name: 'discussioncollectionsSourceconfigs',
  layer: 'discussion-collections',
  apiPath: 'discussion-collections-sourceconfigs',
  componentName: 'DiscussionCollectionsSourceconfigsForm',
  schema: discussioncollectionsSourceconfigSchema,
  defaultValues: {
    sourceType: '',
    name: '',
    emailAddress: '',
    emailSlug: '',
    webhookUrl: '',
    webhookSecret: '',
    apiToken: '',
    notionToken: '',
    notionDatabaseId: '',
    notionFieldMapping: {},
    anthropicApiKey: '',
    aiEnabled: false,
    aiSummaryPrompt: '',
    aiTaskPrompt: '',
    autoSync: false,
    postConfirmation: false,
    active: false,
    onboardingComplete: false,
    sourceMetadata: {}
  },
  columns: discussioncollectionsSourceconfigsColumns,
}

export const useDiscussionCollectionsSourceconfigs = () => discussioncollectionsSourceconfigsConfig

// Default export for auto-import compatibility
export default function () {
  return {
    defaultValue: discussioncollectionsSourceconfigsConfig.defaultValues,
    schema: discussioncollectionsSourceconfigsConfig.schema,
    columns: discussioncollectionsSourceconfigsConfig.columns,
    collection: discussioncollectionsSourceconfigsConfig.name
  }
}
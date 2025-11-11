import { z } from 'zod'

export const discussioncollectionsTaskSchema = z.object({
  discussionId: z.string().min(1, 'discussionId is required'),
  syncJobId: z.string().min(1, 'syncJobId is required'),
  notionPageId: z.string().min(1, 'notionPageId is required'),
  notionPageUrl: z.string().min(1, 'notionPageUrl is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
  status: z.string().min(1, 'status is required'),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  summary: z.string().optional(),
  sourceUrl: z.string().min(1, 'sourceUrl is required'),
  isMultiTaskChild: z.boolean(),
  taskIndex: z.number().optional(),
  metadata: z.record(z.any()).optional()
})

export const discussioncollectionsTasksColumns = [
  { accessorKey: 'discussionId', header: 'DiscussionId' },
  { accessorKey: 'syncJobId', header: 'SyncJobId' },
  { accessorKey: 'notionPageId', header: 'NotionPageId' },
  { accessorKey: 'notionPageUrl', header: 'NotionPageUrl' },
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'description', header: 'Description' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'priority', header: 'Priority' },
  { accessorKey: 'assignee', header: 'Assignee' },
  { accessorKey: 'summary', header: 'Summary' },
  { accessorKey: 'sourceUrl', header: 'SourceUrl' },
  { accessorKey: 'isMultiTaskChild', header: 'IsMultiTaskChild' },
  { accessorKey: 'taskIndex', header: 'TaskIndex' },
  { accessorKey: 'metadata', header: 'Metadata' }
]

export const discussioncollectionsTasksConfig = {
  name: 'discussioncollectionsTasks',
  layer: 'discussion-collections',
  apiPath: 'discussion-collections-tasks',
  componentName: 'DiscussionCollectionsTasksForm',
  schema: discussioncollectionsTaskSchema,
  defaultValues: {
    discussionId: '',
    syncJobId: '',
    notionPageId: '',
    notionPageUrl: '',
    title: '',
    description: '',
    status: '',
    priority: '',
    assignee: '',
    summary: '',
    sourceUrl: '',
    isMultiTaskChild: false,
    taskIndex: 0,
    metadata: {}
  },
  columns: discussioncollectionsTasksColumns,
}

export const useDiscussionCollectionsTasks = () => discussioncollectionsTasksConfig

// Default export for auto-import compatibility
export default function () {
  return {
    defaultValue: discussioncollectionsTasksConfig.defaultValues,
    schema: discussioncollectionsTasksConfig.schema,
    columns: discussioncollectionsTasksConfig.columns,
    collection: discussioncollectionsTasksConfig.name
  }
}
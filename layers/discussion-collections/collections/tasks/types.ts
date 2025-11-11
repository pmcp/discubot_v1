import type { z } from 'zod'
import type { discussioncollectionsTaskSchema } from './app/composables/useDiscussionCollectionsTasks'

export interface DiscussionCollectionsTask {
  id: string
  teamId: string
  owner: string
  discussionId: string
  syncJobId: string
  notionPageId: string
  notionPageUrl: string
  title: string
  description?: string
  status: string
  priority?: string
  assignee?: string
  summary?: string
  sourceUrl: string
  isMultiTaskChild: boolean
  taskIndex?: number
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  optimisticId?: string
  optimisticAction?: 'create' | 'update' | 'delete'
}

export type DiscussionCollectionsTaskFormData = z.infer<typeof discussioncollectionsTaskSchema>
export type NewDiscussionCollectionsTask = Omit<DiscussionCollectionsTask, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

// Props type for the Form component
export interface DiscussionCollectionsTaskFormProps {
  items: string[] // Array of IDs for delete action
  activeItem: DiscussionCollectionsTask | Record<string, never> // DiscussionCollectionsTask for update, empty object for create
  collection: string
  loading: string
  action: 'create' | 'update' | 'delete'
}
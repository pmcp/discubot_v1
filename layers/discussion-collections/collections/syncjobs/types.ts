import type { z } from 'zod'
import type { discussioncollectionsSyncjobSchema } from './app/composables/useDiscussionCollectionsSyncjobs'

export interface DiscussionCollectionsSyncjob {
  id: string
  teamId: string
  owner: string
  discussionId: string
  sourceConfigId: string
  status: string
  stage?: string
  attempts: number
  maxAttempts: number
  error?: string
  errorStack?: string
  startedAt?: Date | null
  completedAt?: Date | null
  processingTime?: number
  taskIds?: string[]
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  optimisticId?: string
  optimisticAction?: 'create' | 'update' | 'delete'
}

export type DiscussionCollectionsSyncjobFormData = z.infer<typeof discussioncollectionsSyncjobSchema>
export type NewDiscussionCollectionsSyncjob = Omit<DiscussionCollectionsSyncjob, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

// Props type for the Form component
export interface DiscussionCollectionsSyncjobFormProps {
  items: string[] // Array of IDs for delete action
  activeItem: DiscussionCollectionsSyncjob | Record<string, never> // DiscussionCollectionsSyncjob for update, empty object for create
  collection: string
  loading: string
  action: 'create' | 'update' | 'delete'
}
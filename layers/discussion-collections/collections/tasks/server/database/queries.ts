// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionCollectionsTask, NewDiscussionCollectionsTask } from '../../types'
import * as discussionsSchema from '../../../discussions/server/database/schema'
import * as syncjobsSchema from '../../../syncjobs/server/database/schema'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionCollectionsTasks(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const tasks = await db
    .select({
      ...tables.discussionCollectionsTasks,
      discussionIdData: discussionsSchema.discussionCollectionsDiscussions,
      syncJobIdData: syncjobsSchema.discussionCollectionsSyncjobs,
      ownerUser: {
        id: ownerUsers.id,
        name: ownerUsers.name,
        email: ownerUsers.email,
        avatarUrl: ownerUsers.avatarUrl
      },
      createdByUser: {
        id: createdByUsers.id,
        name: createdByUsers.name,
        email: createdByUsers.email,
        avatarUrl: createdByUsers.avatarUrl
      },
      updatedByUser: {
        id: updatedByUsers.id,
        name: updatedByUsers.name,
        email: updatedByUsers.email,
        avatarUrl: updatedByUsers.avatarUrl
      }
    })
    .from(tables.discussionCollectionsTasks)
    .leftJoin(discussionsSchema.discussionCollectionsDiscussions, eq(tables.discussionCollectionsTasks.discussionId, discussionsSchema.discussionCollectionsDiscussions.id))
    .leftJoin(syncjobsSchema.discussionCollectionsSyncjobs, eq(tables.discussionCollectionsTasks.syncJobId, syncjobsSchema.discussionCollectionsSyncjobs.id))
    .leftJoin(ownerUsers, eq(tables.discussionCollectionsTasks.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionCollectionsTasks.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionCollectionsTasks.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionCollectionsTasks.teamId, teamId))
    .orderBy(desc(tables.discussionCollectionsTasks.createdAt))

  return tasks
}

export async function getDiscussionCollectionsTasksByIds(teamId: string, taskIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const tasks = await db
    .select({
      ...tables.discussionCollectionsTasks,
      discussionIdData: discussionsSchema.discussionCollectionsDiscussions,
      syncJobIdData: syncjobsSchema.discussionCollectionsSyncjobs,
      ownerUser: {
        id: ownerUsers.id,
        name: ownerUsers.name,
        email: ownerUsers.email,
        avatarUrl: ownerUsers.avatarUrl
      },
      createdByUser: {
        id: createdByUsers.id,
        name: createdByUsers.name,
        email: createdByUsers.email,
        avatarUrl: createdByUsers.avatarUrl
      },
      updatedByUser: {
        id: updatedByUsers.id,
        name: updatedByUsers.name,
        email: updatedByUsers.email,
        avatarUrl: updatedByUsers.avatarUrl
      }
    })
    .from(tables.discussionCollectionsTasks)
    .leftJoin(discussionsSchema.discussionCollectionsDiscussions, eq(tables.discussionCollectionsTasks.discussionId, discussionsSchema.discussionCollectionsDiscussions.id))
    .leftJoin(syncjobsSchema.discussionCollectionsSyncjobs, eq(tables.discussionCollectionsTasks.syncJobId, syncjobsSchema.discussionCollectionsSyncjobs.id))
    .leftJoin(ownerUsers, eq(tables.discussionCollectionsTasks.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionCollectionsTasks.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionCollectionsTasks.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionCollectionsTasks.teamId, teamId),
        inArray(tables.discussionCollectionsTasks.id, taskIds)
      )
    )
    .orderBy(desc(tables.discussionCollectionsTasks.createdAt))

  return tasks
}

export async function createDiscussionCollectionsTask(data: NewDiscussionCollectionsTask) {
  const db = useDB()

  const [task] = await db
    .insert(tables.discussionCollectionsTasks)
    .values(data)
    .returning()

  return task
}

export async function updateDiscussionCollectionsTask(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionCollectionsTask>
) {
  const db = useDB()

  const [task] = await db
    .update(tables.discussionCollectionsTasks)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionCollectionsTasks.id, recordId),
        eq(tables.discussionCollectionsTasks.teamId, teamId),
        eq(tables.discussionCollectionsTasks.owner, ownerId)
      )
    )
    .returning()

  if (!task) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionCollectionsTask not found or unauthorized'
    })
  }

  return task
}

export async function deleteDiscussionCollectionsTask(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionCollectionsTasks)
    .where(
      and(
        eq(tables.discussionCollectionsTasks.id, recordId),
        eq(tables.discussionCollectionsTasks.teamId, teamId),
        eq(tables.discussionCollectionsTasks.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionCollectionsTask not found or unauthorized'
    })
  }

  return { success: true }
}
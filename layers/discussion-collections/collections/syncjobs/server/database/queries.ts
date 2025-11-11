// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionCollectionsSyncjob, NewDiscussionCollectionsSyncjob } from '../../types'
import * as discussionsSchema from '../../../discussions/server/database/schema'
import * as sourceconfigsSchema from '../../../sourceconfigs/server/database/schema'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionCollectionsSyncjobs(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const syncjobs = await db
    .select({
      ...tables.discussionCollectionsSyncjobs,
      discussionIdData: discussionsSchema.discussionCollectionsDiscussions,
      sourceConfigIdData: sourceconfigsSchema.discussionCollectionsSourceconfigs,
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
    .from(tables.discussionCollectionsSyncjobs)
    .leftJoin(discussionsSchema.discussionCollectionsDiscussions, eq(tables.discussionCollectionsSyncjobs.discussionId, discussionsSchema.discussionCollectionsDiscussions.id))
    .leftJoin(sourceconfigsSchema.discussionCollectionsSourceconfigs, eq(tables.discussionCollectionsSyncjobs.sourceConfigId, sourceconfigsSchema.discussionCollectionsSourceconfigs.id))
    .leftJoin(ownerUsers, eq(tables.discussionCollectionsSyncjobs.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionCollectionsSyncjobs.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionCollectionsSyncjobs.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionCollectionsSyncjobs.teamId, teamId))
    .orderBy(desc(tables.discussionCollectionsSyncjobs.createdAt))

  return syncjobs
}

export async function getDiscussionCollectionsSyncjobsByIds(teamId: string, syncjobIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const syncjobs = await db
    .select({
      ...tables.discussionCollectionsSyncjobs,
      discussionIdData: discussionsSchema.discussionCollectionsDiscussions,
      sourceConfigIdData: sourceconfigsSchema.discussionCollectionsSourceconfigs,
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
    .from(tables.discussionCollectionsSyncjobs)
    .leftJoin(discussionsSchema.discussionCollectionsDiscussions, eq(tables.discussionCollectionsSyncjobs.discussionId, discussionsSchema.discussionCollectionsDiscussions.id))
    .leftJoin(sourceconfigsSchema.discussionCollectionsSourceconfigs, eq(tables.discussionCollectionsSyncjobs.sourceConfigId, sourceconfigsSchema.discussionCollectionsSourceconfigs.id))
    .leftJoin(ownerUsers, eq(tables.discussionCollectionsSyncjobs.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionCollectionsSyncjobs.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionCollectionsSyncjobs.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionCollectionsSyncjobs.teamId, teamId),
        inArray(tables.discussionCollectionsSyncjobs.id, syncjobIds)
      )
    )
    .orderBy(desc(tables.discussionCollectionsSyncjobs.createdAt))

  return syncjobs
}

export async function createDiscussionCollectionsSyncjob(data: NewDiscussionCollectionsSyncjob) {
  const db = useDB()

  const [syncjob] = await db
    .insert(tables.discussionCollectionsSyncjobs)
    .values(data)
    .returning()

  return syncjob
}

export async function updateDiscussionCollectionsSyncjob(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionCollectionsSyncjob>
) {
  const db = useDB()

  const [syncjob] = await db
    .update(tables.discussionCollectionsSyncjobs)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionCollectionsSyncjobs.id, recordId),
        eq(tables.discussionCollectionsSyncjobs.teamId, teamId),
        eq(tables.discussionCollectionsSyncjobs.owner, ownerId)
      )
    )
    .returning()

  if (!syncjob) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionCollectionsSyncjob not found or unauthorized'
    })
  }

  return syncjob
}

export async function deleteDiscussionCollectionsSyncjob(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionCollectionsSyncjobs)
    .where(
      and(
        eq(tables.discussionCollectionsSyncjobs.id, recordId),
        eq(tables.discussionCollectionsSyncjobs.teamId, teamId),
        eq(tables.discussionCollectionsSyncjobs.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionCollectionsSyncjob not found or unauthorized'
    })
  }

  return { success: true }
}
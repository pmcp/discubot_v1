// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionCollectionsDiscussion, NewDiscussionCollectionsDiscussion } from '../../types'
import * as sourceconfigsSchema from '../../../sourceconfigs/server/database/schema'
import * as syncjobsSchema from '../../../syncjobs/server/database/schema'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionCollectionsDiscussions(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const discussions = await db
    .select({
      ...tables.discussionCollectionsDiscussions,
      sourceConfigIdData: sourceconfigsSchema.discussionCollectionsSourceconfigs,
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
    .from(tables.discussionCollectionsDiscussions)
    .leftJoin(sourceconfigsSchema.discussionCollectionsSourceconfigs, eq(tables.discussionCollectionsDiscussions.sourceConfigId, sourceconfigsSchema.discussionCollectionsSourceconfigs.id))
    .leftJoin(syncjobsSchema.discussionCollectionsSyncjobs, eq(tables.discussionCollectionsDiscussions.syncJobId, syncjobsSchema.discussionCollectionsSyncjobs.id))
    .leftJoin(ownerUsers, eq(tables.discussionCollectionsDiscussions.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionCollectionsDiscussions.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionCollectionsDiscussions.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionCollectionsDiscussions.teamId, teamId))
    .orderBy(desc(tables.discussionCollectionsDiscussions.createdAt))

  return discussions
}

export async function getDiscussionCollectionsDiscussionsByIds(teamId: string, discussionIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const discussions = await db
    .select({
      ...tables.discussionCollectionsDiscussions,
      sourceConfigIdData: sourceconfigsSchema.discussionCollectionsSourceconfigs,
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
    .from(tables.discussionCollectionsDiscussions)
    .leftJoin(sourceconfigsSchema.discussionCollectionsSourceconfigs, eq(tables.discussionCollectionsDiscussions.sourceConfigId, sourceconfigsSchema.discussionCollectionsSourceconfigs.id))
    .leftJoin(syncjobsSchema.discussionCollectionsSyncjobs, eq(tables.discussionCollectionsDiscussions.syncJobId, syncjobsSchema.discussionCollectionsSyncjobs.id))
    .leftJoin(ownerUsers, eq(tables.discussionCollectionsDiscussions.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionCollectionsDiscussions.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionCollectionsDiscussions.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionCollectionsDiscussions.teamId, teamId),
        inArray(tables.discussionCollectionsDiscussions.id, discussionIds)
      )
    )
    .orderBy(desc(tables.discussionCollectionsDiscussions.createdAt))

  return discussions
}

export async function createDiscussionCollectionsDiscussion(data: NewDiscussionCollectionsDiscussion) {
  const db = useDB()

  const [discussion] = await db
    .insert(tables.discussionCollectionsDiscussions)
    .values(data)
    .returning()

  return discussion
}

export async function updateDiscussionCollectionsDiscussion(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionCollectionsDiscussion>
) {
  const db = useDB()

  const [discussion] = await db
    .update(tables.discussionCollectionsDiscussions)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionCollectionsDiscussions.id, recordId),
        eq(tables.discussionCollectionsDiscussions.teamId, teamId),
        eq(tables.discussionCollectionsDiscussions.owner, ownerId)
      )
    )
    .returning()

  if (!discussion) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionCollectionsDiscussion not found or unauthorized'
    })
  }

  return discussion
}

export async function deleteDiscussionCollectionsDiscussion(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionCollectionsDiscussions)
    .where(
      and(
        eq(tables.discussionCollectionsDiscussions.id, recordId),
        eq(tables.discussionCollectionsDiscussions.teamId, teamId),
        eq(tables.discussionCollectionsDiscussions.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionCollectionsDiscussion not found or unauthorized'
    })
  }

  return { success: true }
}
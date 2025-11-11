// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscussionCollectionsSourceconfig, NewDiscussionCollectionsSourceconfig } from '../../types'
import { users } from '~~/server/database/schema'

export async function getAllDiscussionCollectionsSourceconfigs(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const sourceconfigs = await db
    .select({
      ...tables.discussionCollectionsSourceconfigs,
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
    .from(tables.discussionCollectionsSourceconfigs)
    .leftJoin(ownerUsers, eq(tables.discussionCollectionsSourceconfigs.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionCollectionsSourceconfigs.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionCollectionsSourceconfigs.updatedBy, updatedByUsers.id))
    .where(eq(tables.discussionCollectionsSourceconfigs.teamId, teamId))
    .orderBy(desc(tables.discussionCollectionsSourceconfigs.createdAt))

  return sourceconfigs
}

export async function getDiscussionCollectionsSourceconfigsByIds(teamId: string, sourceconfigIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const sourceconfigs = await db
    .select({
      ...tables.discussionCollectionsSourceconfigs,
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
    .from(tables.discussionCollectionsSourceconfigs)
    .leftJoin(ownerUsers, eq(tables.discussionCollectionsSourceconfigs.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discussionCollectionsSourceconfigs.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discussionCollectionsSourceconfigs.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discussionCollectionsSourceconfigs.teamId, teamId),
        inArray(tables.discussionCollectionsSourceconfigs.id, sourceconfigIds)
      )
    )
    .orderBy(desc(tables.discussionCollectionsSourceconfigs.createdAt))

  return sourceconfigs
}

export async function createDiscussionCollectionsSourceconfig(data: NewDiscussionCollectionsSourceconfig) {
  const db = useDB()

  const [sourceconfig] = await db
    .insert(tables.discussionCollectionsSourceconfigs)
    .values(data)
    .returning()

  return sourceconfig
}

export async function updateDiscussionCollectionsSourceconfig(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscussionCollectionsSourceconfig>
) {
  const db = useDB()

  const [sourceconfig] = await db
    .update(tables.discussionCollectionsSourceconfigs)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discussionCollectionsSourceconfigs.id, recordId),
        eq(tables.discussionCollectionsSourceconfigs.teamId, teamId),
        eq(tables.discussionCollectionsSourceconfigs.owner, ownerId)
      )
    )
    .returning()

  if (!sourceconfig) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionCollectionsSourceconfig not found or unauthorized'
    })
  }

  return sourceconfig
}

export async function deleteDiscussionCollectionsSourceconfig(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discussionCollectionsSourceconfigs)
    .where(
      and(
        eq(tables.discussionCollectionsSourceconfigs.id, recordId),
        eq(tables.discussionCollectionsSourceconfigs.teamId, teamId),
        eq(tables.discussionCollectionsSourceconfigs.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscussionCollectionsSourceconfig not found or unauthorized'
    })
  }

  return { success: true }
}
// Generated with array reference post-processing support (v2024-10-12)
import { eq, and, desc, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as tables from './schema'
import type { DiscubotFlow, NewDiscubotFlow } from '../../types'
import { users } from '~~/server/database/schema'

export async function getAllDiscubotFlows(teamId: string) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const flows = await db
    .select({
      ...tables.discubotFlows,
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
    .from(tables.discubotFlows)
    .leftJoin(ownerUsers, eq(tables.discubotFlows.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discubotFlows.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discubotFlows.updatedBy, updatedByUsers.id))
    .where(eq(tables.discubotFlows.teamId, teamId))
    .orderBy(desc(tables.discubotFlows.createdAt))

  return flows
}

export async function getDiscubotFlowsByIds(teamId: string, flowIds: string[]) {
  const db = useDB()

  const ownerUsers = alias(users, 'ownerUsers')
  const createdByUsers = alias(users, 'createdByUsers')
  const updatedByUsers = alias(users, 'updatedByUsers')

  const flows = await db
    .select({
      ...tables.discubotFlows,
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
    .from(tables.discubotFlows)
    .leftJoin(ownerUsers, eq(tables.discubotFlows.owner, ownerUsers.id))
    .leftJoin(createdByUsers, eq(tables.discubotFlows.createdBy, createdByUsers.id))
    .leftJoin(updatedByUsers, eq(tables.discubotFlows.updatedBy, updatedByUsers.id))
    .where(
      and(
        eq(tables.discubotFlows.teamId, teamId),
        inArray(tables.discubotFlows.id, flowIds)
      )
    )
    .orderBy(desc(tables.discubotFlows.createdAt))

  return flows
}

export async function createDiscubotFlow(data: NewDiscubotFlow) {
  const db = useDB()

  const [flow] = await db
    .insert(tables.discubotFlows)
    .values(data)
    .returning()

  return flow
}

export async function updateDiscubotFlow(
  recordId: string,
  teamId: string,
  ownerId: string,
  updates: Partial<DiscubotFlow>
) {
  const db = useDB()

  const [flow] = await db
    .update(tables.discubotFlows)
    .set({
      ...updates,
      updatedBy: ownerId
    })
    .where(
      and(
        eq(tables.discubotFlows.id, recordId),
        eq(tables.discubotFlows.teamId, teamId),
        eq(tables.discubotFlows.owner, ownerId)
      )
    )
    .returning()

  if (!flow) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscubotFlow not found or unauthorized'
    })
  }

  return flow
}

export async function deleteDiscubotFlow(
  recordId: string,
  teamId: string,
  ownerId: string
) {
  const db = useDB()

  const [deleted] = await db
    .delete(tables.discubotFlows)
    .where(
      and(
        eq(tables.discubotFlows.id, recordId),
        eq(tables.discubotFlows.teamId, teamId),
        eq(tables.discubotFlows.owner, ownerId)
      )
    )
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DiscubotFlow not found or unauthorized'
    })
  }

  return { success: true }
}
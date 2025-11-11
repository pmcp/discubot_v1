// Team-based endpoint - requires @friendlyinternet/nuxt-crouton package
// The #crouton/team-auth alias is provided by @friendlyinternet/nuxt-crouton
// Install: pnpm add @friendlyinternet/nuxt-crouton
// Config: Add '@friendlyinternet/nuxt-crouton' to extends array in nuxt.config.ts
import { deleteDiscussionCollectionsSyncjob } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'

export default defineEventHandler(async (event) => {
  const { syncjobId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  return await deleteDiscussionCollectionsSyncjob(syncjobId, team.id, user.id)
})
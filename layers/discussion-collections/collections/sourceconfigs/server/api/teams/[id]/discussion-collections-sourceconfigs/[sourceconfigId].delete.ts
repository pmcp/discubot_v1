// Team-based endpoint - requires @friendlyinternet/nuxt-crouton package
// The #crouton/team-auth alias is provided by @friendlyinternet/nuxt-crouton
// Install: pnpm add @friendlyinternet/nuxt-crouton
// Config: Add '@friendlyinternet/nuxt-crouton' to extends array in nuxt.config.ts
import { deleteDiscussionCollectionsSourceconfig } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'

export default defineEventHandler(async (event) => {
  const { sourceconfigId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  return await deleteDiscussionCollectionsSourceconfig(sourceconfigId, team.id, user.id)
})
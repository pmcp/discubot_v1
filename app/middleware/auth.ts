import type { Team } from '@@/types/database'
import { getInvite } from '~~/server/database/queries/teams'

export default defineNuxtRouteMiddleware(async (to, _from) => {
  console.log('[AUTH_MIDDLEWARE] === START ===', {
    path: to.fullPath,
    isSSR: !process.client
  })

  const paramSlug
    = (Array.isArray(to.params.team) ? to.params.team[0] : to.params.team) || ''

  console.log('[AUTH_MIDDLEWARE] paramSlug:', paramSlug)

  const toast = useToast()
  const { loggedIn } = useUserSession()

  console.log('[AUTH_MIDDLEWARE] loggedIn:', loggedIn.value)

  const teams = useState<Team[]>('teams', () => [])
  const teamSlug = useState<string>('teamSlug')

  console.log('[AUTH_MIDDLEWARE] Current teams state:', {
    length: teams.value.length,
    teamSlugs: teams.value.map(t => t.slug)
  })

  function handleTeamRedirect() {
    const { getLastUsedTeam, setLastUsedTeam } = useTeamPreferences()
    // Redirect to onboarding if no teams
    const memberships = teams.value
    const firstTeam = memberships[0]
    if (!firstTeam) {
      return navigateTo('/dashboard/onboard')
    }
    const lastTeamSlug = getLastUsedTeam()
    const targetTeam
      = memberships.find((team) => team.slug === lastTeamSlug) || firstTeam

    // Update last used team and redirect
    setLastUsedTeam(targetTeam.slug)
    return navigateTo(`/dashboard/${targetTeam.slug}`)
  }

  // Redirect to login if not logged in
  if (!loggedIn.value) {
    toast.add({
      title: 'You must be logged in to access this page',
      color: 'error',
    })
    if (teamSlug.value) teamSlug.value = ''
    if (teams.value.length) teams.value = []
    return await navigateTo('/auth/login')
  }

  // Check for invite token, this means the user was not logged in or did not have an account when they clicked the verification link,
  // but now has successfully logged in or created an account and can verify the invite
  const inviteToken = useCookie('invite-token')
  if (inviteToken.value) {
    // Clear the cookies
    const inviteTokenStr = inviteToken.value
    inviteToken.value = null
    const inviteEmailCookie = useCookie('invite-email')
    if (inviteEmailCookie.value) inviteEmailCookie.value = null
    // Redirect if token still valid
    try {
      await getInvite(inviteTokenStr)
      return await navigateTo(`/api/teams/verify-invite?token=${inviteTokenStr}`)
    } catch {
      // Invalid token means user already verified it upon submitting registration
    }
  }

  // If teams aren't loaded yet, fetch them
  if (!teams.value.length) {
    console.log('[AUTH_MIDDLEWARE] Teams not loaded, fetching...')
    try {
      teams.value = await useTeam().getMemberships()
      console.log('[AUTH_MIDDLEWARE] Teams fetched successfully:', {
        count: teams.value.length,
        slugs: teams.value.map(t => t.slug)
      })
    } catch (error: any) {
      console.error('[AUTH_MIDDLEWARE] ❌ Failed to fetch teams:', {
        message: error.message,
        stack: error.stack
      })
      throw error
    }

    // If there are teams and we're coming from registration via invite, skip onboarding
    const fromInvite = useCookie('from-invite')
    if (fromInvite.value === 'true' && teams.value.length) {
      fromInvite.value = null
      console.log('[AUTH_MIDDLEWARE] From invite, redirecting...')
      // User has teams from accepting invite, redirect to the team page
      return handleTeamRedirect()
    }

    if ((paramSlug || teamSlug.value) && !teams.value.length) {
      console.log('[AUTH_MIDDLEWARE] No teams found, redirecting to handleTeamRedirect')
      return await handleTeamRedirect()
    }
  }

  // Redirect to onboarding or first available team
  if (
    to.fullPath === '/dashboard'
    || to.fullPath === '/dashboard/'
    || (teams.value.length && to.fullPath === '/dashboard/onboard')
  ) {
    return await handleTeamRedirect()
  }

  // Validate that the team in the slug belongs to the user
  if (paramSlug && !teams.value.find((team) => team.slug === paramSlug)) {
    console.log('[AUTH_MIDDLEWARE] Team slug not found in user teams, redirecting')
    return await handleTeamRedirect()
  } else if (paramSlug) {
    console.log('[AUTH_MIDDLEWARE] Setting teamSlug:', paramSlug)
    teamSlug.value = paramSlug
  }

  console.log('[AUTH_MIDDLEWARE] === END (continuing to page) ===')
})

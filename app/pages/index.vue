<script setup lang="ts">
import { ref } from 'vue'

// SEO
useSeoMeta({
  title: 'rakim - keep the flow',
  description: 'Never lose a task buried in Figma comments or Slack threads. rakim uses AI to automatically convert discussions into actionable tasks.',
  ogTitle: 'rakim - keep the flow',
  ogDescription: 'AI-powered automation that converts Figma comments and Slack threads into tasks',
  ogImage: '/og-image.png',
  twitterCard: 'summary_large_image',
})

// Auth state
const { loggedIn } = useUserSession()

// Auth dropdown options
const authOptions = ref([
  {
    label: 'Login (Email/Password)',
    to: '/auth/login',
    icon: 'i-lucide-key-square',
  },
  {
    label: 'Login with Magic Link',
    to: '/auth/magic-link',
    icon: 'i-lucide-mail',
  },
  {
    label: 'Login with Passkey',
    to: '/auth/login-passkey',
    icon: 'i-lucide-fingerprint',
  },
  {
    label: 'Social Login',
    to: '/auth/social-login',
    icon: 'i-lucide-twitter',
  },
  {
    label: 'Phone Number Login',
    to: '/auth/login-phone',
    icon: 'i-lucide-phone',
  },
  {
    label: 'Register',
    to: '/auth/register',
    icon: 'i-lucide-user-plus',
  },
])

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<template>
  <main>
    <!-- Header/Navigation -->
    <header class="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-950/80">
      <WebsiteSection class="flex w-full items-center justify-between py-4">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary-600 dark:bg-primary-500">
            <UIcon name="i-lucide-message-square-quote" class="size-5 text-white" />
          </div>
          <p class="text-xl font-bold text-gray-900 dark:text-white">
            rakim
          </p>
        </NuxtLink>

        <!-- Desktop Navigation -->
        <div class="hidden flex-1 items-center justify-center gap-3 md:flex">
          <UButton
            label="Features"
            color="gray"
            variant="ghost"
            @click="scrollToSection('features')"
          />
          <UButton
            label="FAQ"
            color="gray"
            variant="ghost"
            @click="scrollToSection('faq')"
          />
        </div>

        <!-- Auth Buttons -->
        <div class="flex items-center gap-3">
          <AuthState v-slot="{ loggedIn: isAuthLoggedIn }">
            <UButton
              v-if="isAuthLoggedIn"
              color="gray"
              variant="soft"
              label="Go to Dashboard"
              to="/dashboard"
              icon="i-lucide-layout-dashboard"
            />
            <UFieldGroup v-else>
              <UButton
                color="gray"
                variant="soft"
                to="/auth/login"
                label="Login"
              />
              <UDropdownMenu
                :items="authOptions"
                :content="{
                  align: 'end',
                  side: 'bottom',
                  sideOffset: 8,
                }"
                :ui="{
                  content: 'w-full',
                  itemLeadingIcon: 'size-4',
                }"
              >
                <UButton
                  color="gray"
                  variant="soft"
                  icon="i-lucide-chevron-down"
                  class="border-l border-gray-200/50 dark:border-white/10"
                />
              </UDropdownMenu>
            </UFieldGroup>
          </AuthState>
          <ThemeToggle />
        </div>
      </WebsiteSection>
    </header>

    <!-- Hero Section -->
    <LandingHeroSection
      :primary-cta="{
        label: loggedIn ? 'Go to Dashboard' : 'Get Started Free',
        to: loggedIn ? '/dashboard' : '/auth/register',
      }"
    />

    <!-- Problem/Solution Section -->
    <LandingProblemSolution />

    <!-- Features Grid -->
    <div id="features">
      <LandingFeatureGrid />
    </div>

    <!-- FAQ -->
    <div id="faq">
      <LandingFAQ />
    </div>

    <!-- Footer -->
    <footer class="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <WebsiteSection class="py-12">
        <div class="grid gap-8 md:grid-cols-4">
          <!-- Brand -->
          <div>
            <div class="flex items-center gap-2">
              <div class="flex size-8 items-center justify-center rounded-lg bg-primary-600 dark:bg-primary-500">
                <UIcon name="i-lucide-message-square-quote" class="size-5 text-white" />
              </div>
              <p class="text-xl font-bold text-gray-900 dark:text-white">
                rakim
              </p>
            </div>
            <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
              keep the flow
            </p>
            <div class="mt-4 flex gap-3">
              <UButton
                icon="i-lucide-github"
                color="gray"
                variant="ghost"
                size="sm"
                to="https://github.com"
                target="_blank"
              />
              <UButton
                icon="i-lucide-twitter"
                color="gray"
                variant="ghost"
                size="sm"
                to="https://twitter.com"
                target="_blank"
              />
            </div>
          </div>

          <!-- Product -->
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              Product
            </h3>
            <ul class="mt-4 space-y-2">
              <li>
                <NuxtLink to="#features" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Features
                </NuxtLink>
              </li>
              <li>
                <NuxtLink to="/auth/register" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Get Started
                </NuxtLink>
              </li>
            </ul>
          </div>

          <!-- Resources -->
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              Resources
            </h3>
            <ul class="mt-4 space-y-2">
              <li>
                <NuxtLink to="/docs" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Documentation
                </NuxtLink>
              </li>
              <li>
                <NuxtLink to="/support" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Support
                </NuxtLink>
              </li>
              <li>
                <NuxtLink to="#faq" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  FAQ
                </NuxtLink>
              </li>
            </ul>
          </div>

          <!-- Legal -->
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              Legal
            </h3>
            <ul class="mt-4 space-y-2">
              <li>
                <NuxtLink to="/privacy" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Privacy Policy
                </NuxtLink>
              </li>
              <li>
                <NuxtLink to="/terms" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Terms of Service
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>

        <!-- Copyright -->
        <div class="mt-12 border-t border-gray-200 pt-8 dark:border-gray-800">
          <p class="text-center text-sm text-gray-500">
            © {{ new Date().getFullYear() }} rakim. All rights reserved.
          </p>
        </div>
      </WebsiteSection>
    </footer>

  </main>
</template>

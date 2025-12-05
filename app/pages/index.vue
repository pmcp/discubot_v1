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

// Mobile menu state
const mobileMenuOpen = ref(false)

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
  mobileMenuOpen.value = false
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
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary-600 dark:bg-primary-500">
            <UIcon name="i-lucide-message-square-quote" class="size-5 text-white" />
          </div>
          <p class="text-xl font-bold text-gray-900 dark:text-white">
            rakim
          </p>
        </NuxtLink>

        <!-- Desktop Navigation (center) -->
        <div class="hidden items-center gap-3 md:flex">
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

        <!-- Desktop Auth Buttons -->
        <div class="hidden items-center gap-3 md:flex">
          <AuthState v-slot="{ loggedIn: isAuthLoggedIn }">
            <UButton
              v-if="isAuthLoggedIn"
              color="gray"
              variant="soft"
              label="Dashboard"
              to="/dashboard"
              icon="i-lucide-layout-dashboard"
            />
            <template v-else>
              <UButton
                color="gray"
                variant="ghost"
                to="/auth/login"
                label="Login"
              />
              <UButton
                color="primary"
                to="/auth/register"
                label="Get Started"
              />
            </template>
          </AuthState>
          <ThemeToggle />
        </div>

        <!-- Mobile: Theme toggle + Hamburger -->
        <div class="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <UButton
            color="gray"
            variant="ghost"
            :icon="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
            @click="mobileMenuOpen = !mobileMenuOpen"
          />
        </div>
      </div>

      <!-- Mobile Menu -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="mobileMenuOpen"
          class="border-t border-gray-200 bg-white px-4 pb-4 pt-2 dark:border-gray-800 dark:bg-gray-950 md:hidden"
        >
          <nav class="flex flex-col gap-1">
            <UButton
              label="Features"
              color="gray"
              variant="ghost"
              block
              class="justify-start"
              @click="scrollToSection('features')"
            />
            <UButton
              label="FAQ"
              color="gray"
              variant="ghost"
              block
              class="justify-start"
              @click="scrollToSection('faq')"
            />
          </nav>
          <USeparator class="my-3" />
          <AuthState v-slot="{ loggedIn: isAuthLoggedIn }">
            <div class="flex flex-col gap-2">
              <UButton
                v-if="isAuthLoggedIn"
                color="gray"
                variant="soft"
                label="Go to Dashboard"
                to="/dashboard"
                icon="i-lucide-layout-dashboard"
                block
                @click="mobileMenuOpen = false"
              />
              <template v-else>
                <UButton
                  color="gray"
                  variant="soft"
                  to="/auth/login"
                  label="Login"
                  block
                  @click="mobileMenuOpen = false"
                />
                <UButton
                  color="primary"
                  to="/auth/register"
                  label="Get Started Free"
                  block
                  @click="mobileMenuOpen = false"
                />
              </template>
            </div>
          </AuthState>
        </div>
      </Transition>
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
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div class="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <!-- Brand -->
          <div class="col-span-2 sm:col-span-1">
            <div class="flex items-center gap-2">
              <div class="flex size-8 items-center justify-center rounded-lg bg-primary-600 dark:bg-primary-500">
                <UIcon name="i-lucide-message-square-quote" class="size-5 text-white" />
              </div>
              <p class="text-xl font-bold text-gray-900 dark:text-white">
                rakim
              </p>
            </div>
            <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
              keep the flow
            </p>
            <div class="mt-3 flex gap-2">
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
            <ul class="mt-3 space-y-2">
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
            <ul class="mt-3 space-y-2">
              <li>
                <NuxtLink to="/docs" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Documentation
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
            <ul class="mt-3 space-y-2">
              <li>
                <NuxtLink to="/privacy" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Privacy
                </NuxtLink>
              </li>
              <li>
                <NuxtLink to="/terms" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                  Terms
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>

        <!-- Copyright -->
        <div class="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
          <p class="text-center text-sm text-gray-500">
            © {{ new Date().getFullYear() }} rakim. All rights reserved.
          </p>
        </div>
      </div>
    </footer>

  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
</script>

<template>
  <UApp>
    <div class="min-h-screen flex">
      <!-- Sidebar -->
      <aside class="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div class="p-6 border-b border-gray-200">
          <h1 class="text-2xl font-bold text-gray-900">Discubot</h1>
          <p class="text-sm text-gray-500 mt-1">Admin Dashboard</p>
        </div>

        <nav class="flex-1 p-4">
          <RouterLink
            to="/"
            class="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors"
            :class="route.name === 'dashboard' ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-700 hover:bg-gray-100'"
          >
            <UIcon name="i-heroicons-home" class="w-5 h-5" />
            Dashboard
          </RouterLink>

          <RouterLink
            to="/config"
            class="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors"
            :class="route.name === 'config' ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-700 hover:bg-gray-100'"
          >
            <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5" />
            Source Config
          </RouterLink>

          <RouterLink
            to="/jobs"
            class="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors"
            :class="route.name === 'jobs' ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-700 hover:bg-gray-100'"
          >
            <UIcon name="i-heroicons-chart-bar" class="w-5 h-5" />
            Job Monitor
          </RouterLink>

          <RouterLink
            to="/test"
            class="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors"
            :class="route.name === 'test' ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-700 hover:bg-gray-100'"
          >
            <UIcon name="i-heroicons-bolt" class="w-5 h-5" />
            Test Connection
          </RouterLink>
        </nav>

        <div class="p-4 border-t border-gray-200">
          <UColorModeButton />
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-auto bg-gray-50">
        <RouterView />
      </main>
    </div>
  </UApp>
</template>

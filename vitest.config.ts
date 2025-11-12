import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      // Unit tests (fast, node environment)
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      // Nuxt runtime tests (for components, composables, server code)
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/**/*.nuxt.test.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
})

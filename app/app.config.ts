import { discubotDiscussionsConfig } from '../layers/discubot/collections/discussions/app/composables/useDiscubotDiscussions'
import { discubotConfigsConfig } from '../layers/discubot/collections/configs/app/composables/useDiscubotConfigs'
import { discubotJobsConfig } from '../layers/discubot/collections/jobs/app/composables/useDiscubotJobs'
import { discubotTasksConfig } from '../layers/discubot/collections/tasks/app/composables/useDiscubotTasks'
import { discubotUserMappingsConfig } from '../layers/discubot/collections/usermappings/app/composables/useDiscubotUserMappings'

export default defineAppConfig({
  croutonCollections: {
    discubotUserMappings: discubotUserMappingsConfig,
    discubotTasks: discubotTasksConfig,
    discubotJobs: discubotJobsConfig,
    discubotConfigs: discubotConfigsConfig,
    discubotDiscussions: discubotDiscussionsConfig,
  },
  ui: {
    icons: {
      loading: 'i-lucide-loader-circle',
    },
    button: {
      slots: {
        base: 'cursor-pointer',
      },
    },
    colors: {
      primary: 'emerald',
      neutral: 'neutral',
    },
  },
  seo: {
    title: 'Supersaas',
    description: 'The fullstack Nuxt 3 SaaS starter kit',
  },
})

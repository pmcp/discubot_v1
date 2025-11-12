import { discussioncollectionsDiscussionsConfig } from '../layers/discussion/collections/discussions/app/composables/useDiscussionCollectionsDiscussions'
import { discussioncollectionsSourceconfigsConfig } from '../layers/discussion/collections/sourceconfigs/app/composables/useDiscussionCollectionsSourceconfigs'
import { discussioncollectionsSyncjobsConfig } from '../layers/discussion/collections/syncjobs/app/composables/useDiscussionCollectionsSyncjobs'
import { discussioncollectionsTasksConfig } from '../layers/discussion/collections/tasks/app/composables/useDiscussionCollectionsTasks'
import { discussionDiscussionsConfig } from '../layers/discussion/collections/discussions/app/composables/useDiscussionDiscussions'
import { discussionSourceConfigsConfig } from '../layers/discussion/collections/sourceconfigs/app/composables/useDiscussionSourceConfigs'
import { discussionSyncJobsConfig } from '../layers/discussion/collections/syncjobs/app/composables/useDiscussionSyncJobs'
import { discussionTasksConfig } from '../layers/discussion/collections/tasks/app/composables/useDiscussionTasks'

export default defineAppConfig({
  croutonCollections: {
    discussionTasks: discussionTasksConfig,
    discussionSyncJobs: discussionSyncJobsConfig,
    discussionSourceConfigs: discussionSourceConfigsConfig,
    discussionDiscussions: discussionDiscussionsConfig,
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

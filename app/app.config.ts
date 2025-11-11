import { discussioncollectionsDiscussionsConfig } from '../layers/discussion-collections/collections/discussions/app/composables/useDiscussionCollectionsDiscussions'
import { discussioncollectionsSourceconfigsConfig } from '../layers/discussion-collections/collections/sourceconfigs/app/composables/useDiscussionCollectionsSourceconfigs'
import { discussioncollectionsSyncjobsConfig } from '../layers/discussion-collections/collections/syncjobs/app/composables/useDiscussionCollectionsSyncjobs'
import { discussioncollectionsTasksConfig } from '../layers/discussion-collections/collections/tasks/app/composables/useDiscussionCollectionsTasks'

export default defineAppConfig({
  croutonCollections: {
    discussionCollectionsTasks: discussioncollectionsTasksConfig,
    discussionCollectionsSyncjobs: discussioncollectionsSyncjobsConfig,
    discussionCollectionsSourceconfigs: discussioncollectionsSourceconfigsConfig,
    discussionCollectionsDiscussions: discussioncollectionsDiscussionsConfig,
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

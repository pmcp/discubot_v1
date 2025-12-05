import { discubotDiscussionsConfig } from '../layers/discubot/collections/discussions/app/composables/useDiscubotDiscussions'
import { discubotConfigsConfig } from '../layers/discubot/collections/configs/app/composables/useDiscubotConfigs'
import { discubotJobsConfig } from '../layers/discubot/collections/jobs/app/composables/useDiscubotJobs'
import { discubotTasksConfig } from '../layers/discubot/collections/tasks/app/composables/useDiscubotTasks'
import { discubotUserMappingsConfig } from '../layers/discubot/collections/usermappings/app/composables/useDiscubotUserMappings'
import { discubotInboxMessagesConfig } from '../layers/discubot/collections/inboxmessages/app/composables/useDiscubotInboxMessages'
import { discubotFlowsConfig } from '../layers/discubot/collections/flows/app/composables/useDiscubotFlows'
import { discubotFlowInputsConfig } from '../layers/discubot/collections/flowinputs/app/composables/useDiscubotFlowInputs'
import { discubotFlowOutputsConfig } from '../layers/discubot/collections/flowoutputs/app/composables/useDiscubotFlowOutputs'

export default defineAppConfig({
  croutonCollections: {
    discubotFlowOutputs: discubotFlowOutputsConfig,
    discubotFlowInputs: discubotFlowInputsConfig,
    discubotFlows: discubotFlowsConfig,
    discubotInboxMessages: discubotInboxMessagesConfig,
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
      primary: 'coral',
      neutral: 'neutral',
    },
  },
  seo: {
    title: 'Rakim',
    description: 'Stay on track of tasks while keeping the flow',
  },
})

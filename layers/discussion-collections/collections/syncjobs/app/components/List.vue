<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-collectionsSyncjobs"
    :columns="columns"
    :rows="syncjobs || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionCollectionsSyncjobs"
        :collection="'discussion-collectionsSyncjobs'"
        createButton
      />
    </template>
    <template #discussionId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.discussionId"
        :id="row.original.discussionId"
        collection="discussioncollectionsDiscussions"
      />
    </template>
    <template #sourceConfigId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.sourceConfigId"
        :id="row.original.sourceConfigId"
        collection="discussioncollectionsSourceconfigs"
      />
    </template>
    <template #startedAt-cell="{ row }">
      <CroutonDate :date="row.original.startedAt"></CroutonDate>
    </template>
    <template #completedAt-cell="{ row }">
      <CroutonDate :date="row.original.completedAt"></CroutonDate>
    </template>
  </CroutonCollection>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscussionCollectionsSyncjobs()

const { items: syncjobs, pending } = await useCollectionQuery(
  'discussion-collectionsSyncjobs'
)
</script>
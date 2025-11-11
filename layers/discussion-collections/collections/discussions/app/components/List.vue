<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-collectionsDiscussions"
    :columns="columns"
    :rows="discussions || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionCollectionsDiscussions"
        :collection="'discussion-collectionsDiscussions'"
        createButton
      />
    </template>
    <template #sourceConfigId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.sourceConfigId"
        :id="row.original.sourceConfigId"
        collection="discussioncollectionsSourceconfigs"
      />
    </template>
    <template #syncJobId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.syncJobId"
        :id="row.original.syncJobId"
        collection="discussioncollectionsSyncjobs"
      />
    </template>
    <template #processedAt-cell="{ row }">
      <CroutonDate :date="row.original.processedAt"></CroutonDate>
    </template>
  </CroutonCollection>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscussionCollectionsDiscussions()

const { items: discussions, pending } = await useCollectionQuery(
  'discussion-collectionsDiscussions'
)
</script>
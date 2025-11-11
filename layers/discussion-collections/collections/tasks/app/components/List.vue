<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-collectionsTasks"
    :columns="columns"
    :rows="tasks || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionCollectionsTasks"
        :collection="'discussion-collectionsTasks'"
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
    <template #syncJobId-cell="{ row }">
      <CroutonItemCardMini
        v-if="row.original.syncJobId"
        :id="row.original.syncJobId"
        collection="discussioncollectionsSyncjobs"
      />
    </template>
  </CroutonCollection>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  layout?: any
}>(), {
  layout: 'table'
})

const { columns } = useDiscussionCollectionsTasks()

const { items: tasks, pending } = await useCollectionQuery(
  'discussion-collectionsTasks'
)
</script>
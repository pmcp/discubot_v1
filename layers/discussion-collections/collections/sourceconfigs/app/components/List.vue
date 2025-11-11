<template>
  <CroutonCollection
    :layout="layout"
    collection="discussion-collectionsSourceconfigs"
    :columns="columns"
    :rows="sourceconfigs || []"
    :loading="pending"
  >
    <template #header>
      <CroutonTableHeader
        title="DiscussionCollectionsSourceconfigs"
        :collection="'discussion-collectionsSourceconfigs'"
        createButton
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

const { columns } = useDiscussionCollectionsSourceconfigs()

const { items: sourceconfigs, pending } = await useCollectionQuery(
  'discussion-collectionsSourceconfigs'
)
</script>
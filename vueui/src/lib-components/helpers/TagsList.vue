<template>
  <v-chip v-for="tag in item.tags" :key="tag">
    {{tag}}
  </v-chip>
</template>
<script>

export default {
  props: {
    item: {
      type: Object,
      required: true
    }
  }
}

</script>

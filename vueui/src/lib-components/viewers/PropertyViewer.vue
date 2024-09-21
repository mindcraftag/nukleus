<template>
  <div>
    <v-data-table
      v-if="properties.length"
      class="table propertiesTable"
      density="compact"
      :disable-pagination="true"
      :disable-filtering="true"
      :disable-sort="true"
      hide-default-footer
      style="width: 100%"
      :items="properties"
    >
      <template #item="props">
        <tr>
          <td>
            {{ props.item.key }}
          </td>
          <td>
            {{ props.item.value }}
          </td>
        </tr>
      </template>
    </v-data-table>
    <span v-if="!properties.length">No values available</span>
  </div>
</template>
<style>
.propertiesTable td:first-child {
  width: 30%;
}
</style>
<script>
export default {
  props: {
    properties: {
      type: Array,
      required: true,
      default: [],
    },
  },
}
</script>

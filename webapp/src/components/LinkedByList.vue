<template>
  <div>
    <v-data-table
      class="table"
      density="compact"
      :disable-pagination="true"
      :disable-filtering="true"
      :disable-sort="true"
      hide-default-footer
      style="width: 100%"
      :items="items"
    >
      <template #item="props">
        <tr>
          <td>
            {{ props.item.name }}
            <v-btn icon @click.stop="gotoFolder(props.item)">
              <v-icon>mdi-folder</v-icon>
            </v-btn>
          </td>
        </tr>
      </template>
    </v-data-table>
  </div>
</template>
<script>

import { watch } from 'vue'

export default {
  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    itemId: {
      type: String,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    items: [],
  }),

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  created() {
    this.loadData();

    watch(() => [this.itemId], () => {
      this.loadData();
    });
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    gotoFolder(item) {
      this.openFolderById(item.folder ? item.folder : "0");
    },

    openFolderById(folderId) {
      this.$emit("open-folder", folderId);
    },

    async loadData() {
      try {
        if (this.itemId)
          this.items = await this.$store.state.nkclient.getItemsLinking(
            this.itemId,
          );
        else this.items = [];
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>
<style></style>

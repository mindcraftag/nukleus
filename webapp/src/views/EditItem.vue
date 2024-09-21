<template>
  <div data-test="editItemPage">
    <EditItem v-if="itemRepo.activeItem" :item="itemRepo.activeItem">
    </EditItem>
    <v-overlay :absolute="true" :model-value="loading">
      <v-progress-circular indeterminate></v-progress-circular>
    </v-overlay>
  </div>
</template>
<script>
import EditItem from "../components/EditItem.vue";
import store from "../store";

export default {
  components: {
    EditItem,
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    loading: false,
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    itemRepo() {
      return this.$store.state.nkclient.getItemRepo();
    },
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  async created() {
    this.itemRepo.clear();
    await this.loadItem();
  },

  beforeUnmount() {
    this.itemRepo.clear();
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    async ensureCorrectClient(itemId) {
      const clientId = await this.$store.state.nkclient.getItemClient(itemId);
      if (!clientId) {
        throw "Cannot find this item.";
      }
      this.$store.commit("setActiveClient", clientId);
    },

    async loadItem() {
      this.loading = true;
      const itemId = this.$route.params.id;

      try {
        await this.itemRepo.loadItemRecursive(itemId);
      } catch (err) {
        try {
          // we did not get the required item. maybe we're not in the right client
          // make sure to switch.
          await this.ensureCorrectClient(itemId);
          await this.itemRepo.loadItemRecursive(itemId);
        } catch (err) {
          console.error(err);
          this.$store.commit("setError", err.toString());
        }
      }

      this.loading = false;
    },
  },
};
</script>
<style></style>

<style></style>

<template>
  <div>
    <iframe
      ref="iframeRef"
      :src="iframeLink"
      style="
        border: none;
        display: block;
        width: 100%;
        height: calc(100vh - 64px);
      "
    />
    <v-btn
      fab
      size="small"
      style="
        position: absolute;
        top: 8px;
        left: 8px;
        opacity: 0.5;
        z-index: 1000;
        width: 28px;
      "
      @click="close"
    >
      <v-icon>mdi-close</v-icon>
    </v-btn>
  </div>
</template>

<script>
export default {
  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    gpuRamQuota: 64 * 1024 * 1024 * 1024,
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    itemRepo() {
      return this.$store.state.nkclient.getItemRepo();
    },
    iframeLink() {
      // When there is an active item, we build a url to viewer.nukleus.cloud
      // and enable instantPlay and hideClose.
      if (this.itemRepo.activeItem) {
        return (
          this.$store.state.nkclient.getViewerBaseUrl() +
          `/${this.itemRepo.activeItem._id}?instantPlay=true&hideClose=true`
        );
      }
      // Otherwise we just return a blank page for now.
      return "about:blank";
    },
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  async created() {
    this.itemRepo.clear();
    await this.loadItem();
  },

  mounted() {
    // Wait until the iframe has loaded, otherwise the viewercomponent might
    // not have registered an event listerner yet.
    this.$refs.iframeRef.addEventListener("load", () => {
      // When the iframe has loaded, we need to pass our access token to the
      // embedded viewercomponent so it can load private items. To make sure
      // that the token is only received by the intended recipient, we specify
      // what origin is required to receive this message: "https://viewer.nukleus.cloud".
      // Any iframes from other origins will not receive this message.
      this.$refs.iframeRef.contentWindow.postMessage(
        {
          command: "setAccessToken",
          value: this.$store.state.token,
        },
        this.$store.state.nkclient.getViewerBaseUrl(),
      );
    });
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
      try {
        const itemId = this.$route.params.id;
        await this.ensureCorrectClient(itemId);
        this.itemRepo.loadItemRecursive(itemId);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    close() {
      if (window.history.length > 1) this.$router.go(-1);
      else {
        if (this.item.folder)
          this.$router.push("/items/" + this.item.folder._id);
        else this.$router.push("/items");
      }
    },
  },
};
</script>

<style></style>

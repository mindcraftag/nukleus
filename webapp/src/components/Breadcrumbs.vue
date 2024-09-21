<template>
  <v-breadcrumbs v-if="items" :items="items" class="breadcrumbs" divider="/">
    <template #title="{ item }">
      <router-link
        :to="{ name: item.href, params: item.params }"
        class="link"
        >{{ item.name }}</router-link
      >
    </template>
  </v-breadcrumbs>
</template>

<script>

import { watch } from 'vue'

export default {
  data() {
    return {
      items: [],
    };
  },

  created() {
    watch(() => [this.$route], () => {
      this.updateBreadcrumbs();
    });
  },

  mounted() {
    const vm = this;
    this.updateBreadcrumbs();
    this.$store.state.nkclient.eventBus.$on("breadcrumbUpdate", (event) => {
      vm.updateBreadcrumbs(event);
    });
  },

  methods: {
    updateBreadcrumbs(breadcrumbs) {
      this.items = breadcrumbs || this.$route.meta.breadcrumb;
    },
  },
};
</script>

<style>
.breadcrumbs {
  padding-bottom: 0 !important;
}

.breadcrumbs .link {
  text-decoration: none;
  color: #737373;
  font: bold 20px Sans-Serif;
  letter-spacing: -1px;
  white-space: nowrap;
  display: inline-block;
  position: relative;
}
</style>

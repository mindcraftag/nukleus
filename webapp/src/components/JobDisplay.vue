<template>
  <div v-if="state">
    Job: {{ state }}
    <v-progress-linear :model-value="progress"></v-progress-linear>
  </div>
</template>
<script>
import store from "../store";

export default {
  computed: {
    state() {
      return store.state.job.state;
    },

    progress() {
      return store.state.job.progress;
    },
  },
};
</script>
<style></style>

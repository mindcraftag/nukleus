<template>
  <div v-if="types.length > 0" class="list">
    <div
      v-for="elem in types"
      :key="elem.name"
      class="item"
      :class="
        enabledTypes.includes(elem.name) ? 'item--enabled' : 'item--disabled'
      "
    >
      <div
        :class="
          'statusCircle statusCircle--' +
          (enabledTypes.includes(elem.name) ? 'active' : 'inactive')
        "
      ></div>

      <span
        :class="
          'statusText statusText--' +
          (enabledTypes.includes(elem.name) ? 'active' : 'inactive')
        "
      >
        {{ enabledTypes.includes(elem.name) ? "ACTIVE" : "INACTIVE" }}
      </span>

      <span>{{ elem.name }}</span>
      <v-btn density="compact" @click="onChange(elem.name)">{{
        enabledTypes.includes(elem.name) ? "Disable" : "Enable"
      }}</v-btn>
    </div>
  </div>
  <div v-else class="noTypes">
    <span>No Job Types found.</span>
  </div>
</template>

<script>
export default {
  props: {
    enabledTypes: {
      type: Array,
      required: true,
      default: [],
    },
    setEnabledTypes: {
      type: Function,
      required: true,
    },
  },
  data: () => ({
    types: [],
  }),
  async mounted() {
    this.types = await this.$store.state.nkclient.getClientJobTypes();
  },
  methods: {
    onChange(id) {
      const enabledTypes = [...this.enabledTypes];
      if (enabledTypes.includes(id)) {
        enabledTypes.splice(enabledTypes.indexOf(id), 1);
      } else {
        enabledTypes.push(id);
      }
      this.setEnabledTypes(enabledTypes);
    },
  },
};
</script>

<style scoped>
.list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.item {
  display: flex;
  align-items: center;
  margin: 0 2rem;
}

.item > span {
  margin-right: 1rem;
}

.statusCircle {
  width: 0.8rem;
  aspect-ratio: 1;
  border-radius: 1rem;
}

.statusCircle--active {
  background-color: var(--v-info-base);
}

.statusCircle--inactive {
  background-color: var(--v-secondary-lighten2);
}

.statusText {
  margin-left: 0.4rem;
  font-size: 0.8rem;
  font-weight: bold;
  background-color: transparent !important;
}

.statusText--active {
  color: var(--v-info-base);
}

.statusText--inactive {
  color: var(--v-secondary-lighten2);
}
</style>

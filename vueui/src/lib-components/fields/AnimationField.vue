<template>
  <span v-if="!items.length || items.length === 0">No animations</span>
  <div v-else>
    <div class="d-flex">
      <v-btn size="x-small" @click="toggleExpanded">
        <font-awesome-icon :icon="isExpanded ? ['fal', 'chevron-up'] : ['fal', 'chevron-down']"/>
      </v-btn>
    </div>
    <v-expand-transition>
      <div v-if="isExpanded" style="max-height: 200px; overflow: hidden auto; padding: 4px 0;">
        <table style="width: 100%">
          <tbody>
            <tr
              v-for="(item, index) in items"
              :key="index"
            >
              <td style="width: 24px">{{ item.name }}</td>
              <td>
                <v-slider
                  v-model="item.weight"
                  max=1
                  min=0
                  thumb-size="12"
                  track-size="6"
                  thumb-label
                  hide-details
                  @update:model-value="updateWeights"
                >
                </v-slider>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </v-expand-transition>
  </div>
</template>

<style>
</style>

<script>

export default {

  name: "AnimationField",

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Object,
    },
    allowEdit: {
      type: Boolean,
      required: true,
      default: false,
    },
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    isExpanded: false
  }),

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    items: {
      get() {
        return this.computedValue.value;
      },
      set(value) {
        this.computedValue.value = value;
      }
    },
    computedValue: {
      get() {
        return this.modelValue
      }
    },
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    toggleExpanded() {
      this.isExpanded = !this.isExpanded;
    },
    updateWeights() {
      this.items = this.items.map(item => ({name: item.name, weight: item.weight}));
      
      this.$emit('update:modelValue', this.modelValue);
      this.$emit('changed');
    },
  }
}
</script>

<template>
  <div class="fieldValueContainer">
    <SmallSelect
      v-model="computedValue"
      :items="options"
      multiple
      :readonly="!allowEdit"
    />
  </div>
</template>
<style></style>
<script>

import SmallSelect from "../wrappers/SmallSelect.vue";

export default {

  name: "MultiEnumField",

  components: {
    SmallSelect
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Array,
      required: true,
    },
    options: {
      type: Array,
      required: true,
    },
    allowEdit: {
      type: Boolean,
      default: false,
    },
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    computedValue: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
        this.$emit('changed')
      },
    },
  },
}
</script>

<template>
  <div class="fieldValueContainer">
    <SmallSelect
      v-model="computedValue"
      :items="options"
      :read-only="!allowEdit"
    />
  </div>
</template>
<style></style>
<script>

import SmallSelect from "../wrappers/SmallSelect.vue";

export default {

  name: "EnumField",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    SmallSelect
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
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
        //console.log("Set new Enum value: " + value);
        this.$emit('update:modelValue', value)
        this.$emit('changed')
      },
    },
  },
}
</script>

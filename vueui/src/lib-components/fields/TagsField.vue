<template>
  <div class="fieldValueContainer">
    <SmallCombobox
      v-model="computedValue"
      multiple
      :readonly="!allowEdit"
    ></SmallCombobox>
  </div>
</template>
<script>
import SmallCombobox from "../wrappers/SmallCombobox.vue";

export default {

  name: "TagsField",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    SmallCombobox
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Array,
      required: true,
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

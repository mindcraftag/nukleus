<template>
  <div class="fieldValueContainer">
    <SmallCheckbox
      v-model="computedValue"
      :read-only="!allowEdit"
    />
  </div>
</template>
<script>
import SmallCheckbox from "../wrappers/SmallCheckbox.vue";

export default {

  name: "BooleanField",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    SmallCheckbox
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean,
      required: true,
      default: false,
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
        const newVal = Boolean(value)
        //console.log("Set new Boolean value: " + newVal);
        this.$emit('update:modelValue', newVal)
        this.$emit('changed')
      },
    },
  },
}
</script>

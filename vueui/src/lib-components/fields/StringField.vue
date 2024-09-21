<template>
  <div class="fieldValueContainer">
    <SmallTextField
      v-model="computedValue"
      density="compact"
      :readonly="!allowEdit"
    />
  </div>
</template>
<style></style>
<script>
import SmallTextField from "../wrappers/SmallTextField.vue";

export default {

  name: "StringField",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    SmallTextField
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: String,
      required: true,
      default: '',
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

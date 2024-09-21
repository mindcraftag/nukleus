<template>
  <!-- TODO v-textarea grows outside of parent -->
  <div class="d-flex fieldValueContainer" style="min-height: 48px; padding: 0">
    <textarea
      v-model="text"
      style="resize: none; width: 100%"
      :readonly="!allowEdit"
    >
    </textarea>
  </div>
</template>
<style></style>
<script>
export default {

  name: "TextAreaField",

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
    text: {
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

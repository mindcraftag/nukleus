<template>
  <v-text-field
      v-model="value"
      class="smallTextField"
      hide-details
      required="required"
      variant="underlined"
      density="compact"
      width="99%"
      :readonly="readOnly"
  />
</template>
<style>

.smallTextField input {
  height: 24px;
  font-size: 12px;
  padding-top: 0 !important;
}

.smallTextField .v-input__append {
  padding: 0 !important;
}

</style>
<script>

export default {

  props: {
    modelValue: {
      required: true
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    required: {
      type: Boolean,
      default: false
    }
  },

  emits: ['update:modelValue'],

  computed: {
    value: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      }
    }
  }

}

</script>

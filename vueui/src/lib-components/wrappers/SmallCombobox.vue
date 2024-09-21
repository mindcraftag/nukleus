<template>
  <v-combobox
      v-model="value"
      class="smallCombobox"
      hide-details
      :multiple="multiple"
      variant="underlined"
      density="compact"
      :readonly="readOnly"
  ></v-combobox>
</template>
<style>

.smallCombobox .v-combobox__selection-text {
  font-size: 12px !important;
}

.smallCombobox input {
  font-size: 12px !important;
}

.smallCombobox .v-field__input {
  padding-top: 0 !important;
}

.smallCombobox .v-field__field {
  height: 24px;
}

.smallCombobox .v-combobox__selection {
  height: 24px;
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
    },
    multiple: {
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

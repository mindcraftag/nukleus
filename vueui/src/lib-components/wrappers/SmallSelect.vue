<template>
  <v-select
      v-model="value"
      v-if="!readOnly"
      class="smallSelect"
      variant="underlined"
      hide-details
      density="compact"
  ></v-select>
  <div v-else class="smallSelectReadOnly">
    {{ value }}
  </div>
</template>
<style>

.smallSelectReadOnly {
  height: 24px;
  font-size: 12px;
  padding: 4px;
}

.smallSelect .v-field__prepend-inner {
  padding: 0 !important;
  max-height: 24px !important;
  min-height: 24px !important;
}

.smallSelect .v-field__input {
  height: 24px !important;
  max-height: 24px !important;
  min-height: 24px !important;
  font-size: 12px;
  padding-top: 0 !important;
}

.smallSelect .v-field__append-inner {
  padding: 0 !important;
}

.smallSelect .v-select__selection {
  margin: 0 !important;
  height: 24px !important;
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

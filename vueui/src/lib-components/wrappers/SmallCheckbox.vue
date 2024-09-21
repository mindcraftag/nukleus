<template>
  <v-checkbox
      v-model="value"
      class="smallCheckbox"
      :required="required"
      hide-details
      v-if="!readOnly"
  />
  <div v-else class="smallCheckboxReadOnly">
    {{ value ? "Yes" : "No" }}
  </div>
</template>
<style>

.smallCheckboxReadOnly {
  height: 24px;
  font-size: 12px;
  padding: 4px;
}

.smallCheckbox .v-selection-control__wrapper {
  height: 24px !important;
}

.smallCheckbox .v-checkbox-btn {
  height: 24px !important;
  min-height: 24px !important;
}

.smallCheckbox .v-selection-control__input {
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

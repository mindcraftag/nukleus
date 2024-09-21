<template>
  <v-textarea
      v-model="value"
      class="smallTextArea"
      no-resize
      hide-details
      variant="underlined"
      density="compact"
      :style="style"
      :readonly="readOnly"
      :required="required"
  />
</template>
<style>

.smallTextArea textarea {
  font-size: 12px;

}

</style>
<script>

export default {

  props: {
    modelValue: {
      required: true
    },
    height: {
      type: Number,
      default: 100
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
    style: {
      get() {
        return `height: ${this.height}px`
      }
    },
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

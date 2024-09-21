<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Default value:
    </div>
    <div class="field-value">
      <ColorField v-model="field.defaultValue" @input="changed" />
    </div>
  </div>
</template>

<script>

import ColorField from '../widgets/ColorField'

export default {

  components: {
    ColorField
  },

  props: {
    value: {
      type: Object,
      required: true
    }
  },

  computed: {
    field: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    }
  },

  methods: {
    changed() {
      this.$emit('input', this.value);
    }
  }
}
</script>

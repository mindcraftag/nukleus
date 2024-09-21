<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Label:
    </div>
    <div class="field-value">
      <v-text-field dense v-model="value.label" @input="changed" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'DataTypeEditorFieldSeparator',

  props: {
    value: {
      type: Object,
      required: true
    },
  },

  methods: {
    changed() {
      this.$emit('input', this.value);
    }
  }
}
</script>

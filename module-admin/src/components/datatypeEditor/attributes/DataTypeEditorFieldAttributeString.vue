<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Default value:
    </div>
    <div class="field-value">
      <v-text-field v-model="field.defaultValue" dense @input="changed" />
    </div>
  </div>
</template>

<script>
export default {

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

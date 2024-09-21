<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Default value:
    </div>
    <div class="field-value">
      <v-checkbox v-model="field.defaultValue"
                  style="height: 24px; margin-top: -4px; margin-left: 4px;"
                  @change="changed"
                  hide-details />
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

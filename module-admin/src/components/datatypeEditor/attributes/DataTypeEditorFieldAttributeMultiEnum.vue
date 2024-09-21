<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Options:
    </div>
    <div class="field-value">
      <EnumOptionsField v-model="field.options" @input="changed" />
    </div>
  </div>
</template>

<script>

import EnumOptionsField from "../widgets/EnumOptionsField";

export default {

  components: {
    EnumOptionsField
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

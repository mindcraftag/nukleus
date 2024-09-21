<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Default value:
    </div>
    <div class="field-value">
      <v-checkbox v-model="isNull"
                  label="Is Null"
                  @change="changed"
                  style="height: 24px; margin-top: -4px; margin-left: 4px;"
                  hide-details />
    </div>
    <div class="field-value" v-if="field.defaultValue !== null">
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
    },
    isNull: {
      get() {
        return this.field.defaultValue === null;
      },
      set(value) {
        if (!value) {
          this.field.defaultValue = {r: 0, g: 0, b: 0, a: 255 };
        } else {
          this.field.defaultValue = null;
        }
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

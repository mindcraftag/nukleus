<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Default value:
    </div>
    <div class="field-name">
      X:
    </div>
    <div class="field-value">
      <v-text-field v-model.number="x" type="number" @input="changed" dense />
    </div>
    <div class="field-name">
      Y:
    </div>
    <div class="field-value">
      <v-text-field v-model.number="y" type="number" @input="changed" dense />
    </div>
    <div class="field-name">
      Z:
    </div>
    <div class="field-value">
      <v-text-field v-model.number="z" type="number" @input="changed" dense />
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
    },
    x: {
      get() {
        return this.field.defaultValue.x;
      },
      set(value) {
        this.field.defaultValue.x = value;
      }
    },
    y: {
      get() {
        return this.field.defaultValue.y;
      },
      set(value) {
        this.field.defaultValue.y = value;
      }
    },
    z: {
      get() {
        return this.field.defaultValue.z;
      },
      set(value) {
        this.field.defaultValue.z = value;
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

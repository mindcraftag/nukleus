<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Options:
    </div>
    <div class="field-value">
      <EnumOptionsField v-model="field.options" @input="changed" />
    </div>
    <div class="field-name">
      Default value:
    </div>
    <div class="field-value">
      <v-select v-model="field.defaultValue"
                :items="field.options"
                @change="changed"
                dense
      ></v-select>
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
      let found = false;

      if (this.field.options.length) {
        for (const option of this.field.options) {
          if (this.field.defaultValue === option) {
            found = true;
            break;
          }
        }

        if (!found)
          this.field.defaultValue = this.field.options[0];
      }
      else {
        this.field.defaultValue = null;
      }

      this.$emit('input', this.value);
    }
  }
}
</script>

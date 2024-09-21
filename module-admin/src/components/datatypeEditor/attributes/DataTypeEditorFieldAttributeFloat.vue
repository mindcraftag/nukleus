<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Default value:
    </div>
    <div class="field-value" style="width: 50px">
      <v-text-field v-model.number="field.defaultValue" type="number" @input="changed" dense
      ></v-text-field>
    </div>
    <div class="field-name">
      Min value:
    </div>
    <div class="field-value" style="width: 50px">
      <v-text-field v-model.number="field.minValue" type="number" @input="changed" dense
      ></v-text-field>
    </div>
    <div class="field-name">
      Max value:
    </div>
    <div class="field-value" style="width: 50px">
      <v-text-field v-model.number="field.maxValue" type="number" @input="changed" dense
      ></v-text-field>
    </div>
    <div class="field-name">
      Slider:
    </div>
    <div class="field-value">
      <v-checkbox v-model="isSlider"
                  @change="changed"
                  style="height: 24px; margin-top: -4px; margin-left: 4px;"
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
    },
    isSlider: {
      get() {
        return this.field.widget === "Slider";
      },
      set(value) {
        this.field.widget = value ? "Slider" : null;
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

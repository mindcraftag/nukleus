<template>
  <div class="color-field">
    <div class="color-field-inner" :style="color" @click="pickColor">
      <ColorPickerDialog v-model="showColorPicker"
                         :color="colorValue"
                         @color-changed="changed">
      </ColorPickerDialog>
    </div>
  </div>
</template>
<style>

.color-field {
  height: 18px;
  min-height: 18px;
  min-width: 19px;
  margin: 2px;
  border-radius: 4px;
  text-align: center;
  background: repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px
}

.color-field-inner {
  height: 18px;
  min-height: 18px;
  min-width: 19px;
  border-radius: 4px;
}

</style>
<script>

import ColorPickerDialog from "../dialogs/ColorPickerDialog";

export default {

  components: {
    ColorPickerDialog
  },

  props: {
    value: {
      type: Object
    }
  },

  data: () => ({
    showColorPicker: false
  }),

  computed: {
    colorValue: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    },
    color: {
      get() {
        return `background-color: rgba(${this.value.r}, ${this.value.g}, ${this.value.b}, ${this.value.a/255})`;
      }
    }
  },

  methods: {
    pickColor() {
      this.showColorPicker = true;
    },
    changed(e) {
      this.showColorPicker = false;
      this.$emit('input', e);
    }
  }

}

</script>

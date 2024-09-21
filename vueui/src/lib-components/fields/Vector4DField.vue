<template>
  <table style="width: 100%">
    <tr>
      <td class="fieldNameRight">{{ labels[0] }}:</td>
      <td>
        <FloatField
          v-model="computedX"
          :allow-edit="allowEdit"
          :allow-reset="false"
          :min-value="minValue"
          :max-value="maxValue"
        />
      </td>
    </tr>
    <tr>
      <td class="fieldNameRight">{{ labels[1] }}:</td>
      <td>
        <FloatField
          v-model="computedY"
          :allow-edit="allowEdit"
          :allow-reset="false"
          :min-value="minValue"
          :max-value="maxValue"
        />
      </td>
    </tr>
    <tr>
      <td class="fieldNameRight">{{ labels[2] }}:</td>
      <td>
        <FloatField
          v-model="computedZ"
          :allow-edit="allowEdit"
          :allow-reset="false"
          :min-value="minValue"
          :max-value="maxValue"
        />
      </td>
    </tr>
    <tr>
      <td class="fieldNameRight">{{ labels[3] }}:</td>
      <td>
        <FloatField
          v-model="computedW"
          :allow-edit="allowEdit"
          :allow-reset="false"
          :min-value="minValue"
          :max-value="maxValue"
        />
      </td>
    </tr>
  </table>
</template>
<style>
.vector4DLabel {
  height: 32px;
  padding-top: 6px;
  padding-right: 4px;
}
</style>
<script>
import FloatField from './FloatField.vue'

export default {

  name: "Vector4DField",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    FloatField,
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    allowEdit: {
      type: Boolean,
      required: true,
    },
    labels: {
      type: Array,
      default: function () {
        return ['X', 'Y', 'Z', 'W']
      },
    },
    minValue: {
      type: Number,
      default: Number.MIN_VALUE,
    },
    maxValue: {
      type: Number,
      default: Number.MAX_VALUE,
    },
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    computedX: {
      get() {
        return this.modelValue.x
      },
      set(value) {
        //console.log("Set new Vector4D.X value: " + value);
        this.$emit('update:modelValue', {
          x: value,
          y: this.modelValue.y,
          z: this.modelValue.z,
          w: this.modelValue.w,
        })
        this.$emit('changed')
      },
    },
    computedY: {
      get() {
        return this.modelValue.y
      },
      set(value) {
        //console.log("Set new Vector4D.Y value: " + value);
        this.$emit('update:modelValue', {
          x: this.modelValue.x,
          y: value,
          z: this.modelValue.z,
          w: this.modelValue.w,
        })
        this.$emit('changed')
      },
    },
    computedZ: {
      get() {
        return this.modelValue.z
      },
      set(value) {
        //console.log("Set new Vector4D.Z value: " + value);
        this.$emit('update:modelValue', {
          x: this.modelValue.x,
          y: this.modelValue.y,
          z: value,
          w: this.modelValue.w,
        })
        this.$emit('changed')
      },
    },
    computedW: {
      get() {
        return this.modelValue.w
      },
      set(value) {
        //console.log("Set new Vector4D.W value: " + value);
        this.$emit('update:modelValue', {
          x: this.modelValue.x,
          y: this.modelValue.y,
          z: this.modelValue.z,
          w: value,
        })
        this.$emit('changed')
      },
    },
  },
}
</script>

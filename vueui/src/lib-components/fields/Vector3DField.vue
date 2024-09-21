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
  </table>
</template>
<script>
import FloatField from './FloatField.vue'

export default {

  name: "Vector3DField",

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
        return ['X', 'Y', 'Z']
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
        return Math.round(this.modelValue.x * 1000) / 1000
      },
      set(value) {
        //console.log("Set new Vector3D.X value: " + value);
        this.$emit('update:modelValue', {
          x: value,
          y: this.modelValue.y,
          z: this.modelValue.z,
        })
        this.$emit('changed')
      },
    },
    computedY: {
      get() {
        return Math.round(this.modelValue.y * 1000) / 1000
      },
      set(value) {
        //console.log("Set new Vector3D.Y value: " + value);
        this.$emit('update:modelValue', {
          x: this.modelValue.x,
          y: value,
          z: this.modelValue.z,
        })
        this.$emit('changed')
      },
    },
    computedZ: {
      get() {
        return Math.round(this.modelValue.z * 1000) / 1000
      },
      set(value) {
        //console.log("Set new Vector3D.Z value: " + value);
        this.$emit('update:modelValue', {
          x: this.modelValue.x,
          y: this.modelValue.y,
          z: value,
        })
        this.$emit('changed')
      },
    },
  },
}
</script>

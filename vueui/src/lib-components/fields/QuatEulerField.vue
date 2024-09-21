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
          :step="1"
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
          :step="1"
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
          :step="1"
        />
      </td>
    </tr>
  </table>
</template>
<script>
import FloatField from './FloatField.vue'
import mathHelpers from '../../js-modules/mathhelpers'

export default {

  name: "QuatEulerField",

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
    computedValue: {
      get() {
        if (this.modelValue.w !== undefined) {
          // this is a quaternion. convert to euler
          const euler = mathHelpers.quaternionToEuler(this.modelValue)
          const eulerDeg = mathHelpers.eulerRadToDegRounded(euler)
          return eulerDeg
        } else {
          // we have an euler vector here. just return it
          return this.modelValue
        }
      },
      set(value) {
        const euler = mathHelpers.eulerDegToRad(value)
        const quat = mathHelpers.eulerToQuaternion(euler)
        this.$emit('update:modelValue', quat)
        this.$emit('changed')
      },
    },

    computedX: {
      get() {
        return this.computedValue.x
      },
      set(value) {
        this.computedValue = {
          x: value,
          y: this.computedValue.y,
          z: this.computedValue.z,
        }
      },
    },
    computedY: {
      get() {
        return this.computedValue.y
      },
      set(value) {
        this.computedValue = {
          x: this.computedValue.x,
          y: value,
          z: this.computedValue.z,
        }
      },
    },
    computedZ: {
      get() {
        return this.computedValue.z
      },
      set(value) {
        this.computedValue = {
          x: this.computedValue.x,
          y: this.computedValue.y,
          z: value,
        }
      },
    },
  },
}
</script>

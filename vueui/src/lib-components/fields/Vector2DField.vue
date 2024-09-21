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
  </table>
</template>
<script>
import FloatField from './FloatField.vue'

export default {

  name: "Vector2DField",

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
        return ['X', 'Y']
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
        //console.log("Set new Vector3D.X value: " + value);
        this.$emit('update:modelValue', {
          x: value,
          y: this.modelValue.y,
        })
        this.$emit('changed')
      },
    },
    computedY: {
      get() {
        return this.modelValue.y
      },
      set(value) {
        this.$emit('update:modelValue', {
          x: this.modelValue.x,
          y: value,
        })
        this.$emit('changed')
      },
    },
  },
}
</script>

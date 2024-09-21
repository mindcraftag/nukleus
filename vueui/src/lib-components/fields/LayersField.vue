<template>
  <div class="fieldValueContainer">
    <SmallSelect
      v-model="computedValue"
      :items="computedItems"
      multiple
      :readonly="!allowEdit"
    ></SmallSelect>
  </div>
</template>
<script>

import SmallSelect from '../wrappers/SmallSelect.vue'
import { isNumber } from 'lodash'

const MAX_LAYERS = 32

export default {

  name: "LayersField",

  components: {
    SmallSelect
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Array,
      required: true,
    },
    allowEdit: {
      type: Boolean,
      required: true,
      default: false,
    },
    layerTitles: {
      type: Array,
      default: null
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
    computedItems: {
      get() {
        const list = []
        for (let i = 0; i < MAX_LAYERS; i++) {
          list.push({
            value: i,
            title: (this.layerTitles ? this.layerTitles[i] : `Layer ${i}`) || "",
          })
        }
        return list
      },
    },

    computedValue: {
      get() {
        let value = this.modelValue
        if (!Array.isArray(value)) {
          value = [0]
          this.$emit('update:modelValue', value)
          this.$emit('changed')
        }
        value = this.verifyValue(value)
        return value
      },
      set(value) {
        this.$emit('update:modelValue', value)
        this.$emit('changed')
      },
    },
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    verifyValue(layers) {
      // detect old format
      if (layers.length > 0 && (layers[0] === true || layers[0] === false)) {
        let newLayers = []
        for (const [i, v] of layers.entries()) {
          if (v) newLayers.push(i)
        }
        layers = newLayers
      }

      const map = new Map()
      for (const entry of layers) {
        if (isNumber(entry)) map.set(entry, true)
      }
      return Array.from(map.keys())
    },
  },
}
</script>

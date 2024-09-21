<template>
  <div>
    <div class="d-flex">
      <div class="colorIndicator" :style="hexColor" @click="togglePicker">
        <font-awesome-icon
            v-if="allowEdit"
            :icon="pickerVisible ? ['fal', 'chevron-up'] : ['fal', 'chevron-down']"
        />
      </div>
      <div class="colorLabel">{{ labels[0] }}:</div>
      <IntegerField
        v-model="computedR"
        :allow-edit="allowEdit"
        :allow-reset="false"
        :min-value="0"
        :max-value="255"
        style="width: 60px"
      />

      <div class="colorLabel">{{ labels[1] }}:</div>
      <IntegerField
        v-model="computedG"
        :allow-edit="allowEdit"
        :allow-reset="false"
        :min-value="0"
        :max-value="255"
        style="width: 60px"
      />

      <div class="colorLabel">{{ labels[2] }}:</div>
      <IntegerField
        v-model="computedB"
        :allow-edit="allowEdit"
        :allow-reset="false"
        :min-value="0"
        :max-value="255"
        style="width: 60px"
      />

      <div class="colorLabel">{{ labels[3] }}:</div>
      <IntegerField
        v-model="computedA"
        :allow-edit="allowEdit"
        :allow-reset="false"
        :min-value="0"
        :max-value="255"
        style="width: 60px"
      />
    </div>
    <v-expand-transition>
      <div v-if="pickerVisible && allowEdit" class="d-flex">
        <v-color-picker
          :model-value="pickerValue"
          hide-inputs
          elevation="0"
          canvas-height="100"
          density="compact"
          class="ma-2"
          @update:model-value="setColorFromPicker"
        />
      </div>
    </v-expand-transition>
  </div>
</template>
<style>

.colorIndicator {
  height: 22px;
  min-width: 22px;
  margin-top: 3px;
  margin-right: 4px;
  border-radius: 4px;
  text-align: center;
}

.colorLabel {
  height: 32px;
  padding-top: 6px;
  padding-right: 4px;
}

</style>
<script>
import IntegerField from './IntegerField.vue'
import uitools from '../../js-modules/uitools'

export default {

  name: "ColorField",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    IntegerField,
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
        return ['R', 'G', 'B', 'A']
      },
    },
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    pickerVisible: true,
  }),

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    value: {
      get() {
        let value = this.modelValue;
        if (typeof value !== 'object') {
          value = {};
        }

        value.r = value.r || 0;
        value.g = value.g || 0;
        value.b = value.b || 0;

        return value;
      }
    },
    hexColor: {
      get() {
        const bg = uitools.rgbToHexColor(this.value.r, this.value.g, this.value.b)
        const fg =
          uitools.rgbToGrey(this.value.r, this.value.g, this.value.b) > 128
            ? 'black'
            : 'white'
        return `background-color: ${bg}; color: ${fg}`
      },
    },
    pickerValue: {
      get() {
        return {
          r: this.value.r,
          g: this.value.g,
          b: this.value.b,
          a: this.value.a / 255,
        }
      },
    },
    computedR: {
      get() {
        return this.value.r
      },
      set(value) {
        this.setColor({
          r: value,
          g: this.value.g,
          b: this.value.b,
          a: this.value.a,
        })
      },
    },
    computedG: {
      get() {
        return this.value.g
      },
      set(value) {
        this.setColor({
          r: this.value.r,
          g: value,
          b: this.value.b,
          a: this.value.a,
        })
      },
    },
    computedB: {
      get() {
        return this.value.b
      },
      set(value) {
        this.setColor({
          r: this.value.r,
          g: this.value.g,
          b: value,
          a: this.value.a,
        })
      },
    },
    computedA: {
      get() {
        return this.value.a
      },
      set(value) {
        this.setColor({
          r: this.value.r,
          g: this.value.g,
          b: this.value.b,
          a: value,
        })
      },
    },
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    togglePicker() {
      this.pickerVisible = !this.pickerVisible
    },
    setColorFromPicker(value) {
      this.setColor({
        r: value.r,
        g: value.g,
        b: value.b,
        a: parseInt(value.a * 255),
      })
    },
    setColor(value) {
      if (
        value.r !== this.value.r ||
        value.g !== this.value.g ||
        value.b !== this.value.b ||
        value.a !== this.value.a
      ) {
        this.$emit('update:modelValue', value)
        this.$emit('changed')
      }
    },
  },
}
</script>

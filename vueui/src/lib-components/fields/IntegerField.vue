<template>
  <div class="fieldValueContainer">
    <v-text-field
      v-if="allowEdit"
      :model-value="computedValue"
      @update:model-value="onEditValue"
      class="intField"
      density="compact"
      variant="underlined"
      type="number"
      single-line
      @change="onChangedEvent"
      @mousedown="onMouseDown"
      @wheel="onMouseWheel"
      @mouseover="onMouseOver"
      @mouseout="onMouseOut"
    >
    </v-text-field>

    <v-text-field
      v-else
      :model-value="computedValue"
      class="intField"
      density="compact"
      variant="underlined"
      single-line
      :readonly="true"
    />

    <div
        v-if="widget === 'Slider'"
        class="intFieldIndicator"
        :style="indicatorStyle"
    ></div>

  </div>
</template>
<style>

.intFieldIndicator {
  height: 3px;
  left: 0;
  top: 0;
}

.intField input {
  height: 24px;
  font-size: 12px;
  padding-left: 8px !important;
  padding-right: 8px !important;
  padding-top: 0 !important;
}

.intField .v-input__append {
  padding: 0 !important;
}

</style>
<script>
export default {

  name: "IntegerField",

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: [Number, String],
      required: true,
      default: 0,
    },
    allowEdit: {
      type: Boolean,
      required: true,
      default: false,
    },
    widget: {
      type: String,
    },
    step: {
      type: Number,
      default: 1,
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
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    dragging: false,
    hovering: false,
    editingValue: null
  }),

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    computedValue: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
        this.$emit('changed')
      },
    },
    indicatorStyle() {
      if (this.widget === 'Slider') {
        const color = this.hovering || this.dragging ? 'ffffff' : '0060b0'
        const range = this.maxValue - this.minValue
        const percent = Math.floor(
          ((this.computedValue - this.minValue) / range) * 100
        )
        return `background-color: #${color}; width: ${percent}%`
      }

      return ''
    },
  },

  // ---------------------------------------------------------
  //  CREATED
  // ---------------------------------------------------------
  created() {
    const _this = this

    window.addEventListener('mouseup', function () {
      _this.onMouseUp()
    })

    window.addEventListener('mousemove', function (ev) {
      _this.onMouseMove(ev)
    })
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    onEditValue(val) {
      this.editingValue = val;
    },

    onChangedEvent() {
      this.onChanged(this.editingValue);
    },

    onChanged(val) {
      let newVal = parseInt(val)

      if (isNaN(newVal))
        newVal = 0

      if (this.minValue !== Number.MIN_VALUE && newVal < this.minValue)
        newVal = this.minValue

      if (this.maxValue !== Number.MAX_VALUE && newVal > this.maxValue)
        newVal = this.maxValue

      if (this.computedValue !== newVal) {
        newVal = Math.round(newVal)
        this.computedValue = newVal
      }
    },

    onMouseDown(ev) {
      if (!this.dragging && ev.button === 2) {
        this.dragging = true
      }
    },

    onMouseUp() {
      if (this.dragging) {
        this.dragging = false
      }
    },

    onMouseOver() {
      this.hovering = true
    },

    onMouseOut() {
      this.hovering = false
    },

    onMouseMove(ev) {
      if (this.dragging) {
        const delta = ev.movementX
        this.increaseValue(delta)
      }
    },

    onMouseWheel(ev) {
      if (ev.altKey) {
        ev.stopPropagation()
        ev.preventDefault()
        const delta = ev.wheelDelta / 120
        this.increaseValue(delta)
      }
    },

    increaseValue(amount) {
      let val = this.computedValue
      val += this.step * amount
      this.onChanged(val)
    },
  },
}
</script>

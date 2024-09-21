<template>
  <div class="fieldValueContainer">
    <div v-for="(entry, index) in computedValue" :key="index" class="boolList">
      <SmallCheckbox
        v-model="computedValue[index]"
        :read-only="!allowEdit"
        @update:model-value="valueChanged"
      />
    </div>
  </div>
</template>
<style>
.boolList {
  float: left;
}

.v-application--is-ltr .v-input--selection-controls__input {
  margin-right: 2px !important;
}
</style>
<script>
import SmallCheckbox from "../wrappers/SmallCheckbox.vue";

export default {

  name: "BooleanListField",

  components: {SmallCheckbox},

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Array,
      required: true,
    },
    length: {
      type: Number,
      required: true,
    },
    allowEdit: {
      type: Boolean,
      required: true,
      default: false,
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
        if (!Array.isArray(this.modelValue)) {
          let newArray = []
          newArray.length = this.length
          this.$emit('update:modelValue', newArray)
          this.$emit('changed')
          return newArray
        }

        if (this.modelValue.length !== this.length) {
          let newArray = this.modelValue
          newArray.length = this.length
          this.$emit('update:modelValue', newArray)
          this.$emit('changed')
          return newArray
        }

        return this.modelValue
      },
    },
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    valueChanged() {
      // We need to produce a new array
      // otherwise the proxy will not detect it as a change
      const newValue = []
      for (const v of this.modelValue) {
        newValue.push(v)
      }

      this.$emit('update:modelValue', newValue)
      this.$emit('changed')
    },
  },
}
</script>

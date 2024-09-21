<template>
  <div class="d-flex">
    <v-col xs6>
      <div class="fieldValueContainer">
        <SmallSelect
          v-model="fontSelected"
          :items="availableFonts"
          :readonly="!allowEdit"
        />
      </div>
    </v-col>
    <v-col xs6>
      <div class="fieldValueContainer">
        <SmallSelect
          v-model="weightSelected"
          :items="availableWeights"
          :readonly="!allowEdit"
        />
      </div>
    </v-col>
  </div>
</template>
<style></style>
<script>
import SmallSelect from "../wrappers/SmallSelect.vue";

export default {

  name: "TextFontField",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    SmallSelect
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Object,
      required: true,
      default() {
        return { Font: 'Arial', Weight: 'normal' }
      },
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
  //  DATA
  // ---------------------------------------------------------
  data() {
    return {
      mapFontsWeights: [
        { FontName: 'Arial', FontWeights: ['normal', 'bold'] },
        { FontName: 'Serif', FontWeights: ['normal', 'bold'] },
        { FontName: 'Sans-Serif', FontWeights: ['normal', 'bold'] },
        { FontName: 'Lato', FontWeights: ['lighter', 'normal', 'bold'] },
      ],
    }
  },

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    availableFonts: {
      get() {
        return this.mapFontsWeights.map((el) => {
          return el.FontName
        })
      },
    },
    availableWeights: {
      get() {
        return this.getAvailableWeights(this.fontSelected)
      },
    },
    fontSelected: {
      get() {
        return this.modelValue.Font
      },
      set(newFont) {
        if (!this.getAvailableWeights(newFont).includes(this.weightSelected)) {
          let event = { Font: newFont, Weight: 'normal' }
          this.emitEvent(event)
        } else {
          let event = { Font: newFont, Weight: this.weightSelected }
          this.emitEvent(event)
        }
      },
    },
    weightSelected: {
      get() {
        return this.modelValue.Weight
      },
      set(newWeight) {
        let event = { Font: this.fontSelected, Weight: newWeight }
        this.emitEvent(event)
      },
    },
  },

  // ---------------------------------------------------------
  //  MOUNTED
  // ---------------------------------------------------------
  mounted: function () {
    let event = { Font: this.fontSelected, Weight: this.weightSelected }
    this.emitEvent(event)
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    emitEvent: function (event) {
      this.$emit('update:modelValue', event)
      this.$emit('changed')
    },
    getAvailableWeights: function (font) {
      let weights = this.mapFontsWeights.find((el) => {
        return el.FontName == font
      }).FontWeights
      return weights
    },
  },
}
</script>

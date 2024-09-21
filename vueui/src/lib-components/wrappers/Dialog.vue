<template>
  <v-dialog v-model="show" :persistent="persistent" class="n-dialog">
    <v-card class="mx-auto" :max-width="maxWidth" :width="width">

      <v-card-text>
        <p class="text-h4 text--primary">
          {{ title }}
        </p>
      </v-card-text>

      <v-container fluid grid-list-lg>
        <v-row wrap>
          <v-col xs12 style="max-height: 80vh; overflow: auto;">
            <slot></slot>
          </v-col>
        </v-row>
      </v-container>

      <v-divider></v-divider>

      <v-card-actions>
        <slot name="actions"></slot>
      </v-card-actions>

    </v-card>
  </v-dialog>
</template>
<script>

export default {

  // --------------------------------------------------------
  // PROPS
  // --------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean
    },
    title: {
      type: String
    },
    width: {
      type: String,
      default: '500px'
    },
    maxWidth: {
      type: String
    },
    persistent: {
      type: Boolean,
      default: true
    }
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue'],

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    show: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      },
    }
  }

}

</script>

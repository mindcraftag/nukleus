<template>
  <v-card :class="cssClasses" width="100%">
    <v-card-title v-if="title">{{ title }}</v-card-title>
    <v-divider v-if="divider"></v-divider>
    <v-card-text>
      <slot></slot>
    </v-card-text>
    <v-card-actions>
      <slot name="actions"></slot>
    </v-card-actions>
  </v-card>
</template>
<script>
export default {
  props: {
    title: {
      type: String,
    },
    divider: {
      type: Boolean,
      default: true,
    },
  },

  computed: {
    cssClasses: {
      get() {
        if (this.$store.state.darkMode) {
          return 'slimForm slimFormDark'
        } else {
          return 'slimForm slimFormLight'
        }
      },
    },
  },
}
</script>

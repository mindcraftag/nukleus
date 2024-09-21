<template>
  <div style="font-family: monospace">
    <span v-if="viewToken">
      {{ modelValue }}
    </span>
    <span v-else style="color: #808080">
      {{ hiddenString }}
    </span>
    <v-btn icon @click="viewToken = !viewToken"><v-icon>mdi-eye</v-icon></v-btn>
    <v-btn icon @click="copy"><v-icon>mdi-content-copy</v-icon></v-btn>
  </div>
</template>
<script>
export default {

  props: {
    modelValue: String,
    required: true
  },

  data: () => ({
    viewToken: false,
  }),

  computed: {
    hiddenString() {
      let result = "";
      for (let i = 0; i < this.modelValue.length; i++) {
        result += "*";
      }
      return result;
    },
  },

  methods: {
    async copy() {
      try {
        await navigator.clipboard.writeText(this.modelValue);
        this.$store.commit("setMessage", "Token has been copied to clipboard");
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

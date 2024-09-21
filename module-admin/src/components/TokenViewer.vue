<template>
  <div style="font-family: monospace;">
    <span v-if="viewToken">
      {{ value }}
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
    value: String
  },

  computed: {
    hiddenString() {
      let result = "";
      for (let i=0; i<this.value.length; i++) {
        result += "*";
      }
      return result;
    }
  },

  data: () => ({
    viewToken: false
  }),

  methods: {
    async copy() {
      try {
        await navigator.clipboard.writeText(this.value);
        this.$store.commit("setMessage", "Token has been copied to clipboard");
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    }
  }

}

</script>

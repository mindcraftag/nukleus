<template>
  <v-dialog v-model="show" max-width="500px">
    <v-card>
      <v-card-title>Create Plan</v-card-title>
      <v-container fluid grid-list-lg>
        <v-layout row wrap>
          <v-flex xs12>

            <v-text-field
              v-model="name"
              label="Name"
              required
              @keydown="keydown"
            ></v-text-field>

            <v-btn color="primary" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn @click="close">
              <v-icon>mdi-close</v-icon>
              close
            </v-btn>

          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script>


export default {

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    value: Boolean
  },

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    show: {
      get () {
        return this.value
      },
      set (value) {
        this.$emit('input', value)
      }
    }
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    name: ''
  }),

  // --------------------------------------------------------
  // WATCHES
  // --------------------------------------------------------
  watch: {
    value: function(to, from) {
      if (to === true) {
        this.name = "";
      }
    }
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    keydown(event) {
      if (event.key === "Enter") {
        this.submit();
      }
    },
    async submit () {
      try {
        const id = await this.$store.state.nkclient.createPlan({
          name: this.name
        });

        this.close();
        this.$emit('created-plan');
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    close () {
      this.show = false;
      this.$emit('closed');
    }
  }
}
</script>

<style>

</style>

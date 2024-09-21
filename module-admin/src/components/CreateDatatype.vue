<template>
  <v-dialog v-model="show" max-width="500px">
    <v-card data-test="createDatatypeDialog">
      <v-card-title>Create Datatype</v-card-title>
      <v-container fluid grid-list-lg>
        <v-layout row wrap>
          <v-flex xs12>

            <v-text-field
              data-test="nameTextField"
              v-model="name"
              label="Name"
              required
              @keydown="keydown"
            ></v-text-field>

            <v-btn data-test="submitCreateDatatype" color="primary" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn data-test="cancelCreateDatatype" @click="close">
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
      value: Boolean,
      parentFolderId: String
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
          await this.$store.state.nkclient.createDatatype({
            name: this.name
          });

          this.close();
          this.$emit('created-datatype');
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

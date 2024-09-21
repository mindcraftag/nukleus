<template>
  <v-dialog v-model="show" max-width="500px">
    <v-card>
      <v-card-title>Create Token</v-card-title>
      <v-container fluid grid-list-lg>
        <v-layout row wrap>
          <v-flex xs12>

            <v-text-field
              v-model="name"
              label="Name"
              required
              @keydown="keydown"
            ></v-text-field>
            <v-checkbox v-model="allowSystemwide"
                        label="Allow systemwide access">
            </v-checkbox>
            <v-select
              v-model="clientId"
              :items="clients"
              label="Client"
              item-value="_id"
              item-text="name"
              v-show="!allowSystemwide"
            />

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
    value: {
      type: Boolean,
      required: true
    },
    clients: {
      type: Array,
      required: true
    }
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
    name: '',
    clientId: null,
    allowSystemwide: true
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
      if (event.key === "Enter") {null
        this.submit();
      }
    },
    async submit () {
      try {
        if (!this.allowSystemwide && !this.clientId) {
          this.$store.commit("setError", "Choose a client");
          return;
        }

        await this.$store.state.nkclient.createAccessToken({
          name: this.name,
          client: this.allowSystemwide ? undefined : this.clientId
        });

        this.close();
        this.$emit('created-token');
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

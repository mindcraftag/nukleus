<template>
  <div>
    <h1 class="pageTitle" data-test="datatypesTitle">Datatypes</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <DatatypesList :datatypes="datatypes" @reload="updateDatatypes"></DatatypesList>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>
      </v-layout>

    </v-container>
  </div>
</template>

<script>

  import DatatypesList from '../components/DatatypesList.vue'

  export default {

    // --------------------------------------------------------
    // COMPONENTS
    // --------------------------------------------------------
    components: {
      DatatypesList
    },

    // --------------------------------------------------------
    // DATA
    // --------------------------------------------------------
    data() {
      return {
        datatypes: []
      }
    },

    // --------------------------------------------------------
    // METHODS
    // --------------------------------------------------------
    methods: {
      async updateDatatypes() {
        try {
          this.datatypes = await this.$store.state.nkclient.getAllDatatypesList();
        } catch (err) {
          console.error(err);
          this.$store.commit("setError", err.toString());
        }
      }
    },

    created() {
      this.updateDatatypes();
    }
  }
</script>

<style>

</style>

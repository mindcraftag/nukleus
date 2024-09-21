<template>
  <div>
    <h1 class="pageTitle" data-test="plansTitle">Plans</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <PlansList :plans="plans" @reload="updatePlans"></PlansList>

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

import PlansList from '../components/PlansList.vue'


export default {

  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    PlansList
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      plans: []
    }
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async updatePlans() {
      try {
        this.plans = await this.$store.state.nkclient.getPlans();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },

  created() {
    this.updatePlans();
  }
}
</script>

<style>

</style>

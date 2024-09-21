<template>
  <v-container fluid grid-list-xl>
    <v-row wrap>
      <v-col d-flex lg12 sm12 xs12>
        <v-card width="100%">
          <v-container fluid grid-list-lg>
            <v-row wrap>
              <v-col xs12>
                <JobsList :jobs="jobs"></JobsList>
              </v-col>
            </v-row>
          </v-container>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import JobsList from "../components/JobsList.vue";

export default {
  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    JobsList,
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      jobs: [],
    };
  },

  created() {
    this.updateJobs();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async updateJobs() {
      try {
        let jobs = await this.$store.state.nkclient.getJobsAggregated();
        this.jobs = jobs.reverse();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

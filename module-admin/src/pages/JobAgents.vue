<template>
  <div>
    <h1 class="pageTitle" data-test="jobAgentsTitle">Job agents</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-progress-linear indeterminate v-if="!agents"></v-progress-linear>
                  <JobAgentsList v-else :agents="agents" :tokens="tokens" :graph-start-time="graphStartTime" :graph-end-time="graphEndTime"></JobAgentsList>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>
      </v-layout>

    </v-container>

    <h1 class="pageTitle" data-test="jobAgentsTitle">Access Tokens</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <AccessTokenList :tokens="tokens" :clients="clients" @reload="updateTokens"></AccessTokenList>

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

  import JobAgentsList from '../components/JobAgentsList.vue'
  import AccessTokenList from "../components/AccessTokenList";
  import moment from "moment";

  export default {

    // --------------------------------------------------------
    // COMPONENTS
    // --------------------------------------------------------
    components: {
      AccessTokenList,
      JobAgentsList
    },

    // --------------------------------------------------------
    // DATA
    // --------------------------------------------------------
    data() {
      return {
        agents: null,
        tokens: [],
        clients: [],
        interval: null,
        graphStartTime: moment().add(-1, 'hour').utc(),
        graphEndTime: moment().utc()
      }
    },

    // --------------------------------------------------------
    // METHODS
    // --------------------------------------------------------
    methods: {
      async updateClients() {
        try {
          this.clients = await this.$store.state.nkclient.getClientsList();
        } catch (err) {
          console.error(err);
          this.$store.commit("setError", err.toString());
        }
      },
      resolveJobAgent(agents, remoteHost) {
        for (const agent of agents) {
          if (agent.remoteHost === remoteHost)
            return agent;
        }
        return null;
      },
      async updateAgents() {
        try {
          this.graphStartTime = moment().add(-1, 'hour').utc();
          this.graphEndTime = moment().utc();

          const agents = await this.$store.state.nkclient.getAgentsAggregated();

          agents.sort(function(a, b) {
            const stringA = a.name || a.type;
            const stringB = b.name || b.type;
            return stringA.localeCompare(stringB);
          });

          const jobs = await this.$store.state.nkclient.getJobsTimeframe(this.graphStartTime.format("YYYYMMDDHHmmss"), this.graphEndTime.format("YYYYMMDDHHmmss"));

          jobs.sort(function(a, b) {
            return a.type.localeCompare(b.type);
          });

          const agentsMap = new Map();
          for (const agent of agents) {
            if (!agent.jobs) {
              agent.jobs = [];
              agent.jobsByType = new Map();
            }

            agentsMap.set(agent._id, agent);
          }

          for (const job of jobs) {
            const agent = this.resolveJobAgent(agents, job.jobAgent);
            if (!agent)
              continue;

            let jobsList;
            if (agent.jobsByType.has(job.type)) {
              jobsList = agent.jobsByType.get(job.type);
            } else {
              jobsList = [];
              agent.jobsByType.set(job.type, jobsList);
            }

            agent.jobs.push(job);
            jobsList.push(job);
          }

          this.agents = agents;

        } catch (err) {
          console.error(err);
          this.$store.commit("setError", err.toString());
        }
      },
      async updateTokens() {
        try {
          const tokens = await this.$store.state.nkclient.getAccessTokens();

          for (let token of tokens) {
            let usedCount = 0;

            for (const agent of this.agents) {
              if (agent.usedToken === token._id)
                usedCount++;
            }

            token.usedCount = usedCount;
          }

          this.tokens = tokens;
        } catch (err) {
          console.error(err);
          this.$store.commit("setError", err.toString());
        }
      }
    },

    beforeDestroy() {
      clearInterval(this.interval);
    },

    async mounted() {
      const _this = this;

      await Promise.all([
        this.updateClients(),
        this.updateAgents()
      ])

      await this.updateTokens();

      this.interval = setInterval(function() {
        _this.updateAgents();
      }, 1000 * 10);
    }
  }
</script>

<style>

</style>

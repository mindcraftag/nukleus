<template>
  <div>
    <h1 class="pageTitle">Job Schedulers</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>
          <v-card width="100%">
            <div v-if="nodes.length === expectedReplicas" class="ma-6 mt-4 mb-2 replicaCheck replicaCheck--good">
              <span>Found all Nodes from deployment</span>
              <font-awesome-icon :icon="['fal', 'check']" size="lg" />
            </div>

            <div v-else class="ma-6 mt-4 mb-2 replicaCheck replicaCheck--error">
              <span>Didn't find all Nodes from deployment: found {{ nodes.length }} / {{ expectedReplicas }}.</span>
            </div>

            <v-row no-gutters class="mx-2">
              <!-- Every node is a separate column so Vuetify can do an efficient layout regardless of screen size. -->
              <v-col class="pa-4 ma-2 node" v-for="node of nodes">
                <span v-if="node.leader" class="text-h7 typeTag leader">Leader</span>
                <span v-else class="text-h7 typeTag follower">Follower</span>

                <span class="text-h4">{{ node.name }}</span>
                <span class="text-h7">Connection: {{ node.connectionID }}</span>
                <span class="text-h5">{{ node.ip }}</span>

                <span v-if="node.connectedJobAgents.length > 0" class="text-h5 mt-4">Job Agents</span>
                <div class="jobAgentList">
                  <div v-for="agent of node.connectedJobAgents" class="jobAgent">
                    <span class="jobAgent--name">{{ agent.name }}</span>
                    <span>ID: {{ agent.agentId }}</span>
                    <span>{{ agent.remoteHost }}</span>
                  </div>
                </div>

              </v-col>
            </v-row>
          </v-card>
        </v-flex>
      </v-layout>
    </v-container>

    <h1 class="pageTitle">Interval Job Types</h1>
    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>
          <v-card width="100%">

            <v-row no-gutters class="mx-2">
              <v-col class="pa-4 ma-2 jobType" v-for="jobType of intervalJobTypes">
                <span class="jobType--name">{{ jobType.name }}</span>
                <span class="jobType--interval">{{ jobType.interval }}</span>
                <span class="jobType--follower" v-for="follower of jobType.followers">{{ follower }}</span>
              </v-col>
            </v-row>
          </v-card>
        </v-flex>
      </v-layout>
    </v-container>
  </div>
</template>

<script>
// import { api } from '@mindcraftgmbh/nukleus-vueui'

export default {
  data: () => ({
    nodes: [],
    expectedReplicas: 0,
    intervalJobTypes: []
  }),
  methods: {
    async getData() {
      const jobsUrl = "CONFIGURATION_VALUE_JOBS_URL";
      const res = await fetch(jobsUrl + "/api/debug", {
        headers: {
          "x-access-token": this.$store.state.token
        }
      });
      const data = (await res.json()).data;

      this.nodes = [];
      this.intervalJobTypes = [];
      this.expectedReplicas = data.replicas;
      for (const [connectionID, followerData] of Object.entries(data.followers)) {
        this.nodes.push({
          ...followerData,
          connectionID: connectionID,
          connectedJobAgents: followerData.connectedJobAgents
        });
      }

      this.intervalJobTypes = data.jobs;
    }
  },
  async mounted() {
    this.getData();
    setInterval(this.getData, 5000);
  }
}

</script>

<style scoped>
.replicaCheck {
  display: flex;
  align-items: center;
  font-size: 1.4rem;
}

.replicaCheck > *:nth-child(2) {
  margin-left: 0.4rem;
}

.replicaCheck--good {
  color: rgb(4, 196, 4);
}

.replicaCheck--error {
  color: red;
}

.node {
  border: 2px solid rgba(218, 218, 218, 0.39);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.jobAgentList {
  display: flex;
  flex-direction: column;
}

.jobAgent {
  display: flex;
  flex-direction: column;
  margin: 6px 0;
}

.jobAgent--name {
  font-style: italic;
}

.typeTag {
  align-self: flex-start;
  border-radius: 4px;
  padding: 3px 6px;
  margin-bottom: 4px;
}

.follower {
  color: gray;
}

.leader {
  background-color: rgb(10, 90, 240);
  color: white;
  font-weight: bold;
}

.jobType {
  display: flex;
  flex-direction: column;
  font-size: 1rem;
  background-color: #b5c0d123;
  border-radius: 0.6rem;
}

.jobType--name {
  font-size: 1.5rem;
}

.jobType--interval {
  font-size: 1.1rem;
  font-weight: bold;
  font-family: monospace;
  margin-bottom: 4px;
}

.jobType--follower {
  font-size: 0.9rem;
}
</style>

<template>
  <div>
    <v-checkbox v-model="displayOnlyConnected" label="Display only connected"></v-checkbox>

    <JobAgentPanel v-for="(agent, index) in agentsFiltered"
                   v-model="agentsFiltered[index]"
                   :tokens="tokens"
                   :graph-start-time="graphStartTime"
                   :graph-end-time="graphEndTime"
                   :key="agent._id" />


  </div>
</template>
<style>

  .agentExpandPanel h3 {
    margin-top: 16px;
    margin-bottom: 8px;
  }

  .agentJobTypesTable {
    background: transparent !important;
  }

  .agentJobTypesTable td {
    height: 20px !important;
  }

  .agentJobTypesTable th {
    height: 20px !important;
  }

</style>
<script>

  import moment from 'moment'
  import JobAgentPanel from './JobAgentPanel'

  export default {

    components: {
      JobAgentPanel
    },

    // ------------------------------------------------------------
    // PROPERTIES
    // ------------------------------------------------------------
    props: {
      agents: {
        type: Array,
        required: true
      },
      tokens: {
        type: Array,
        required: true
      },
      graphStartTime: {
        type: Object
      },
      graphEndTime: {
        type: Object
      }
    },

    // ------------------------------------------------------------
    // DATA
    // ------------------------------------------------------------
    data: () => ({
      switchValue: true,
      displayOnlyConnected: true,
      headers: [
        {
          text: 'Remote host',
          value: 'remoteHost',
          sortable: true
        },
        {
          text: 'Type',
          value: 'type',
          sortable: true
        },
        {
          text: 'Token',
          value: 'token',
          sortable: true
        },
        {
          text: 'Version',
          value: 'version',
          sortable: true
        },
        {
          text: 'Connection count',
          value: 'connectCount',
          sortable: true
        },
        {
          text: 'Jobs total/successful/failed',
          value: 'jobCounts',
          sortable: true
        },
        {
          text: 'Last alive at',
          value: 'lastAlive',
          sortable: true
        },
        {
          text: 'Actions',
          value: 'actions',
          sortable: false
        }
      ]
    }),

    // --------------------------------------------------------
    // COMPUTED
    // --------------------------------------------------------
    computed: {
      agentsFiltered: {
        get() {
          const _this = this;
          return this.agents.filter(function(value) {
            if ((!value.connectedAt || value.disconnectedAt) && _this.displayOnlyConnected)
              return false;

            return true;
          })
        }
      }
    },

    // --------------------------------------------------------
    // FILTERS
    // --------------------------------------------------------
    filters: {
      formatDate: function (value) {
        if (!value)
          return "<no date>";

        return moment(value).format('YYYY-MM-DD HH:mm:ss');
      },
      formatState: function(value) {
        switch(value) {
          case 0: return "Pending";
          case 1: return "Running";
          case 2: return "Failed";
          case 3: return "Succeeded";
          default: return "Unknown state";
        }
      },
      stateIcon: function(value) {
        if (value.connectedAt && !value.disconnectedAt) {
          return "mdi-check";
        } else {
          return "mdi-alert-circle";
        }
      },
      stateColor: function(value) {
        if (value.connectedAt && !value.disconnectedAt) {
          return "color: green";
        } else {
          return "color: red";
        }
      },
      formatParameters: function(value) {
        return JSON.stringify(value);
      },
      joinArray: function(value) {
        if (!Array.isArray(value))
          return value;

        return value.join(', ');
      },
      agentLocation: function(value) {
        if (value.location) {
          if (value.location.region)
            return `(${value.location.country} / ${value.location.region})`;
          else
            return `(${value.location.country})`;
        }

        return "";
      }
    },

    // --------------------------------------------------------
    // METHODS
    // --------------------------------------------------------
    methods: {
      resolveToken(value) {
        if (!value)
          return "";

        for (const token of this.tokens) {
          if (value === token._id)
            return token.name;
        }
        return `unknown(${value})`;
      },
      async setAgentDisabled(item, value) {
        try {
          item.disabled = value;

          if (value) {
            await this.$store.state.nkclient.disableJobAgent(item._id);
            this.$store.commit("setMessage", "Agent was disabled");
          } else {
            await this.$store.state.nkclient.enableJobAgent(item._id);
            this.$store.commit("setMessage", "Agent was enabled");
          }
        }
        catch(err) {
          console.error(err);
          this.$store.commit("setError", err.toString());
        }
      }
    }
  }
</script>

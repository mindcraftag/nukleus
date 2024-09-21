<template>

  <v-card :style="cardStyle">

    <v-card-title style="padding: 4px; width: 100%; font-size: 20px;">
      {{ value.name || value.type }}
      <v-card-subtitle style="padding: 4px; margin-right: 0; margin-left: auto">
        <span class="jap-bold">Type:</span> {{ value.type }}
        -
        <span class="jap-bold">Host:</span> {{ value.remoteHost }}
        -
        <span class="jap-bold">Location:</span> {{location}}
        -
        <span class="jap-bold">Last alive:</span> {{value.lastAlive | formatDate}}
      </v-card-subtitle>
    </v-card-title>

    <v-card-text :style="innerCardStyle">

      <v-container fluid grid-list-xl>
        <v-layout row wrap>
          <v-flex d-flex lg1 md2 sm6 xs12 style="padding: 8px; padding-top: 0">
            <div style="width: 100%">
              <div class="jap-label">CPU</div>
              <div class="jap-value">{{cpuLoad}}</div>
              <div class="jap-progress"><v-progress-linear color="green" :value="cpuPercentage" /></div>
            </div>
          </v-flex>
          <v-flex d-flex lg2 md3 sm6 xs12 style="padding: 8px; padding-top: 0">
            <div style="width: 100%">
              <div class="jap-label">RAM</div>
              <div class="jap-value">{{ramUsage | formatBytes}} / {{ramTotal | formatBytes}}</div>
              <div class="jap-progress"><v-progress-linear color="blue" :value="ramPercentage" /></div>
            </div>
          </v-flex>
          <v-flex d-flex lg2 md3 sm6 xs12 style="padding: 8px; padding-top: 0">
            <div style="width: 100%">
              <div class="jap-label">DISK</div>
              <div class="jap-value">{{diskUsage | formatBytes}} / {{diskTotal | formatBytes}}</div>
              <div class="jap-progress"><v-progress-linear color="purple" :value="diskPercentage" /></div>
            </div>
          </v-flex>
          <v-flex d-flex lg1 md2 sm3 xs12 style="padding: 8px; padding-top: 0">
            <div style="width: 100%">
              <div class="jap-label">VERSION</div>
              <div class="jap-value">{{ value.version }}</div>
            </div>
          </v-flex>
          <v-flex d-flex lg1 md2 sm3 xs12 style="padding: 8px; padding-top: 0">
            <div style="width: 100%">
              <div class="jap-label">RECONNECTS</div>
              <div class="jap-value">{{ value.reconnects }}</div>
            </div>
          </v-flex>
          <v-flex d-flex lg4 md9 sm7 xs8 style="padding: 8px; padding-top: 0">
            <div style="width: 100%">
              <JobExecutionGraph v-if="value.jobs" :jobs="value.jobs" :start-time="graphStartTime" :end-time="graphEndTime" />
            </div>
          </v-flex>
          <v-flex d-flex lg1 md2 sm3 xs4 style="padding: 0">
            <div style="width: 100%; text-align: right">

              <v-tooltip bottom color="primary">
                <template v-slot:activator="{ on }">
                  <v-btn icon small @click="restartAgent" v-on="on">
                    <font-awesome-icon :icon="['fal', 'redo']" />
                  </v-btn>
                </template>
                <span>Trigger agent restart</span>
              </v-tooltip>

              <v-tooltip bottom color="primary" v-if="value.disabled">
                <template v-slot:activator="{ on }">
                  <v-btn color="green" v-on="on" icon small @click="setAgentDisabled(false)">
                    <font-awesome-icon :icon="['fal', 'play']" />
                  </v-btn>
                </template>
                <span>Start agent again</span>
              </v-tooltip>
              <v-tooltip bottom color="primary" v-if="!value.disabled">
                <template v-slot:activator="{ on }">
                  <v-btn color="red" v-on="on" icon small @click="setAgentDisabled(true)">
                    <font-awesome-icon :icon="['fal', 'pause']" />
                  </v-btn>
                </template>
                <span>Pause agent</span>
              </v-tooltip>

              <v-tooltip bottom color="primary">
                <template v-slot:activator="{ on }">
                  <v-btn v-on="on" icon small @click="toggled = !toggled">
                    <font-awesome-icon :icon="['fal', 'caret-down']" v-if="!toggled" />
                    <font-awesome-icon :icon="['fal', 'caret-up']" v-else />
                  </v-btn>
                </template>
                <span>Toggle more information</span>
              </v-tooltip>

            </div>
          </v-flex>
        </v-layout>
      </v-container>

      <div v-if="toggled">

        <table style="width: 100%">
          <tr v-for="type in value.jobsByType.keys()">
            <td style="width: 200px">
              {{ type }}
            </td>
            <td>
              <JobExecutionGraph v-if="value.jobsByType" :jobs="value.jobsByType.get(type)" :start-time="graphStartTime" :end-time="graphEndTime"></JobExecutionGraph>
            </td>
          </tr>
        </table>

        <div style="padding: 8px">
          <h3>Fields:</h3>
          <v-simple-table dense class="agentJobTypesTable">
            <template v-slot:default>
              <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
              </thead>
              <tbody>
              <tr>
                <td>Connected at</td>
                <td>{{ value.connectedAt | formatDate }}</td>
              </tr>
              <tr>
                <td>Disconnected at</td>
                <td>{{ value.disconnectedAt | formatDate }}</td>
              </tr>
              </tbody>
            </template>
          </v-simple-table>
        </div>

        <div style="padding: 8px">
          <h3>Registered job types:</h3>
          <v-simple-table dense class="agentJobTypesTable">
            <template v-slot:default>
              <thead>
              <tr>
                <th>Name</th>
                <th>Displayname</th>
                <th>Types</th>
                <th>Content types</th>
                <th>Element mode</th>
                <th>Manual start</th>
                <th>Interval</th>
                <th>Watch</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="(jobType) in value.jobTypes" :key="jobType.name">
                <td>{{ jobType.name }}</td>
                <td>{{ jobType.displayName }}</td>
                <td>{{ jobType.types | joinArray }}</td>
                <td>{{ jobType.contentTypes | joinArray }}</td>
                <td>{{ jobType.elementMode }}</td>
                <td>{{ jobType.manualStart }}</td>
                <td>{{ jobType.interval }}</td>
                <td>{{ jobType.watch }}</td>
              </tr>
              </tbody>
            </template>
          </v-simple-table>
        </div>

      </div>

    </v-card-text>
  </v-card>
</template>
<style>

.jap-bold {
  font-weight: bold;
}

.jap-label {
  width: 100%;
  display: block;
}

.jap-value {
  font-size: 16px;
}

.jap-progress {
  margin-top: 4px;
  width: 100%;
}

</style>
<script>

import moment from "moment";
import JobExecutionGraph from "./JobExecutionGraph";

export default {

  components: {
    JobExecutionGraph
  },

  props: {
    value: {
      type: Object,
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

  data: () => ({
    toggled: false
  }),

  computed: {
    location: function() {
      if (this.value.location) {
        if (this.value.location.region)
          return `${this.value.location.country} / ${this.value.location.region}`;
        else
          return `${this.value.location.country}`;
      }

      return "unknown";
    },
    cpuLoad: {
      get() {
        let value = "?";

        if (this.value.sysinfo && this.value.sysinfo.cpuInfo) {
          value = this.value.sysinfo.cpuInfo.avgLoad;
          if (value) {
            value = Math.round(value * 10) / 10;
            value += "%";
          }
        }

        return value;
      }
    },
    cpuPercentage: {
      get() {
        if (this.value.sysinfo && this.value.sysinfo.cpuInfo) {
          return this.value.sysinfo.cpuInfo.avgLoad;
        }

        return 0;
      }
    },
    diskPercentage: {
      get() {
        const used = this.diskUsage;
        const total = this.diskTotal;
        return used / total * 100;
      }
    },
    diskUsage: {
      get() {
        if (this.value.sysinfo && this.value.sysinfo.diskInfo) {
          let result = 0;
          for (const disk of this.value.sysinfo.diskInfo) {
            if ((disk.type === "apfs" || disk.type === "ext4" || disk.type === "overlay") &&
              (disk.mount === "/" || disk.mount === "/home"))
              result += disk.used;
          }
          return result;
        }
        return "?";
      }
    },
    diskTotal: {
      get() {
        if (this.value.sysinfo && this.value.sysinfo.diskInfo) {
          let result = 0;
          for (const disk of this.value.sysinfo.diskInfo) {
            if ((disk.type === "apfs" || disk.type === "ext4" || disk.type === "overlay") &&
              (disk.mount === "/" || disk.mount === "/home"))
              result += disk.size;
          }
          return result;
        }
        return "?";
      }
    },
    ramPercentage: {
      get() {
        if (this.value.sysinfo && this.value.sysinfo.memoryInfo) {
          const total = this.value.sysinfo.memoryInfo.total;
          const used = this.value.sysinfo.memoryInfo.used;
          const free = this.value.sysinfo.memoryInfo.free;

          if (used)
            return used / total * 100;
          else
            return (total-free) / total * 100;
        }

        return 0;
      }
    },
    ramTotal: {
      get() {
        if (this.value.sysinfo && this.value.sysinfo.memoryInfo) {
          return this.value.sysinfo.memoryInfo.total;
        }

        return "?";
      }
    },
    ramUsage: {
      get() {
        if (this.value.sysinfo && this.value.sysinfo.memoryInfo) {
          const total = this.value.sysinfo.memoryInfo.total;
          const used = this.value.sysinfo.memoryInfo.used;
          const free = this.value.sysinfo.memoryInfo.free;

          if (used)
            return used;
          else
            return total-free;
        }

        return "?";
      }
    },
    cardStyle: {
      get() {
        if (this.value.connectedAt && !this.value.disconnectedAt) {
          return "border-left: 4px solid green; margin-bottom: 4px";
        } else {
          return "border-left: 4px solid red; margin-bottom: 4px";
        }
      }
    },
    innerCardStyle() {
      if (this.$vuetify.theme.dark)
        return "padding: 8px; background-color: #181818; border: 1px solid #303030";
      else
        return "padding: 8px; background-color: #f8f8f8; border: 1px solid #e0e0e0";
    }
  },

  filters: {
    formatDate: function (value) {
      if (!value)
        return "<no date>";

      return moment(value).format('YYYY-MM-DD HH:mm:ss');
    },
    formatBytes(bytes) {
      if (typeof bytes !== 'number' || !isFinite(bytes))
        return "";

      if (bytes > 1024) {
        bytes /= 1024;
        if (bytes > 1024) {
          bytes /= 1024;
          if (bytes > 1024) {
            bytes /= 1024;
            return `${Math.round(bytes * 100) / 100} GiB`;
          } else {
            return `${Math.round(bytes * 100) / 100} MiB`;
          }
        } else {
          return `${Math.round(bytes * 100) / 100} KiB`;
        }
      } else {
        return `${bytes} bytes`;
      }
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
    }
  },

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
    async setAgentDisabled(value) {
      try {
        this.value.disabled = value;

        if (value) {
          await this.$store.state.nkclient.disableJobAgent(this.value._id);
          this.$store.commit("setMessage", "Agent was disabled");
        } else {
          await this.$store.state.nkclient.enableJobAgent(this.value._id);
          this.$store.commit("setMessage", "Agent was enabled");
        }
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    async restartAgent() {
      try {
        await this.$store.state.nkclient.restartJobAgent(this.value._id);
        this.$store.commit("setMessage", "Agent restart was triggered");
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    }
  }

}

</script>

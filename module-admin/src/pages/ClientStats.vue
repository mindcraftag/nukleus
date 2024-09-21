<template>
  <div>
    <h1 class="pageTitle" data-test="clientStatsTitle">Client stats</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <h2>Statistics for {{ clientName }}</h2>

                </v-flex>
                <v-flex lg4 sm12>

                  <v-date-picker
                    v-model="date"
                    full-width
                    :landscape="true"
                    type="month"
                    class="mt-4"
                  ></v-date-picker>

                </v-flex>
                <v-flex lg4 md6 sm12>

                  Storage in GB:
                  <LineChart :data="chartStorage" :options="chartOptions" :height="300"></LineChart>

                </v-flex>
                <v-flex lg4 md6 sm12>

                  Storage Filecount:
                  <LineChart :data="chartStorageCounts" :options="chartOptions" :height="300"></LineChart>

                </v-flex>
                <v-flex md6 sm12>

                  Traffic transfer counts:
                  <LineChart :data="chartDataCounts" :options="chartOptions" :height="300"></LineChart>

                </v-flex>
                <v-flex md6 sm12>

                  Traffic in GB:
                  <LineChart :data="chartDataBytes" :options="chartOptions" :height="300"></LineChart>

                </v-flex>
                <v-flex xs12>

                  <v-data-table
                    item-key="_id"
                    :headers="headers"
                    :items="stats"
                    dense
                    :sort-desc="true"
                    hide-default-footer
                    disable-pagination
                    show-expand>
                    <template v-slot:item="props">
                      <tr @click="props.expand(!props.isExpanded)">
                        <td style="cursor: pointer;">
                          <v-icon v-if="!props.isExpanded">mdi-chevron-down</v-icon>
                          <v-icon v-if="props.isExpanded">mdi-chevron-up</v-icon>
                        </td>
                        <td>{{ props.item.day }}</td>
                        <td>{{ props.item.metrics.publicDownloadCount }}</td>
                        <td>{{ props.item.metrics.publicDownloadBytes | formatSize }}</td>
                        <td>{{ props.item.metrics.secureDownloadCount }}</td>
                        <td>{{ props.item.metrics.secureDownloadBytes | formatSize }}</td>
                        <td>{{ props.item.metrics.uploadCount }}</td>
                        <td>{{ props.item.metrics.uploadBytes | formatSize }}</td>
                        <td>{{ props.item.metrics.storedCount }}</td>
                        <td>{{ props.item.metrics.storedBytes | formatSize }}</td>
                      </tr>
                    </template>
                    <template v-slot:expanded-item="{ headers, item }">
                      <td :colspan="headers.length" class="n-sunken">
                        <v-simple-table dense class="clientStatsHoursTable">
                          <template v-slot:default>
                            <thead>
                            <tr>
                              <th>Hour</th>
                              <th>Public downloads (count)</th>
                              <th>Public downloads (bytes)</th>
                              <th>Secure downloads (count)</th>
                              <th>Secure downloads (bytes)</th>
                              <th>Upload count</th>
                              <th>Upload bytes</th>
                              <th>Stored count</th>
                              <th>Stored bytes</th>
                            </tr>
                            </thead>
                            <tbody>
                            <tr v-for="(entry) in item.hours" :key="entry.hour">
                              <td>{{ entry.hour }}</td>
                              <td>{{ entry.metrics.publicDownloadCount }}</td>
                              <td>{{ entry.metrics.publicDownloadBytes | formatSize }}</td>
                              <td>{{ entry.metrics.secureDownloadCount }}</td>
                              <td>{{ entry.metrics.secureDownloadBytes | formatSize }}</td>
                              <td>{{ entry.metrics.uploadCount }}</td>
                              <td>{{ entry.metrics.uploadBytes | formatSize }}</td>
                              <td>{{ entry.metrics.storedCount }}</td>
                              <td>{{ entry.metrics.storedBytes | formatSize }}</td>
                            </tr>
                            </tbody>
                          </template>
                        </v-simple-table>
                      </td>
                    </template>
                  </v-data-table>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>
      </v-layout>
    </v-container>
  </div>
</template>
<style>

  .clientStatsHoursTable {
    margin-left: 40px;
    background: transparent !important;
  }

  .clientStatsHoursTable td {
    height: 20px !important;
  }

  .clientStatsHoursTable th {
    height: 20px !important;
  }

</style>
<script>

  import moment from 'moment'
  import { LineChart } from '@mindcraftgmbh/nukleus-vueui'

  export default {

    components: {
      LineChart
    },

    // ------------------------------------------------------------
    // DATA
    // ------------------------------------------------------------
    data: () => ({
      headers: [
        {
          text: 'Day'
        },
        {
          text: 'Public downloads (count)'
        },
        {
          text: 'Public downloads (bytes)'
        },
        {
          text: 'Secure downloads (count)'
        },
        {
          text: 'Secure downloads (bytes)'
        },
        {
          text: 'Upload count'
        },
        {
          text: 'Upload bytes'
        },
        {
          text: 'Stored count'
        },
        {
          text: 'Stored bytes'
        }
      ],
      stats: [],
      date: new Date().toISOString().substr(0, 7),
      client: null,
      chartDataCounts: {},
      chartDataBytes: {},
      chartStorage: {},
      chartStorageCounts: {},
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false
      }
    }),

    // ------------------------------------------------------------
    // COMPUTED
    // ------------------------------------------------------------
    computed: {
      clientName() {
        if (this.client)
          return this.client.name;

        return "";
      }
    },

    // ------------------------------------------------------------
    // WATCHES
    // ------------------------------------------------------------
    watch: {
      date: function() {
        this.loadStats();
      }
    },

    // ------------------------------------------------------------
    // FILTERS
    // ------------------------------------------------------------
    filters: {
      formatDate: function (value) {
        return moment.duration(value.diff(moment())).humanize(true);
      },
      formatSize: function(value) {
        const units = ['bytes', 'kb', 'MB', 'GB'];
        let i=0;

        while(true) {
          if (value < 1024 || i===units.length-1) {
            const v = Math.floor(value*100)/100;
            return `${v} ${units[i]}`;
          }
          value /= 1024;
          i++;
        }
      }
    },

    // ------------------------------------------------------------
    // METHODS
    // ------------------------------------------------------------
    methods: {

      getFirstHourOfDay(day) {
        for (const stat of this.stats) {
          if (stat.day === day) {
            return stat.hour;
          }
        }
        return undefined;
      },

      getMonthLabels(date) {
        const labels = [];
        for (let i=1; i<date.daysInMonth()+1; i++) {
          labels.push(i.toString());
        }
        return labels;
      },

      getStatsValueFor(field, day, scale) {
        for (const stat of this.stats) {
          if (stat.day === day) {
            return stat.metrics[field] * scale;
          }
        }
        return undefined;
      },

      getStatsValuesFor(field, scale) {
        const values = [];
        scale = scale || 1;

        for (let i=1; i<32; i++) {
          const val = this.getStatsValueFor(field, i, scale);
          values.push(val);
        }

        return values;
      },

      calculateDay(stats, day, month) {
        let data = {
          hours: []
        };

        for (const stat of stats) {
          if (stat.day === day && stat.month === month) {
            data.hours.push(stat);
          }
        }

        Object.assign(data, data.hours[0]);

        return data;
      },

      calculateDays(stats) {
        const days = [];
        let day = 0;
        for (const stat of stats) {
          if (stat.day !== day) {
            day = stat.day;
            days.push(this.calculateDay(stats, day, stat.month));
          }
        }

        return days;
      },

      findLastHoursOfDays(stats) {
        stats.reverse();
        let day = 32;
        for (const stat of stats) {
          if (stat.day < day) {
            stat.lastHourOfDay = true;
            day = stat.day;
          }
        }
        stats.reverse();
      },

      calculateDiffs(stats) {
        for (let i=0; i<stats.length-1; i++) {
          stats[i].metrics.publicDownloadCountDiff = stats[i+1].metrics.publicDownloadCount - stats[i].metrics.publicDownloadCount;
          stats[i].metrics.publicDownloadBytesDiff = stats[i+1].metrics.publicDownloadBytes - stats[i].metrics.publicDownloadBytes;

          stats[i].metrics.secureDownloadCountDiff = stats[i+1].metrics.secureDownloadCount - stats[i].metrics.secureDownloadCount;
          stats[i].metrics.secureDownloadBytesDiff = stats[i+1].metrics.secureDownloadBytes - stats[i].metrics.secureDownloadBytes;

          stats[i].metrics.uploadCountDiff = stats[i+1].metrics.uploadCount - stats[i].metrics.uploadCount;
          stats[i].metrics.uploadBytesDiff = stats[i+1].metrics.uploadBytes - stats[i].metrics.uploadBytes;
        }
      },

      async loadStats() {
        try {
          const year = parseInt(this.date.substr(0, 4));
          const month = parseInt(this.date.substr(5, 2));
          const date = moment(this.date);
          const clientId = this.$router.currentRoute.params.id;

          let nextYear = year;
          let nextMonth = month+1;
          if (nextMonth === 13) {
            nextMonth = 1;
            nextYear++;
          }

          const nkclient = this.$store.state.nkclient;
          this.client = await nkclient.getClient(clientId);
          let stats = await nkclient.getClientMetrics(clientId, year, month);
          let nextStats = await nkclient.getClientMetrics(clientId, nextYear, nextMonth);

          for (let stat of stats) {
            stat.month = month;
          }

          if (nextStats.length) {
            const nextStat = nextStats[0];
            nextStat.month = nextMonth;
            stats.push(nextStat);
          }

          this.calculateDiffs(stats);
          stats = this.calculateDays(stats);
          this.calculateDiffs(stats);

          if (nextStats.length) {
            stats.splice(stats.length-1, 1);
          }

          this.stats = stats;
          //console.log(this.stats);

          const labels = this.getMonthLabels(date);

          this.chartDataCounts = {
            labels: labels,
            datasets: [
              {
                label: "Public downloads",
                borderColor: '#0080ff',
                data: this.getStatsValuesFor('publicDownloadCountDiff')
              },
              {
                label: "Secure downloads",
                borderColor: '#ff8000',
                data: this.getStatsValuesFor('secureDownloadCountDiff')
              },
              {
                label: "Uploads",
                borderColor: '#00ff00',
                data: this.getStatsValuesFor('uploadCountDiff')
              }
            ]
          };

          this.chartDataBytes = {
            labels: labels,
            datasets: [
              {
                label: "Public downloads",
                borderColor: '#0080ff',
                data: this.getStatsValuesFor('publicDownloadBytesDiff', 1/1024/1024/1024)
              },
              {
                label: "Secure downloads",
                borderColor: '#ff8000',
                data: this.getStatsValuesFor('secureDownloadBytesDiff', 1/1024/1024/1024)
              },
              {
                label: "Uploads",
                borderColor: '#00ff00',
                data: this.getStatsValuesFor('uploadBytesDiff', 1/1024/1024/1024)
              }
            ]
          };

          this.chartStorage = {
            labels: labels,
            datasets: [
              {
                label: "Storage",
                borderColor: '#0080ff',
                data: this.getStatsValuesFor('storedBytes', 1/1024/1024/1024)
              }
            ]
          };

          this.chartStorageCounts = {
            labels: labels,
            datasets: [
              {
                label: "Filecount",
                borderColor: '#0080ff',
                data: this.getStatsValuesFor('storedCount')
              }
            ]
          };
        }
        catch(err) {
          console.error(err);
          this.$store.commit("setError", err.toString());
        }
      }
    },

    // ------------------------------------------------------------
    // CREATED
    // ------------------------------------------------------------
    async created() {
      await this.loadStats();
    }
  }

</script>

<style>

</style>

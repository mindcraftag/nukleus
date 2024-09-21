<template>
  <div>
    <h1 class="pageTitle" data-test="clientsTitle">Clients</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-toolbar flat height="32px">
                    <v-toolbar-title></v-toolbar-title>
                    <v-spacer></v-spacer>
                    <v-btn text rounded @click="createNewClient">
                      <v-icon>mdi-plus-circle-outline</v-icon>
                      add client
                    </v-btn>
                  </v-toolbar>

                  <v-data-table
                    item-key="_id"
                    :headers="headers"
                    sort-by="name"
                    dense
                    :sort-desc="false"
                    :items="clients"
                    :footer-props="{
                      itemsPerPageOptions: [100, 200, 500],
                      options: {
                          itemsPerPage: 100
                      }
                  }">
                    <template slot="item" slot-scope="props">
                      <tr>
                        <td class="text-xs_left px-0">
                          <font-awesome-icon :icon="['fal', 'users']" :color="props.item.publicDownloadAllowed ? '#0080ff' : $root.iconColor"/>
                          <span v-if="props.item.publicDownloadAllowed">Public</span>
                          <span v-else>Private</span>
                        </td>
                        <td class="text-xs-left"
                            style="cursor: pointer; width: 30%"
                            @click="editClient(props.item)">
                          {{ props.item.name }}
                          <span v-if="props.item.member && !props.item.primary" style="font-weight: bold;">(member)</span>
                          <span v-if="props.item.member && props.item.primary" style="font-weight: bold; color: #00a000;">(primary membership)</span>
                        </td>
                        <td class="px-0" style="white-space: nowrap;">

                          <v-menu offset-y>
                            <template v-slot:activator="{ on }">
                              <v-btn dark small text fab color="grey" v-on="on">
                                <v-icon>mdi-dots-horizontal</v-icon>
                              </v-btn>
                            </template>

                            <v-list>
                              <v-list-item @click="editClient(props.item)">
                                <v-list-item-title><font-awesome-icon :icon="['fal', 'edit']"/>&nbsp;Edit</v-list-item-title>
                              </v-list-item>
                              <v-list-item @click="showClientStats(props.item)">
                                <v-list-item-title><font-awesome-icon :icon="['fal', 'chart-line']"/>&nbsp;Statistics</v-list-item-title>
                              </v-list-item>
                              <v-list-item @click="requestDeleteClient(props.item)">
                                <v-list-item-title><span style="color: red;"><font-awesome-icon :icon="['fal', 'trash']"/> Delete</span></v-list-item-title>
                              </v-list-item>
                              <v-list-item @click="joinClient(props.item)" v-if="!props.item.member">
                                <v-list-item-title><font-awesome-icon :icon="['fal', 'sign-in']"/>&nbsp;Join</v-list-item-title>
                              </v-list-item>
                              <v-list-item @click="leaveClient(props.item)" v-if="props.item.member">
                                <v-list-item-title><font-awesome-icon :icon="['fal', 'sign-out']"/>&nbsp;Leave</v-list-item-title>
                              </v-list-item>
                              <v-list-item @click="switchToClient(props.item)">
                                <v-list-item-title><font-awesome-icon :icon="['fal', 'arrow-right']"/>&nbsp;Switch to</v-list-item-title>
                              </v-list-item>
                              <v-list-item @click="copyId(props.item)">
                                <v-list-item-title><font-awesome-icon :icon="['fal', 'copy']"/> Copy Id</v-list-item-title>
                              </v-list-item>
                            </v-list>
                          </v-menu>
                        </td>
                        <td class="text-xs-left" style="white-space: nowrap;">
                          {{ props.item.currentPlanName }}
                        </td>
                        <td class="text-xs-left" style="white-space: nowrap;">
                          {{ props.item.createdAt | formatDate }}
                        </td>
                        <td class="text-xs-left" style="white-space: nowrap;">
                          {{ props.item.metrics.publicDownloadCount }}
                          ({{ props.item.metrics.publicDownloadBytes | formatFileSize }})
                        </td>
                        <td class="text-xs-left" style="white-space: nowrap;">
                          {{ props.item.metrics.secureDownloadCount }}
                          ({{ props.item.metrics.secureDownloadBytes | formatFileSize }})
                        </td>
                        <td class="text-xs-left" style="white-space: nowrap;">
                          {{ props.item.metrics.storedCount }}
                          ({{ props.item.metrics.storedBytes | formatFileSize }})
                        </td>
                      </tr>
                    </template>
                  </v-data-table>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

          <CreateClient v-model="showCreateDialog" v-on:created-client="loadData"/>

          <v-dialog v-model="showDeleteDialog" persistent max-width="290">
            <v-card>
              <v-card-title class="headline">Delete this client?</v-card-title>
              <v-card-text>All data will be lost!</v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="red darken-1" text @click="confirmDelete">Delete</v-btn>
                <v-btn color="green darken-1" text @click="cancelDelete">Cancel</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

        </v-flex>
      </v-layout>
    </v-container>
  </div>
</template>

<script>

import moment from 'moment'
import CreateClient from '../components/CreateClient.vue';


export default {

  components: {
    CreateClient
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      // Client data to display
      clients: [],
      clientToDelete: null,

      // headers for list
      headers: [
        {
          text: '',
          sortable: false
        },
        {
          text: 'Name',
          value: 'name',
          align: 'left',
          sortable: true
        },
        {
          text: '',
          sortable: false
        },
        {
          text: 'Current plan',
          value: 'currentPlan',
          align: 'left',
          sortable: true
        },
        {
          text: 'Created',
          value: 'createdAt',
          align: 'left',
          sortable: true
        },
        {
          text: 'Public downloads',
          value: 'metrics.publicDownloadCount',
          align: 'left',
          sortable: true
        },
        {
          text: 'Secure downloads',
          value: 'metrics.secureDownloadCount',
          align: 'left',
          sortable: true
        },
        {
          text: 'Files hosted',
          value: 'metrics.storedCount',
          align: 'left',
          sortable: true
        }
      ],

      // show dialog values
      showCreateDialog: false,
      showDeleteDialog: false
    }
  },

  // --------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------
  filters: {
    formatDate: function (value) {
      return moment(value).format('YYYY-MM-DD hh:mm:ss');
    },
    formatBool: function (value) {
      return value ? "Yes" : "No";
    },
    formatFileSize: function(value) {
      if (!value)
        return "0 KiB";

      const kb = Math.ceil(value / 1024);
      if (kb < 1024)
        return kb + " kb";
      else {
        const mb = Math.ceil(kb / 1024 * 100) / 100;
        if (mb < 1024)
          return mb + " Mb";
        else
          return (Math.ceil(mb / 1024 * 100) / 100) + " Gb";
      }
    }
  },

  // --------------------------------------------------------
  // CREATED
  // --------------------------------------------------------
  async created() {
    this.loadData();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {

    async loadData() {
      try {
        const nkclient = this.$store.state.nkclient;
        let plans = await nkclient.getPlans();
        let clients = await nkclient.getClientsList();
        let myClients = await nkclient.myClients();

        for (let client of clients) {
          client.member = false;
          client.primary = false;

          for (const myClient of myClients) {
            if (client._id === myClient._id) {
              client.member = true;
              if (myClient.primary)
                client.primary = true;
              break;
            }
          }

          client.currentPlanName = "<unknown>";
          for (const plan of plans) {
            if (plan._id === client.currentPlan) {
              client.currentPlanName = plan.name;
            }
          }
        }

        this.clients = clients;
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    editClient (client) {
      this.$router.push({ name: "EditClient", params: { id: client._id }});
    },

    showClientStats(client) {
      this.$router.push({ name: 'ClientStats', params: { id: client._id } });
    },

    requestDeleteClient (client) {
      this.clientToDelete = client;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },

    confirmDelete() {
      this.showDeleteDialog = false;
      this.deleteClient();
    },

    async deleteClient() {
      await this.$store.state.nkclient.deleteClient(this.clientToDelete._id);
      this.loadData();
    },

    createNewClient() {
      this.showCreateDialog = true;
    },

    switchToClient(client) {
      this.$store.commit('setActiveClient', client._id);
      this.$router.push({ name: 'ItemsRoot' });
    },

    async copyId(client) {
      try {
        await navigator.clipboard.writeText(client._id);
        this.$store.commit("setMessage", "ID has been copied to clipboard");
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async joinClient(client) {
      try {
        await this.$store.state.nkclient.joinClient(client._id);
        this.$store.commit("setMessage", "Joined client");
        client.member = true;
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async leaveClient(client) {
      try {
        await this.$store.state.nkclient.leaveClient(client._id);
        this.$store.commit("setMessage", "Left client");
        client.member = false;
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    }

  }
}
</script>

<style scoped>
  .table {
    border-radius: 3px;
    background-clip: border-box;
    border: 1px solid rgba(0, 0, 0, 0.125);
    box-shadow: 1px 1px 1px 1px rgba(0, 0, 0, 0.21);
    background-color: transparent;
  }
</style>

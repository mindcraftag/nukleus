<template>
  <div>
    <h1 class="pageTitle" data-test="approvalsTitle">Approvals</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-data-table
                    v-model="selected"
                    item-key="_id"
                    dense
                    :headers="headers"
                    :items="users"
                    sort-by="name"
                    :sort-desc="false"
                    :footer-props="{
                      itemsPerPageOptions: [100, 200, 500],
                      options: {
                          itemsPerPage: 100
                      }
                  }">
                    <template slot="item" slot-scope="props">
                      <tr>
                        <td class="text-xs-left"
                            style="cursor: pointer; width: 30%">
                          {{ props.item.account }}
                        </td>
                        <td class="text-xs-left"
                            style="cursor: pointer; width: 30%">
                          {{ props.item.name }}
                        </td>
                        <td class="px-0" style="white-space: nowrap;">
                          <v-btn @click="approveUser(props.item)">Approve</v-btn>
                          <v-btn @click="requestRejectUser(props.item)">Reject</v-btn>
                        </td>
                        <td class="text-xs-left" style="white-space: nowrap;">{{ props.item.createdAt | formatDate }}</td>
                      </tr>
                    </template>
                  </v-data-table>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

          <v-dialog v-model="showRejectDialog" persistent max-width="290">
            <v-card>
              <v-card-title class="headline">Reject this user?</v-card-title>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="red darken-1" text @click="confirmReject">Reject</v-btn>
                <v-btn color="green darken-1" text @click="cancelReject">Cancel</v-btn>
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

export default {

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      // User data to display
      users: [],

      // selections
      userToReject: null,
      selected: [],

      // headers for list
      headers: [
        {
          text: 'Account',
          value: 'account',
          align: 'left',
          sortable: true
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
          text: 'Created',
          value: 'createdAt',
          align: 'left',
          sortable: true
        }
      ],

      // show dialog values
      showRejectDialog: false
    }
  },

  // --------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------
  filters: {
    formatDate: function (value) {
      return moment(value).format('YYYY-MM-DD hh:mm:ss');
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
        this.users = await this.$store.state.nkclient.getUsersToApprove();
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    requestRejectUser (user) {
      this.userToReject = user;
      this.showRejectDialog = true;
    },

    cancelReject() {
      this.showRejectDialog = false;
    },

    confirmReject() {
      this.showRejectDialog = false;
      this.rejectUser();
    },

    async approveUser(user) {
      try {
        await this.$store.state.nkclient.approveUserRegistration(user._id);
        await this.loadData();
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async rejectUser() {
      try {
        await this.$store.state.nkclient.rejectUserRegistration(this.userToReject._id);
        await this.loadData();
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

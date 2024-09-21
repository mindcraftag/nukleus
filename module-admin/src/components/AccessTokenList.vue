<template>
  <div>
    <v-toolbar flat height="32px">
      <v-toolbar-title></v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn text rounded @click="createNewToken">
        <v-icon>mdi-plus-circle-outline</v-icon>
        add token
      </v-btn>
    </v-toolbar>

    <v-data-table
      item-key="_id"
      dense
      :headers="headers"
      :items="tokens"
      :footer-props="{
                    itemsPerPageOptions: [100, 200, 500],
                    options: {
                        itemsPerPage: 100
                    }
                }"
      sort-by="name"
      :sort-desc="false">
      <template v-slot:item="props">
        <tr :class="props.item.enabled ? '' : 'disabledToken'">
          <td class="text-xs-left">
            <v-icon :style="props.item | stateColor">{{ props.item | stateIcon }}</v-icon>
            {{ props.item.name }}
          </td>
          <td class="text-xs-left">
            {{ props.item.type }}
          </td>
          <td class="text-xs-left">
            {{ resolveClient(props.item.client) }}
          </td>
          <td class="text-xs-left">
            <TokenViewer :value="props.item.token"></TokenViewer>
          </td>
          <td class="text-xs-left">
            {{ props.item.usedCount }}
          </td>
          <td class="text-xs-left">
            {{ props.item.createdAt | formatDate }}
          </td>
          <td class="text-xs-left px-0">
            <v-btn color="red" v-if="props.item.enabled"
                   small outlined
                   @click="setTokenEnabled(props.item, false)">
              Disable
            </v-btn>
            <v-btn color="green" v-else
                   small outlined
                   @click="setTokenEnabled(props.item, true)">
              Enable
            </v-btn>
            <v-btn color="red"
                   small outlined
                   @click="requestDelete(props.item)">
              Delete
            </v-btn>
          </td>
        </tr>
      </template>
    </v-data-table>

    <CreateToken v-model="showCreateDialog" :clients="clients" v-on:created-token="$emit('reload')"/>

    <v-dialog v-model="showDeleteDialog" persistent max-width="290">
      <v-card>
        <v-card-title class="headline">Delete this token?</v-card-title>
        <v-card-text>Any job agents using this token will no longer be able to connect!</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="red darken-1" text @click="confirmDelete">Delete</v-btn>
          <v-btn color="green darken-1" text @click="cancelDelete">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>
<style>

.disabledToken {
  color: #808080;
}

</style>
<script>

import moment from 'moment'
import TokenViewer from './TokenViewer';
import CreateToken from './CreateToken';

export default {

  components: {
    TokenViewer,
    CreateToken
  },

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    tokens: {
      type: Array,
      required: true
    },
    clients: {
      type: Array,
      required: true
    }
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    switchValue: true,
    showCreateDialog: false,
    showDeleteDialog: false,
    tokenToDelete: null,
    headers: [
      {
        text: 'Name',
        value: 'name',
        sortable: true
      },
      {
        text: 'Type',
        value: 'type',
        sortable: true
      },
      {
        text: 'Client',
        value: 'client',
        sortable: true
      },
      {
        text: 'Token',
        value: 'token',
        sortable: true
      },
      {
        text: 'Usages',
        value: 'usages',
        sortable: true
      },
      {
        text: 'Created at',
        value: 'createdAt',
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
  // FILTERS
  // --------------------------------------------------------
  filters: {
    formatDate: function (value) {
      if (!value)
        return "<no date>";

      return moment(value).format('YYYY-MM-DD HH:mm:ss');
    },
    stateIcon: function(value) {
      if (value.enabled) {
        return "mdi-check";
      } else {
        return "mdi-alert-circle";
      }
    },
    stateColor: function(value) {
      if (value.enabled) {
        return "color: green";
      } else {
        return "color: red";
      }
    }
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    resolveClient(value) {
      if (!value)
        return "";

      for (const client of this.clients) {
        if (value === client._id)
          return client.name;
      }
      return `unknown(${value})`;
    },

    createNewToken() {
      this.showCreateDialog = true;
    },

    requestDelete(item) {
      this.showDeleteDialog = true;
      this.tokenToDelete = item;
    },

    async confirmDelete() {
      try {
        await this.$store.state.nkclient.deleteAccessToken(this.tokenToDelete._id);
        this.showDeleteDialog = false;
        this.$store.commit("setMessage", "Token was deleted");
        this.$emit('reload');
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },

    async setTokenEnabled(item, value) {
      try {
        item.enabled = value;

        if (value) {
          await this.$store.state.nkclient.enableAccessToken(item._id);
          this.$store.commit("setMessage", "Token was enabled");
        } else {
          await this.$store.state.nkclient.disableAccessToken(item._id);
          this.$store.commit("setMessage", "Token was disabled");
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

<template>
  <div>
    <v-toolbar flat height="32px">
      <v-toolbar-title></v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn variant="text" rounded @click="createNewToken">
        <v-icon>mdi-plus-circle-outline</v-icon>
        add token
      </v-btn>
    </v-toolbar>

    <v-data-table
      item-key="_id"
      :headers="headers"
      :items="tokens"
      density="compact"
      return-object
      :footer-props="{
        itemsPerPageOptions: [100, 200, 500],
        options: {
          itemsPerPage: 100,
        },
      }"
      :sort-by="[{ key: 'name', order: 'asc'}]"
    >
      <template #item="props">
        <tr :class="props.item.value.enabled ? '' : 'disabledToken'">
          <td class="text-left">
            {{ props.item.value.name }}
          </td>
          <td class="text-left">
            <TokenViewer :model-value="props.item.value.token"></TokenViewer>
          </td>
          <td class="text-left">
            {{ formatDate(props.item.value.createdAt) }}
          </td>
          <td class="text-left px-0">
            <v-btn
              color="red"
              size="small"
              variant="outlined"
              @click="requestDelete(props.item.value)"
            >
              Delete
            </v-btn>
          </td>
        </tr>
      </template>
    </v-data-table>

    <CreateApiToken
      v-model="showCreateDialog"
      :type="type"
      @created-token="$emit('reload')"
    />

    <v-dialog v-model="showDeleteDialog" persistent max-width="290">
      <v-card>
        <v-card-title class="text-h5">Delete this token?</v-card-title>
        <v-card-text
          >Any services using this token will no longer be able to
          connect!</v-card-text
        >
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="red-darken-1" variant="text" @click="confirmDelete"
            >Delete</v-btn
          >
          <v-btn color="green-darken-1" variant="text" @click="cancelDelete"
            >Cancel</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script>
import moment from "moment";
import TokenViewer from "./TokenViewer";
import CreateApiToken from "./CreateApiToken";

export default {
  components: {
    TokenViewer,
    CreateApiToken,
  },

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    tokens: {
      type: Array,
      required: true,
    },
    type: {
      type: String,
      required: true,
      validator: function (value) {
        return ["api", "access"].includes(value);
      },
    },
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
        title: "Name",
        key: "name",
        sortable: true,
      },
      {
        title: "Token",
        key: "token",
        sortable: true,
      },
      {
        title: "Created at",
        key: "createdAt",
        sortable: true,
      },
      {
        title: "Actions",
        key: "actions",
        sortable: false,
      },
    ],
  }),

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    formatDate: function (value) {
      if (!value) return "<no date>";

      return moment(value).format("YYYY-MM-DD HH:mm:ss");
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
        if (this.type === "api") {
          await this.$store.state.nkclient.deleteApiToken(
            this.tokenToDelete._id,
          );
        } else {
          await this.$store.state.nkclient.deleteClientAccessToken(
            this.tokenToDelete._id,
          );
        }
        this.showDeleteDialog = false;
        this.$store.commit("setMessage", "Token was deleted");
        this.$emit("reload");
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },
  },
};
</script>

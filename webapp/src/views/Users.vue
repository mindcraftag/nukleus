<template>
  <v-container fluid grid-list-xl>
    <v-row wrap>
      <v-col d-flex lg12 sm12 xs12>
        <v-card width="100%">
          <v-container fluid grid-list-lg>
            <v-row wrap>
              <v-col xs12>
                <v-toolbar flat>
                  <v-toolbar-title></v-toolbar-title>
                  <v-spacer></v-spacer>
                  <v-btn variant="text" rounded @click="createNewUser">
                    <v-icon>mdi-plus-circle-outline</v-icon>
                    add user
                  </v-btn>
                </v-toolbar>

                <v-data-table
                  v-model="selected"
                  item-key="_id"
                  density="compact"
                  return-object
                  :headers="headers"
                  :items="users"
                  :sort-by="[{ key: 'name', order: 'asc'}]"
                  :footer-props="{
                    itemsPerPageOptions: [100, 200, 500],
                    options: {
                      itemsPerPage: 100,
                    },
                  }"
                >
                  <template #item="props">
                    <tr>
                      <td class="text-xs_left px-0">
                        <font-awesome-icon
                          :icon="['fal', 'user']"
                          :color="getUserColor(props.item.value)"
                        />
                        {{ getUserStatus(props.item.value) }}
                      </td>
                      <td
                        class="text-left"
                        style="cursor: pointer; width: 30%"
                        @click="editUser(props.item.value)"
                      >
                        {{ props.item.value.account }}
                      </td>
                      <td
                        class="text-left"
                        style="cursor: pointer; width: 30%"
                        @click="editUser(props.item.value)"
                      >
                        {{ props.item.value.name }}
                      </td>
                      <td class="px-0" style="white-space: nowrap">
                        <v-menu>
                          <template #activator="{ props }">
                            <v-btn
                              size="small"
                              variant="text"
                              color="grey"
                              v-bind="props"
                            >
                              <v-icon>mdi-dots-horizontal</v-icon>
                            </v-btn>
                          </template>

                          <v-list>
                            <v-list-item @click="editUser(props.item.value)">
                              <v-list-item-title
                                ><font-awesome-icon
                                  :icon="['fal', 'edit']"
                                />Edit</v-list-item-title
                              >
                            </v-list-item>
                            <v-list-item @click="requestDeleteUser(props.item.value)">
                              <v-list-item-title
                                ><font-awesome-icon
                                  :icon="['fal', 'trash']"
                                />Delete</v-list-item-title
                              >
                            </v-list-item>
                          </v-list>
                        </v-menu>
                      </td>
                      <td class="text-left" style="white-space: nowrap">
                        {{ formatDate(props.item.value.createdAt) }}
                      </td>
                    </tr>
                  </template>
                </v-data-table>
              </v-col>
            </v-row>
          </v-container>
        </v-card>

        <v-dialog v-model="showDeleteDialog" persistent max-width="290">
          <v-card>
            <v-card-title class="text-h5">Delete this user?</v-card-title>
            <v-card-text>All data will be lost!</v-card-text>
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

        <v-dialog v-model="showDeleteSelectedDialog" persistent max-width="290">
          <v-card>
            <v-card-title class="text-h5">Delete selected users?</v-card-title>
            <v-card-text>All data will be lost!</v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                color="red-darken-1"
                variant="flat"
                @click="confirmDeleteSelected"
                >Delete</v-btn
              >
              <v-btn
                color="green-darken-1"
                variant="flat"
                @click="cancelDeleteSelected"
                >Cancel</v-btn
              >
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import moment from "moment";

export default {

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      // User data to display
      users: [],

      // selections
      userToDelete: null,
      selected: [],

      // headers for list
      headers: [
        {
          title: "",
          key: 'select',
          sortable: false,
        },
        {
          title: "Account",
          key: "account",
          align: "left",
          sortable: true,
        },
        {
          title: "Name",
          key: "name",
          align: "left",
          sortable: true,
        },
        {
          title: "",
          key: 'actions',
          sortable: false,
        },
        {
          title: "Created",
          key: "createdAt",
          align: "left",
          sortable: true,
        },
      ],

      // show dialog values
      showDeleteDialog: false,
      showDeleteSelectedDialog: false,
    };
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
    formatDate: function (value) {
      return moment(value).format("YYYY-MM-DD hh:mm:ss");
    },
    formatBool: function (value) {
      return value ? "Yes" : "No";
    },
    getUserColor(item) {
      if (!item.active) return "#e0e0e0";

      if (item.superadmin) return "#f00000";

      if (item.admin) return "#0040f0";

      return this.$vuetify.theme.current.iconColor;
    },

    getUserStatus(item) {
      if (!item.active) return "Inactive";

      if (item.superadmin) return "Superadmin";

      if (item.admin) return "Admin";

      return "User";
    },

    async loadData() {
      try {
        this.users = await this.$store.state.nkclient.getUsersList();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    editUser(user) {
      this.$router.push({ name: "EditUser", params: { id: user._id } });
    },

    requestDeleteUser(user) {
      this.userToDelete = user;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },

    confirmDelete() {
      this.showDeleteDialog = false;
      this.deleteUser();
    },

    async deleteUser() {
      try {
        await this.$store.state.nkclient.deleteUser(this.userToDelete._id);
        await this.loadData();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    confirmDeleteSelected() {},

    cancelDeleteSelected() {},

    createNewUser() {
      this.$router.push({ name: "CreateUser" });
    },
  },
};
</script>

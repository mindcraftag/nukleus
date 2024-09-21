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
                  <v-btn variant="text" rounded @click="createNewPurchasable">
                    <v-icon>mdi-plus-circle-outline</v-icon>
                    add purchasable
                  </v-btn>
                </v-toolbar>

                <v-data-table
                  v-model="selected"
                  item-key="_id"
                  density="compact"
                  return-object
                  :headers="headers"
                  :items="purchasables"
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
                        <font-awesome-icon :icon="['fal', 'bag-shopping']" />
                      </td>
                      <td
                        class="text-left"
                        style="cursor: pointer; width: 30%"
                        @click="editPurchasable(props.item.value)"
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
                            <v-list-item @click="editPurchasable(props.item.value)">
                              <v-list-item-title
                                ><font-awesome-icon
                                  :icon="['fal', 'edit']"
                                />Edit</v-list-item-title
                              >
                            </v-list-item>
                            <v-list-item
                              @click="requestDeletePurchasable(props.item.value)"
                            >
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
                        {{ props.item.value.groupId }}
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
            <v-card-title class="text-h5"
              >Delete this purchasable?</v-card-title
            >
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

        <EditOrCreatePurchasable
          v-model="showEditOrCreatePurchasableDialog"
          :purchasable-id="purchasableIdToEdit"
          @created="loadData"
          @updated="loadData"
        />
      </v-col>
    </v-row>
  </v-container>
</template>
<script>
import moment from "moment";

import EditOrCreatePurchasable from "../components/EditOrCreatePurchasable";

export default {
  components: {
    EditOrCreatePurchasable,
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      purchasables: [],

      // selections
      purchasableToDelete: null,
      purchasableIdToEdit: null,
      selected: [],

      // headers for list
      headers: [
        {
          title: "",
          key: "selection",
          sortable: false,
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
          title: "Group ID",
          key: "groupId",
          align: "left",
          sortable: true,
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
      showEditOrCreatePurchasableDialog: false,
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
    async loadData() {
      try {
        this.purchasables = await this.$store.state.nkclient.getPurchasables();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    editPurchasable(purchasable) {
      this.showEditOrCreatePurchasableDialog = true;
      this.purchasableIdToEdit = purchasable._id;
    },

    requestDeletePurchasable(purchasable) {
      this.purchasableToDelete = purchasable;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },

    confirmDelete() {
      this.showDeleteDialog = false;
      this.deletePurchasable();
    },

    async deletePurchasable() {
      try {
        await this.$store.state.nkclient.deletePurchasable(
          this.purchasableToDelete._id,
        );
        await this.loadData();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    createNewPurchasable() {
      this.showEditOrCreatePurchasableDialog = true;
      this.purchasableIdToEdit = null;
    },
  },
};
</script>

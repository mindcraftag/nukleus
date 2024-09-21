<template>

  <v-container fluid>
    <v-card width="100%">
      <v-container fluid>
        <v-row wrap>
          <v-col cols="12">
            <v-toolbar flat>
              <v-toolbar-title></v-toolbar-title>
              <v-spacer></v-spacer>
              <v-btn variant="text" rounded @click="createPage">
                <v-icon class="mr-2">mdi-plus-circle-outline</v-icon>
                create page
              </v-btn>
            </v-toolbar>

          </v-col>
          <v-col cols="12">
            <v-data-table v-model="selected" item-key="_id" density="compact" :headers="headers" return-object
              :items="pages" :sort-by="[{ key: 'name', order: 'desc' }]" :footer-props="{
                itemsPerPageOptions: [100, 200, 500],
                options: {
                  itemsPerPage: 100,
                },
              }">
              <template #item="props">
                <tr>
                  <td class="text-xs_left px-0">
                    <font-awesome-icon :icon="['fal', 'earth-europe']" />
                  </td>
                  <td class="text-left" style="cursor: pointer; width: 50%"
                    @click="$router.push('/pages/' + props.item.value._id)">
                    {{ props.item.value.title }}
                  </td>
                  <td class="text-left" style="cursor: pointer; width: 50%">
                    {{ props.item.value.public ? "Yes" : "No" }}
                  </td>
                  <td class="px-0" style="white-space: nowrap">
                    <v-menu>
                      <template #activator="{ props }">
                        <v-btn size="small" variant="text" color="grey" v-bind="props">
                          <v-icon>mdi-dots-horizontal</v-icon>
                        </v-btn>
                      </template>

                      <v-list>
                        <v-list-item
                          @click="requestDeletePage(props.item.value)">
                          <v-list-item-title><font-awesome-icon :icon="['fal', 'trash']"
                              class="mr-2" />Delete</v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-menu>
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
        <v-card-title class="text-h5">Delete the page "{{ pageToDelete.title }}"?</v-card-title>
        <v-card-text>All data will be lost!</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="red-darken-1" variant="text" @click="confirmDelete">Delete</v-btn>
          <v-btn color="green-darken-1" variant="text" @click="cancelDelete">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <CreatePage v-model="showCreatePageDialog" @created="pageCreated" />
  </v-container>
</template>
<script>
import permissions from "../modules/permissions";
import CreatePage from "../components/CreatePage";

export default {
  components: {
    CreatePage,
  },

  data() {
    return {
      pages: [],

      // selections
      pageToDelete: null,
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
          title: "Public",
          key: "public",
          align: "left",
          sortable: true,
        },
        {
          title: "",
          key: "actions",
          sortable: false,
        },
      ],

      // show dialog values
      showDeleteDialog: false,
      showCreatePageDialog: false,
    };
  },

  async created() {
    this.loadData();
  },

  methods: {
    async loadData() {
      try {
        this.pages =
          await this.$store.state.nkclient.getPages();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    pageCreated() {
      this.loadData();
    },

    requestDeletePage(page) {
      this.pageToDelete = page;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },

    confirmDelete() {
      this.showDeleteDialog = false;
      this.deletePage();
    },

    async deletePage() {
      try {
        await this.$store.state.nkclient.deletePage(
          this.pageToDelete._id,
        );
        await this.loadData();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    createPage() {
      this.showCreatePageDialog = true;
    },
  },
};
</script>

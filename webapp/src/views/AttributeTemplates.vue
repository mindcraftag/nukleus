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
                  <v-btn
                    variant="text"
                    rounded
                    @click="createNewAttributeTemplate"
                  >
                    <v-icon>mdi-plus-circle-outline</v-icon>
                    add attribute template
                  </v-btn>
                </v-toolbar>

                <v-data-table
                  v-model="selected"
                  item-key="_id"
                  density="compact"
                  :headers="headers"
                  return-object
                  :items="attributeTemplates"
                  :sort-by="[{ key: 'name', order: 'desc'}]"
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
                          :icon="['fal', 'drafting-compass']"
                        />
                      </td>
                      <td
                        class="text-left"
                        style="cursor: pointer; width: 30%"
                        @click="editAttributeTemplate(props.item.value)"
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
                            <v-list-item
                              @click="editAttributeTemplate(props.item.value)"
                            >
                              <v-list-item-title
                                ><font-awesome-icon
                                  :icon="['fal', 'edit']"
                                />Edit</v-list-item-title
                              >
                            </v-list-item>
                            <v-list-item
                              @click="
                                requestDeleteAttributeTemplate(props.item.value)
                              "
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
              >Delete this attribute template?</v-card-title
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

        <CreateAttributeTemplate
          v-model="showCreateAttributeTemplateDialog"
          @created="attributeTemplateCreated"
        />
      </v-col>
    </v-row>
  </v-container>
</template>
<script>
import moment from "moment";

import CreateAttributeTemplate from "../components/CreateAttributeTemplate";

export default {
  components: {
    CreateAttributeTemplate,
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      attributeTemplates: [],

      // selections
      attributeTemplateToDelete: null,
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
          key: "actions",
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
      showCreateAttributeTemplateDialog: false,
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
        this.attributeTemplates =
          await this.$store.state.nkclient.getAttributeTemplates();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    attributeTemplateCreated() {
      this.loadData();
    },

    editAttributeTemplate(attributeTemplate) {
      this.$router.push({
        name: "EditAttributeTemplate",
        params: { id: attributeTemplate._id },
      });
    },

    requestDeleteAttributeTemplate(attributeTemplate) {
      this.attributeTemplateToDelete = attributeTemplate;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },

    confirmDelete() {
      this.showDeleteDialog = false;
      this.deleteAttributeTemplate();
    },

    async deleteAttributeTemplate() {
      try {
        await this.$store.state.nkclient.deleteAttributeTemplate(
          this.attributeTemplateToDelete._id,
        );
        await this.loadData();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    createNewAttributeTemplate() {
      this.showCreateAttributeTemplateDialog = true;
    },
  },
};
</script>

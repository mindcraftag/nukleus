<template>

  <v-container fluid>
    <v-card width="100%">
      <v-container fluid>
        <v-row wrap>
          <v-col cols="12">
            <v-toolbar flat>
              <v-toolbar-title></v-toolbar-title>
              <v-spacer></v-spacer>
              <v-btn variant="text" rounded @click="createNewBlog" :disabled="!isClientAdmin">
                <v-icon class="mr-2">mdi-plus-circle-outline</v-icon>
                create blog
              </v-btn>
            </v-toolbar>

          </v-col>
          <v-col cols="12">
            <v-data-table v-model="selected" item-key="_id" density="compact" :headers="headers" return-object
              :items="blogs" :sort-by="[{ key: 'name', order: 'desc' }]" :footer-props="{
                itemsPerPageOptions: [100, 200, 500],
                options: {
                  itemsPerPage: 100,
                },
              }">
              <template #item="props">
                <tr>
                  <td class="text-xs_left px-0">
                    <font-awesome-icon :icon="['fal', 'pen-nib']" />
                  </td>
                  <td class="text-left" style="cursor: pointer; width: 30%"
                    @click="$router.push('/blogs/' + props.item.value._id)">
                    {{ props.item.value.name }}
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
                          @click="requestDeleteBlog(props.item.value)"
                            :disabled="!isClientAdmin">
                          <v-list-item-title><font-awesome-icon :icon="['fal', 'trash']"
                              class="mr-2" />Delete</v-list-item-title>
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
        <v-card-title class="text-h5">Delete the blog "{{ blogToDelete.name }}"?</v-card-title>
        <v-card-text>All data will be lost!<br><b>Including all articles!</b></v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="red-darken-1" variant="text" @click="confirmDelete">Delete</v-btn>
          <v-btn color="green-darken-1" variant="text" @click="cancelDelete">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <CreateBlog v-model="showCreateBlogDialog" @created="blogCreated" />
  </v-container>
</template>
<script>
import moment from "moment";
import permissions from "../modules/permissions";
import CreateBlog from "../components/CreateBlog";

export default {
  components: {
    CreateBlog,
  },

  data() {
    return {
      blogs: [],

      // selections
      blogToDelete: null,
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
      showCreateBlogDialog: false,
    };
  },

  computed: {
    isClientAdmin: function() {
      return permissions.hasPermission("client_admin");
    }
  },

  async created() {
    this.loadData();
  },

  methods: {
    formatDate: function (value) {
      return moment(value).format("YYYY-MM-DD hh:mm:ss");
    },
    formatBool: function (value) {
      return value ? "Yes" : "No";
    },
    async loadData() {
      try {
        this.blogs =
          await this.$store.state.nkclient.getBlogs();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    blogCreated() {
      this.loadData();
    },

    editBlog(attributeTemplate) {
      this.$router.push({
        name: "EditAttributeTemplate",
        params: { id: attributeTemplate._id },
      });
    },

    requestDeleteBlog(blog) {
      this.blogToDelete = blog;
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
        await this.$store.state.nkclient.deleteBlog(
          this.blogToDelete._id,
        );
        await this.loadData();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    createNewBlog() {
      this.showCreateBlogDialog = true;
    },
  },
};
</script>

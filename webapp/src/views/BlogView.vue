<template>
  <v-container fluid>
    <v-card width="100%">
      <v-card-actions>
        <v-btn color="primary" data-test="itemSaveAndCloseButton" @click="saveAndClose" :disabled="!isOwner">
          <font-awesome-icon :icon="['fal', 'save']" size="lg" />
          save & close
        </v-btn>

        <v-btn color="primary" data-test="itemSaveButton" @click="save" :disabled="!isOwner">
          <font-awesome-icon :icon="['fal', 'save']" size="lg" />
          save
        </v-btn>

        <v-btn data-test="itemCloseButton" @click="cancel">
          <font-awesome-icon :icon="['fal', 'times']" size="lg" />
          close
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-card width="100%" style="margin-top: 1rem;">
      <v-container fluid>
        <v-row wrap>
          <v-col cols="12" sm="6">
            <v-text-field v-model="name" data-test="nameTextField" label="Name" density="compact"
              hide-details="auto"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" class="d-flex align-center">
            <span v-if="isOwner">You are the owner of this blog.</span>
            <span v-else>You are an editor of this blog.</span>
          </v-col>
          <v-col cols="12" sm="4">

            <v-checkbox v-model="commentsEnabled" data-test="commentsEnabledCheckboxField" label="Comments Enabled" :disabled="!isOwner"
              hide-details="auto" density="compact"></v-checkbox>

            <v-checkbox v-model="isPublic" data-test="publicCheckboxField" label="Public" density="compact" :disabled="!isOwner"
              hide-details="auto"></v-checkbox>
          </v-col>

          <v-col cols="12" sm="8" v-if="isOwner">

            <h4>Editors</h4>
            <UserSelector v-if="editors !== null"
              :set-modified-users="(modifiedUsers) => modifiedEditors = modifiedUsers"
              :initially-selected-user-ids="editors" />
          </v-col>
        </v-row>
      </v-container>
    </v-card>

    <h1 class="pageTitle">Articles</h1>
    <v-card width="100%" style="margin-top: 1rem;">
      <v-container fluid>
        <v-toolbar flat>
          <v-toolbar-title></v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded @click="createNewArticle">
            <v-icon class="mr-2">mdi-plus-circle-outline</v-icon>
            create article
          </v-btn>
        </v-toolbar>

        <v-data-table v-model="selected" item-key="_id" density="compact" :headers="headers" return-object
          :items="articles" :sort-by="[{ key: 'name', order: 'desc' }]" :footer-props="{
          itemsPerPageOptions: [100, 200, 500],
          options: {
            itemsPerPage: 100,
          },
        }">
          <template #item="props">
            <tr>
              <td class="text-xs_left px-0">
                <font-awesome-icon :icon="['fal', 'newspaper']" />
              </td>
              <td class="text-left" style="cursor: pointer; width: 30%"
                @click="$router.push('/blogs/' + blogID + '/' + props.item.value._id)">
                {{ props.item.value.title }}
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
                        @click="requestDeleteArticle(props.item.value)">
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
      </v-container>
    </v-card>


    <v-dialog v-model="showDeleteDialog" persistent max-width="290">
      <v-card>
        <v-card-title class="text-h5">Delete the article "{{ articleToDelete.title }}"?</v-card-title>
        <v-card-text>All data will be lost!</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="red-darken-1" variant="text" @click="confirmDelete">Delete</v-btn>
          <v-btn color="green-darken-1" variant="text" @click="cancelDelete">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <CreateArticle :blogID="blogID" v-model="showCreateArticleDialog" @created="articleCreated" />
  </v-container>
</template>

<script>
import { UserSelector } from '@mindcraftgmbh/nukleus-vueui'
import CreateArticle from "../components/CreateArticle";
import moment from "moment";

export default {
  components: {
    UserSelector,
    CreateArticle
  },
  emits: ["closed"],

  data() {
    return {
      name: "",
      blogID: "",
      isPublic: false,
      commentsEnabled: false,
      isOwner: false,
      modifiedEditors: null,
      editors: null,


      articles: [],

      // selections
      articleToDelete: null,
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
      showCreateArticleDialog: false,
    }
  },
  mounted: async function () {
    this.blogID = this.$route.params.id;
    const blogData = await this.$store.state.nkclient.getBlog(this.blogID)

    this.isOwner = blogData.owner === this.$store.state.me._id;

    this.name = blogData.name;
    this.isPublic = blogData.public;
    this.commentsEnabled = blogData.commentsEnabled;
    this.editors = blogData.editors;

    this.$store.state.nkclient.eventBus.$emit("breadcrumbUpdate", [{
      name: "Blogs",
      href: "Blogs"
    }, {
      name: blogData.name,
    }]);
    this.loadData();
  },

  methods: {
    async loadData() {
      try {
        this.articles =
          await this.$store.state.nkclient.getArticles(this.blogID);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async save() {
      let selectedEditors = [];
      if (this.modifiedEditors === null) {
        selectedEditors = [...this.editors];
      } else {
        // Add all previous editors, except if they have been removed.
        const removedEditorIDs = this.modifiedEditors.removed.map(u => u._id);

        for (const editor of this.editors) {
          if (!removedEditorIDs.includes(editor)) {
            selectedEditors.push(editor);
          }
        }

        for (const addedEditor of this.modifiedEditors.added) {
          selectedEditors.push(addedEditor._id);
        }
      }
      await this.$store.state.nkclient.saveBlog(this.blogID, this.name, this.isPublic, this.commentsEnabled, selectedEditors)
    },
    async saveAndClose() {
      await this.save();
      this.cancel();
    },
    cancel() {
      this.$emit("closed");
      if (!this.embeddedMode) {
        if (window.history.length > 1) this.$router.go(-1);
        else {
          this.$router.push("/blogs");
        }
      }
    },

    formatDate: function (value) {
      return moment(value).format("YYYY-MM-DD hh:mm:ss");
    },
    formatBool: function (value) {
      return value ? "Yes" : "No";
    },

    articleCreated() {
      this.loadData();
    },

    editArticle(attributeTemplate) {
      this.$router.push({
        name: "EditAttributeTemplate",
        params: { id: attributeTemplate._id },
      });
    },

    requestDeleteArticle(blog) {
      this.articleToDelete = blog;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },

    confirmDelete() {
      this.showDeleteDialog = false;
      this.deleteArticle();
    },

    async deleteArticle() {
      try {
        await this.$store.state.nkclient.deleteArticle(
          this.blogID,
          this.articleToDelete._id,
        );
        await this.loadData();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    createNewArticle() {
      this.showCreateArticleDialog = true;
    },
  },
}
</script>

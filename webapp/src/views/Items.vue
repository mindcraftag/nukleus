<template>
  <v-container fluid grid-list-xl data-test="itemsPage">
    <v-row wrap>
      <v-col d-flex lg12 sm12 xs12>
        <v-card width="100%">
          <v-container fluid grid-list-lg>
            <v-row wrap>
              <v-col xs12>
                <ItemsList
                  :items="foldersAndItems"
                  :job-types="jobTypes"
                  :workflows="workflows"
                  :folder="folder"
                  :folder-id="folderId"
                  :allow-jobs="hasPermission('job_create')"
                  :allow-delete="true"
                  :allow-move="true"
                  :allow-create-item="canWriteToFolder"
                  :allow-create-folder="canWriteToFolder"
                  :allow-edit-item="true"
                  :allow-delete-item="true"
                  :loading="loading"
                  @reload="reload"
                  @livereload="liveReload"
                />
              </v-col>
            </v-row>
          </v-container>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

import { watch } from 'vue'
import permissions from "../modules/permissions";
import ItemsList from "../components/ItemsList.vue";
import lodash from "lodash";

export default {
  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    ItemsList,
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      folderId: null,
      folder: null,
      acl: [],
      canWriteToFolder: false,
      items: [],
      datatypes: [],
      childfolders: [],
      foldersAndItems: [],
      jobTypes: [],
      workflows: [],
      loading: true,
    };
  },

  // --------------------------------------------------------
  // CREATED
  // --------------------------------------------------------
  async created() {
    watch(() => [this.$route], (newValues, oldValues) => {
      const oldRoute = oldValues[0];
      const newRoute = newValues[0];

      if (oldRoute.params.folderId !== newRoute.params.folderId &&
        ['Items', 'ItemsRoot'].includes(newRoute.name)) {
        this.reload();
      }
    });

    this.reload();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    hasPermission(perm) {
      return permissions.hasPermission(perm);
    },

    async ensureCorrectClient(folderId) {
      if (!folderId) return;

      const clientId =
        await this.$store.state.nkclient.getFolderClient(folderId);
      if (!clientId) {
        throw "Cannot find this folder.";
      }

      this.$store.commit("setActiveClient", clientId);
    },

    async reload() {
      this.loading = true;
      this.foldersAndItems = [];
      this.folderId = this.$route.params.folderId;
      await this.ensureCorrectClient(this.folderId);

      await Promise.all([
        this.loadData(),
        this.loadManualJobTypes(),
        this.loadWorkflows(),
      ]);

      this.loading = false;
    },

    async liveReload() {
      if (!this.loading) {
        this.throttledLiveReload();
      }
    },

    throttledLiveReload: lodash.throttle(function () {
      console.log("Live Reload");
      this.loadData();
    }, 1000),

    itemClicked(id) {
      this.loadItem(id);
    },

    async loadManualJobTypes() {
      try {
        this.jobTypes = await this.$store.state.nkclient.getManualJobTypes();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async loadWorkflows() {
      try {
        this.workflows = await this.$store.state.nkclient.getWorkflows();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async setBreadcrumbs() {
      const breadcrumbs = [
        {
          name: "Root",
          href: "ItemsRoot",
        },
      ];

      if (this.folderId) {
        const folderPath = await this.$store.state.nkclient.getFolderPath(
          this.folderId,
        );

        for (const part of folderPath.elements) {
          breadcrumbs.push({
            name: part.name,
            href: "Items",
            params: { folderId: part.id },
          });
        }
      }

      this.$store.state.nkclient.eventBus.$emit("breadcrumbUpdate", breadcrumbs);
    },

    verifyAcl(action) {
      const user = this.$store.state.me;

      if (user.admin || user.superadmin) return true;

      for (const acl of this.acl) {
        if (acl.can.includes(action)) {
          if (!acl.user && !acl.group) return true;

          if (acl.user && acl.user === user._id) return true;

          if (acl.group) {
            for (const group of user.groups) {
              if (group === acl.group) return true;
            }
          }
        }
      }
    },

    async getAcl() {
      this.acl = await this.$store.state.nkclient.getFolderAcl(this.folderId);
      await permissions.userAccountInfoReady();
      this.canWriteToFolder = permissions.verifyAcl(this.acl, "write");
    },

    async loadData() {
      try {
        await this.setBreadcrumbs();
        const folders = await this.$store.state.nkclient.getFoldersInFolderList(
          this.folderId,
            { resolveNames: true },
        );
        const items = await this.$store.state.nkclient.getItemsInFolderList(
          this.folderId,
        );
        this.datatypes = await this.$store.state.nkclient.getDatatypesList();
        await this.getAcl();
        this.$store.commit("setListenedFolders", [
          this.folderId ? this.folderId : "0",
        ]);

        const children = folders.children;

        for (let folder of children) {
          folder.isFolder = true;
          folder.isEditable = true;
          folder.isDeletable = true;
          folder.isViewable = false;
        }

        for (var item of items) {
          item.isFolder = false;
          item.isEditable = true;
          item.isDeletable = true;
          item.isViewable = item.filesize > 0;
        }

        this.childfolders = children;
        this.folder = folders.parent;
        this.items = items;

        // create combined array for display in the table
        this.foldersAndItems = this.childfolders.concat(this.items);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

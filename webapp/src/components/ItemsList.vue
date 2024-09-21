<template>
  <div :class="cssClasses">
    <v-toolbar density="comfortable">
      <v-tooltip v-if="folder" location="bottom" color="primary">
        <template #activator="{ props }">
          <v-btn
            data-test="goToParentButton"
            rounded
            variant="text"
            v-bind="props"
            @click="goToParent"
          >
            <font-awesome-icon
              :icon="['fal', 'chevron-square-left']"
              size="2x"
            />
          </v-btn>
        </template>
        <span>Back to parent</span>
      </v-tooltip>

      <v-btn-toggle
          v-model="selectedDisplayMode"
          divided
          density="comfortable"
          style="margin-left: 10px"
      >
        <v-btn icon="mdi-size-s" size="large"></v-btn>
        <v-btn icon="mdi-size-m" size="large"></v-btn>
        <v-btn icon="mdi-size-l" size="large"></v-btn>
      </v-btn-toggle>

      <v-spacer></v-spacer>

      <v-menu
        v-if="selected.length && allowEditItem && workflows.length"
      >
        <template #activator="{ props }">
          <v-btn
            variant="text"
            rounded
            color="normal"
            data-test="startWorkflowButton"
            v-bind="props"
          >
            <font-awesome-icon :icon="['fal', 'project-diagram']" size="2x" />
          </v-btn>
        </template>

        <v-list>
          <v-list>
            <v-list-item
              v-for="workflow in workflows"
              :key="workflow._id"
              @click="startWorkflow(workflow)"
            >
              <v-list-item-title>{{ workflow.name }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-list>
      </v-menu>

      <v-menu v-if="selected.length && allowEditItem">
        <template #activator="{ props }">
          <v-btn
            variant="text"
            rounded
            color="normal"
            data-test="startJobButton"
            v-bind="props"
          >
            <font-awesome-icon :icon="['fal', 'drafting-compass']" size="2x" />
          </v-btn>
        </template>

        <v-list>
          <v-list-item
            v-if="
              allowEditItem && $store.state.activeClientPublicDownloadAllowed
            "
            @click="makeAllPublic"
          >
            <v-list-item-title>Make all public</v-list-item-title>
          </v-list-item>
          <v-list-item
            v-if="
              allowEditItem && $store.state.activeClientPublicDownloadAllowed
            "
            @click="makeAllPrivate"
          >
            <v-list-item-title>Make all private</v-list-item-title>
          </v-list-item>
          <v-list-item @click="setAttributes">
            <v-list-item-title>Set attributes</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-menu
        v-if="selected.length && allowJobs && matchingJobTypes.length"
      >
        <template #activator="{ props }">
          <v-btn
            variant="text"
            rounded
            color="normal"
            data-test="startJobButton"
            v-bind="props"
          >
            <font-awesome-icon :icon="['fal', 'tasks']" size="2x" />
          </v-btn>
        </template>

        <v-list>
          <v-list-item
            v-for="jobType in matchingJobTypes"
            :key="jobType.name"
            @click="runJob(jobType)"
          >
            <v-list-item-title>{{ jobType.displayName }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-tooltip
        v-if="selected.length && allowMove"
        location="bottom"
        color="primary"
      >
        <template #activator="{ props }">
          <v-btn
            data-test="moveSelectedButton"
            variant="text"
            rounded
            color="normal"
            v-bind="props"
            @click="moveSelected"
          >
            <font-awesome-icon :icon="['fal', 'person-dolly']" size="2x" />
          </v-btn>
        </template>
        <span>Move selected elements</span>
      </v-tooltip>

      <v-tooltip
        v-if="selected.length && allowDelete"
        location="bottom"
        color="primary"
      >
        <template #activator="{ props }">
          <v-btn
            data-test="deleteSelectedButton"
            variant="text"
            rounded
            color="error"
            v-bind="props"
            @click="requestDeleteSelected"
          >
            <font-awesome-icon :icon="['fal', 'trash']" size="2x" />
          </v-btn>
        </template>
        <span>Delete selected elements</span>
      </v-tooltip>

      <v-tooltip v-if="allowCreateItem" location="bottom" color="primary">
        <template #activator="{ props }">
          <v-btn
            data-test="createItemButton"
            variant="text"
            rounded
            color="primary"
            v-bind="props"
            @click="createNewItem"
          >
            <font-awesome-icon :icon="['fal', 'file']" size="2x" />
          </v-btn>
        </template>
        <span>Create item</span>
      </v-tooltip>

      <v-tooltip v-if="allowCreateFolder" location="bottom" color="primary">
        <template #activator="{ props }">
          <v-btn
            data-test="createFolderButton"
            variant="text"
            rounded
            color="primary"
            v-bind="props"
            @click="createNewFolder"
          >
            <font-awesome-icon :icon="['fal', 'folder']" size="2x" />
          </v-btn>
        </template>
        <span>Create folder</span>
      </v-tooltip>

      <v-text-field
        v-model="search"
        style="max-width: 200px; margin-right: 10px;"
        prepend-inner-icon="mdi-file-search"
        label="Search"
        density="compact"
        variant="solo"
        flat
        single-line
        hide-details
      ></v-text-field>
    </v-toolbar>

    <v-container fluid>
      <v-row no-gutters>
        <v-col
          cols="6"
          class="flex-grow-1 flex-shrink-0"
          style="min-width: 400px; max-width: 100%"
        >
          <div class="itemsListScrollPanel">
            <v-data-table
              v-model="selected"
              data-test="itemList"
              item-key="_id"
              show-select
              return-object
              must-sort
              :sort-by="[{key: 'name', order: 'asc'}]"
              density="compact"
              :search="search"
              :headers="headers"
              :items="items"
              :loading="loading"
              loading-text="Loading..."
              :items-per-page="100"
              :footer-props="{
                itemsPerPageOptions: [100, 200, 500],
              }"
            >
              <template #item="props">
                <tr data-test="itemListRow" :data-text="props.item.value.name">
                  <td>
                    <v-checkbox-btn
                        :model-value="props.isSelected([props.item])"
                        @click.stop="props.toggleSelect(props.item)"
                    ></v-checkbox-btn>
                  </td>
                  <td
                      class="text-xs_left px-0"
                      style="width: 32px; cursor: pointer; text-align: center"
                      @click="clickRow(props.item.value)"
                  >
                    <ItemThumbnail
                        v-if="props.item.value.thumbnailCount > 0"
                        :item="props.item.value"
                        :size="iconPixelSize"
                    />
                    <font-awesome-icon
                        v-if="!props.item.value.thumbnailCount"
                        :icon="getItemIcon(props.item.value)"
                        :color="$vuetify.theme.current.iconColor"
                        :size="iconSize"
                    />
                  </td>
                  <td
                      class="text-left"
                      style="cursor: pointer; width: 40%"
                      @click="clickRow(props.item.value)"
                  >
                    <div style="display: flex; justify-content: space-between">
                      <div :style="itemNameStyle(props.item.value)">
                        {{ props.item.value.name }}
                        <span
                            v-if="props.item.value.originalName"
                            style="
                            font-style: italic;
                            margin-left: 4px;
                            color: #8090a0;
                          "
                        >
                          ({{ props.item.value.originalName }})
                        </span>
                        <span
                            v-if="props.item.value.autoDestructAt"
                            style="color: red; margin-left: 10px"
                        >
                          Will destruct:
                          {{ props.item.value.autoDestructAt | formatAutoDesctruct }}
                        </span>
                        <v-btn
                            v-if="showGotoFolderLink"
                            icon
                            @click.stop="gotoFolder(props.item.value)"
                        >
                          <v-icon>mdi-folder</v-icon>
                        </v-btn>
                      </div>
                      <div>
                        <font-awesome-icon
                            v-if="
                            props.item.value.public &&
                            $store.state.activeClientPublicDownloadAllowed
                          "
                            color="#0080f0"
                            :icon="['fal', 'globe']"
                        />
                      </div>
                    </div>
                  </td>
                  <td style="white-space: nowrap">
                    <v-menu v-if="showItemMenu(props.item.value)">
                      <template #activator="{ props }">
                        <v-btn
                            size="small"
                            variant="text"
                            color="grey"
                            data-test="itemContextButton"
                            v-bind="props"
                        >
                          <v-icon>mdi-dots-horizontal</v-icon>
                        </v-btn>
                      </template>

                      <v-list density="compact">
                        <v-list-item
                            v-if="isItemEditable(props.item.value)"
                            data-test="itemContextEditButton"
                            @click="editItem(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'edit']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Edit
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            v-if="isValidItem(props.item.value)"
                            data-test="itemContextViewButton"
                            @click="showItem(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'eye']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Show
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            v-if="showItemMenuDownload(props.item.value)"
                            data-test="itemContextDownloadButton"
                            @click="downloadItem(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'download']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Download
                          </v-list-item-title>
                        </v-list-item>

                        <v-divider :inset="false"></v-divider>

                        <v-list-item
                            v-for="plugin of getItemContextPlugins(props.item.value)"
                            :key="plugin.name"
                            data-test="itemContextStudioButton"
                            @click="
                            itemContextPluginClicked(props.item.value, plugin.mount)
                          "
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="plugin.icon"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            {{ plugin.displayText }}
                          </v-list-item-title>
                        </v-list-item>

                        <v-divider :inset="false"></v-divider>

                        <v-list-item
                            v-if="
                            !props.item.value.isFolder &&
                            !props.item.value.public &&
                            allowItemPublish(props.item.value)
                          "
                            data-test="itemContextMakePublicButton"
                            @click="showMakePublicDialog(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'globe']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Make public
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            v-if="
                            !props.item.value.isFolder &&
                            props.item.value.public &&
                            allowItemPublish(props.item.value)
                          "
                            data-test="itemContextMakePrivateButton"
                            @click="showMakePrivateDialog(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'globe']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Make private
                          </v-list-item-title>
                        </v-list-item>

                        <v-divider :inset="false"></v-divider>

                        <v-list-item
                            v-if="
                            props.item.value.thumbnailCount > 0 &&
                            allowEditItem &&
                            allowItemWrite(props.item.value)
                          "
                            data-test="itemContextClearThumbnailButton"
                            @click="clearThumbnail(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'image']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Clear thumbnail
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            v-if="allowEditItem && allowItemWrite(props.item.value)"
                            data-test="itemContextResetThumbnailButton"
                            @click="resetThumbnail(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'image']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Reset thumbnail
                          </v-list-item-title>
                        </v-list-item>

                        <v-divider :inset="false"></v-divider>

                        <v-list-item
                            data-test="itemContextCopyIdButton"
                            @click="copyId(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'copy']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Copy Id
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            v-if="props.item.value.public"
                            data-test="itemContextCopyViewerLinkButton"
                            @click="copyViewerLink(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'copy']"
                                :color="$vuetify.theme.current.iconColor"
                            />
                            Copy viewer link
                          </v-list-item-title>
                        </v-list-item>

                        <v-divider :inset="false"></v-divider>

                        <v-list-item
                            v-if="showItemMenuDelete(props.item.value)"
                            data-test="itemContextDeleteButton"
                            @click="requestDeleteItem(props.item.value)"
                        >
                          <v-list-item-title>
                            <font-awesome-icon
                                :icon="['fal', 'trash']"
                                color="red"
                            />
                            <span style="color: red">Delete</span>
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                  </td>
                  <td class="text-right" style="white-space: nowrap">
                    {{ formatFileSize(props.item.value.totalSize || props.item.value.contentSize) }}
                  </td>
                  <td class="text-right" style="white-space: nowrap">
                    {{ formatFileSize(props.item.value.filesize) }}
                  </td>
                  <td class="text-left" style="white-space: nowrap">
                    {{ props.item.value.type }}
                  </td>
                  <td class="text-left" style="white-space: nowrap">
                    {{ props.item.value.mimeType }}
                  </td>
                  <td class="text-left" style="white-space: nowrap">
                    {{ formatDate(props.item.value.createdAt) }}
                  </td>
                </tr>
              </template>
            </v-data-table>
          </div>

          <UploadDropZone
            v-if="allowCreateItem"
            style="padding: 10px"
            :post-url="uploadUrl()"
            :post-header="uploadHeaders"
          />
        </v-col>

        <v-slide-x-transition>
          <v-col
            v-if="openSidePanel"
            cols="6"
            class="flex-grow-1 flex-shrink-0"
            style="min-width: 400px; max-width: 100%"
          >
            <div class="itemsListScrollPanel">
              <div class="editItemContainer">
                <EditItem
                  :item="itemRepo.activeItem"
                  :embedded-mode="true"
                  @open-folder="openFolderById"
                  @closed="openSidePanel = false"
                >
                </EditItem>
              </div>
            </div>
          </v-col>
        </v-slide-x-transition>
      </v-row>
    </v-container>

    <v-overlay :absolute="true" :model-value="loadingItem" class="align-center justify-center">
      <v-progress-circular
        indeterminate
        data-test="loadingOverlay"
      ></v-progress-circular>
    </v-overlay>

    <v-dialog v-model="showDeleteDialog" :persistent="true" max-width="290">
      <v-card>
        <v-card-title class="text-h5">Delete this item?</v-card-title>
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

    <v-dialog v-model="showDeleteSelectedDialog" :persistent="true" max-width="290">
      <v-card>
        <v-card-title class="text-h5">Delete selected items?</v-card-title>
        <v-card-text>All data will be lost!</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="red-darken-1"
            variant="text"
            data-test="confirmDeleteSelectedButton"
            @click="confirmDeleteSelected"
            >Delete</v-btn
          >
          <v-btn
            color="green-darken-1"
            variant="text"
            data-test="cancelDeleteSelectedButton"
            @click="cancelDeleteSelected"
            >Cancel</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <SetAttributes
      v-model="showSetAttributesDialog"
      :selected-elements="selected"
    />
    <MoveElements
      v-model="showMoveElementsDialog"
      :folder-id="folderId"
      :selected-elements="selected"
      @success="elementsMoved"
    />
    <CreateFolder
      v-model="showCreateFolderDialog"
      :parent-folder-id="folderId"
      @created-folder="folderCreated"
    />
    <EditFolder
      v-model="showEditFolderDialog"
      :folder-id="selectedFolderId"
      @updated-folder="reload"
    />
    <CreateJob
      v-model="showCreateJobDialog"
      :current-folder-id="folderId"
      :selected-elements="selected"
      :job-types="jobTypes"
      :job-type="jobType"
      @closed="onJobCreateClosed"
      @created-job="onJobCreated"
    />
    <CreateItem
      v-model="showCreateItemDialog"
      :parent-folder-id="folderId"
      @created-item="reload"
    />
    <MakePublicPrivate
      v-model="showMakePublicPrivateDialog"
      :item="makePublicPrivateItem"
      :make-public="makePublic"
    />
  </div>
</template>
<script>
import moment from "moment";

import {
  MoveElements,
  CreateFolder,
  EditFolder,
  CreateJob,
  CreateItem,
  MakePublicPrivate,
} from "@mindcraftgmbh/nukleus-vueui";

import EditItem from "./EditItem.vue";
import SetAttributes from "./SetAttributes.vue";

import store from "../store";
import {
  uitools,
  UploadDropZone,
  ItemThumbnail,
} from "@mindcraftgmbh/nukleus-vueui";

export default {
  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    MoveElements,
    CreateFolder,
    EditFolder,
    CreateJob,
    CreateItem,
    EditItem,
    UploadDropZone,
    SetAttributes,
    ItemThumbnail,
    MakePublicPrivate,
  },

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    loading: {
      type: Boolean,
      required: false,
      default: false,
    },
    items: {
      type: Array,
      required: true,
      default: [],
    },
    workflows: {
      type: Array,
      default: () => {
        return [];
      },
    },
    jobTypes: {
      type: Array,
      default: [],
    },
    folderId: {
      type: String,
    },
    folder: {
      type: Object,
    },
    showGotoFolderLink: {
      type: Boolean,
      default: false,
    },
    allowJobs: {
      type: Boolean,
      default: false,
    },
    allowDelete: {
      type: Boolean,
      default: false,
    },
    allowMove: {
      type: Boolean,
      default: false,
    },
    allowCreateItem: {
      type: Boolean,
      default: false,
    },
    allowEditItem: {
      type: Boolean,
      default: false,
    },
    allowDeleteItem: {
      type: Boolean,
      default: false,
    },
    allowCreateFolder: {
      type: Boolean,
      default: false,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    openSidePanel: false,
    loadingItem: false,

    // selections
    itemToDelete: null,
    selected: [],
    selectedFolderId: null,
    search: "",
    makePublicPrivateItem: null,
    makePublic: false,

    jobType: null,

    displayModes: [
      { title: "List small", value: 0 },
      { title: "List medium", value: 1 },
      { title: "List large", value: 2 },
    ],

    headers: [
      {
        title: "",
        key: "thumb",
        sortable: false,
      },
      {
        title: "Name",
        key: "name",
        sortable: true,
      },
      {
        title: "Actions",
        key: "actions",
        sortable: false,
      },
      {
        title: "Size",
        key: "size",
        sortable: true,
      },
      {
        title: "Filesize",
        key: "filesize",
        sortable: true,
      },
      {
        title: "Type",
        key: "type",
        sortable: true,
      },
      {
        title: "Mimetype",
        key: "mimeType",
        sortable: true,
      },
      {
        title: "Created",
        key: "createdAt",
        sortable: true,
      },
    ],

    // show dialog values
    showMoveElementsDialog: false,
    showCreateFolderDialog: false,
    showDeleteDialog: false,
    showDeleteSelectedDialog: false,
    showEditFolderDialog: false,
    showCreateJobDialog: false,
    showCreateItemDialog: false,
    showSetAttributesDialog: false,
    showMakePublicPrivateDialog: false,
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    itemRepo() {
      return this.$store.state.nkclient.getItemRepo();
    },
    selectedDisplayMode: {
      get() {
        return this.$store.state.listDisplayMode || 0;
      },
      set(value) {
        this.$store.commit("setListDisplayMode", value);
      },
    },
    iconPixelSize: {
      get() {
        switch (this.selectedDisplayMode) {
          case 0:
            return 32;
          case 1:
            return 64;
          case 2:
            return 128;
        }

        return 32;
      },
    },
    iconSize: {
      get() {
        switch (this.selectedDisplayMode) {
          case 0:
            return "2x";
          case 1:
            return "5x";
          case 2:
            return "10x";
        }

        return "2x";
      },
    },
    uploadHeaders: {
      get() {
        return {
          "x-access-token": store.state.token,
          "x-request-client": store.state.activeClient,
        };
      },
    },

    itemContextPluginMounts: {
      get() {
        const activeClient = store.state.activeClient;
        const clients = store.state.clients;
        const mounts = [];

        if (clients && activeClient) {
          for (const client of clients) {
            if (client._id === activeClient) {
              for (const plugin of client.plugins) {
                for (const mount of plugin.mounts) {
                  if (mount.type === "itemcontextmenu") {
                    mounts.push({
                      plugin: plugin.name,
                      name: mount.name,
                      displayText: mount.displayText,
                      target: mount.target,
                      url: mount.url,
                      aclRequired: mount.aclRequired,
                    });
                  }
                }
              }
            }
          }
        }

        return mounts;
      },
    },

    cssClasses: {
      get() {
        if (this.$store.state.darkMode) {
          return "itemsListDark";
        } else {
          return "itemsListLight";
        }
      },
    },

    matchingJobTypes: {
      get() {
        const result = [];

        for (const jobType of this.jobTypes) {
          let match = true;

          if (
            Array.isArray(jobType.contentTypes) &&
            jobType.contentTypes.length
          ) {
            for (const selected of this.selected) {
              if (!jobType.contentTypes.includes(selected.mimeType)) {
                match = false;
                break;
              }
            }
          } else if (Array.isArray(jobType.types) && jobType.types.length) {
            for (const selected of this.selected) {
              if (!jobType.types.includes(selected.type)) {
                match = false;
                break;
              }
            }
          }

          if (match) {
            result.push(jobType);
          }
        }

        return result;
      },
    },
  },

  // ----------------------------------------------------------
  // CREATED
  // ----------------------------------------------------------
  created() {
    this.$store.state.nkclient.eventBus.$on("nk:client:elementUpdate", (event) => {
      const thisFolderId = this.folderId ? this.folderId : "0";

      switch (event.type) {
        case "Item":
          if (event.folder === thisFolderId) {
            this.$emit("livereload");
          }
          break;

        case "Folder":
          if (event.folder === thisFolderId) {
            this.$emit("livereload");
          }
          break;
      }
    });

    this.$store.state.nkclient.eventBus.$on("clientUpdate", (event) => {
      this.$emit("livereload");
    });
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    formatDate(value) {
      return moment(value).format("YYYY-MM-DD hh:mm:ss");
    },
    formatAutoDesctruct(value) {
      const destructAt = moment(value);
      const now = moment();
      if (destructAt.isBefore(now)) {
        return "Any moment";
      }
      return now.to(destructAt);
    },
    formatFileSize(value) {
      if (value === null || value === undefined) return "";

      const kb = Math.ceil(value / 1024);
      if (kb < 1024) return kb + " KiB";

      const mb = Math.ceil(kb / 1024);
      if (mb < 1024) return mb + " MiB";

      const gb = Math.ceil((mb / 1024) * 100) / 100;
      return gb + " GiB";
    },
    getItemContextPlugins(item) {
      const pluginMounts = this.itemContextPluginMounts;
      const plugins = [];

      for (const mount of pluginMounts) {
        if (Array.isArray(mount.aclRequired)) {
          if (mount.aclRequired.includes("write") && !this.allowItemWrite(item))
            continue;
        }

        plugins.push({
          displayText: mount.displayText,
          icon: ["fal", "edit"],
          mount: mount,
        });
      }

      return plugins;
    },

    uploadUrl() {
      return (
        this.$store.state.nkclient.getApiBaseUrl() +
        "/api/item/uploadAndCreate/" +
        (this.folderId ? this.folderId : 0)
      );
    },

    uploadSuccess(result) {},

    uploadError(error) {
      console.error(error);
      this.$store.commit("setError", error);
    },

    itemNameStyle(item) {
      if (this.$store.state.darkMode) {
        if (!item.allowWrite && !item.allowPublish) {
          return "color: #808080;";
        } else if (!item.allowWrite || !item.allowPublish) {
          return "color: #c0c0c0;";
        }
      } else {
        if (!item.allowWrite && !item.allowPublish) {
          return "color: #a0a0a0;";
        } else if (!item.allowWrite || !item.allowPublish) {
          return "color: #707070;";
        }
      }

      return "";
    },

    async loadItem(itemId) {
      try {
        this.loadingItem = true;
        await this.itemRepo.loadItemRecursive(itemId);
        this.openSidePanel = true;
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
      this.loadingItem = false;
    },

    gotoFolder(item) {
      this.openFolderById(item.folder ? item.folder : "0");
    },

    async copyId(item) {
      try {
        await navigator.clipboard.writeText(item._id);
        this.$store.commit("setMessage", "ID has been copied to clipboard");
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async copyViewerLink(item) {
      try {
        await navigator.clipboard.writeText(
          this.$store.state.nkclient.getViewerBaseUrl() + "/" + item._id,
        );
        this.$store.commit("setMessage", "Link has been copied to clipboard");
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    getItemIcon(item) {
      if (item.isFolder) return ["fal", "folder"];
      else {
        return uitools.getItemIcon(item.type);
      }
    },

    isItemEditable(item) {
      return item.isEditable;
    },

    isValidItem(item) {
      return !!item._id && !item.isFolder;
    },

    allowItemWrite(item) {
      return (
        !!item._id && !item.isFolder && this.allowEditItem && item.allowWrite
      );
    },

    allowItemPublish(item) {
      return (
        !!item._id &&
        !item.isFolder &&
        this.allowEditItem &&
        item.allowPublish &&
        this.$store.state.activeClientPublicDownloadAllowed
      );
    },

    showItemMenuDownload(item) {
      return item.isViewable;
    },

    showItemMenuDelete(item) {
      return item.isDeletable && this.allowDeleteItem && item.allowWrite;
    },

    showItemMenu(item) {
      return item.isViewable || item.isEditable || item.isDeletable;
    },

    reload() {
      this.$emit("reload");
    },

    editItem(item) {
      if (item.isFolder) {
        this.selectedFolderId = item._id;
        this.showEditFolderDialog = true;
      } else {
        this.$router.push({ name: "EditItem", params: { id: item._id } });
      }
    },

    showItem(item) {
      this.$router.push({ name: "ShowItem", params: { id: item._id } });
    },

    itemContextPluginClicked(item, mount) {
      this.$router.push({
        name: "ModuleView",
        params: {
          module: mount.plugin.toLowerCase(),
          mount: mount.name.toLowerCase(),
          id: item._id,
        },
      });
    },

    requestDeleteItem(item) {
      this.itemToDelete = item;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    },

    confirmDelete() {
      this.showDeleteDialog = false;
      this.deleteItem();
    },

    cancelDeleteSelected() {
      this.showDeleteSelectedDialog = false;
    },

    confirmDeleteSelected() {
      this.showDeleteSelectedDialog = false;
      this.deleteSelectedItems();
    },

    async deleteItem() {
      try {
        if (this.itemToDelete.isFolder) {
          await this.$store.state.nkclient.deleteFolder(this.itemToDelete._id);
        } else {
          await this.$store.state.nkclient.deleteItem(this.itemToDelete._id);
        }
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async deleteSelectedItems() {
      try {
        let selectedItemIds = [];
        let selectedFolderIds = [];

        for (const item of this.selected) {
          if (item.isFolder) {
            selectedFolderIds.push(item._id);
          } else {
            selectedItemIds.push(item._id);
          }
        }

        const promises = [];
        if (selectedItemIds.length) {
          promises.push(this.$store.state.nkclient.deleteItem(selectedItemIds));
        }
        if (selectedFolderIds.length) {
          promises.push(
            this.$store.state.nkclient.deleteFolder(selectedFolderIds),
          );
        }

        await Promise.all(promises);
        this.selected = [];
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    moveSelected() {
      this.showMoveElementsDialog = true;
    },

    elementsMoved() {
      this.selected = [];
      this.reload();
    },

    requestDeleteSelected() {
      this.showDeleteSelectedDialog = true;
    },

    async downloadItem(item) {
      const link = await this.$store.state.nkclient.requestSecureDownload(
        item._id,
      );
      window.location = link;
    },

    folderCreated(folderId, enterFolder) {
      if (enterFolder) this.openFolderById(folderId);
    },

    openFolderById(folderId) {
      this.selected = [];
      this.$router.push({ name: "Items", params: { folderId: folderId } });
    },

    openFolder(item) {
      this.openFolderById(item._id);
    },

    goToParent() {
      this.selected = [];
      this.$router.push({
        name: "Items",
        params: { folderId: this.folder.parent },
      });
    },

    clickRow(item) {
      this.selected = [];
      if (item.isFolder) {
        this.openFolder(item);
      } else {
        this.loadItem(item._id);
      }
    },

    deleteRow(item) {
      if (item.isFolder) {
        this.deleteFolder(item);
      } else {
        this.deleteItem(item);
      }
    },

    createNewItem() {
      this.showCreateItemDialog = true;
    },

    createNewFolder() {
      this.showCreateFolderDialog = true;
    },

    runJob(jobType) {
      this.jobType = jobType;
      this.showCreateJobDialog = true;
    },

    startWorkflow(workflow) {},

    onJobCreated() {
      this.selected = [];
      this.$store.commit("setMessage", "Job was created");
    },

    onJobCreateClosed() {
      this.jobType = null;
    },

    showMakePublicDialog(item) {
      this.makePublicPrivateItem = item;
      this.makePublic = true;
      this.showMakePublicPrivateDialog = true;
    },

    showMakePrivateDialog(item) {
      this.makePublicPrivateItem = item;
      this.makePublic = false;
      this.showMakePublicPrivateDialog = true;
    },

    async makeItemPublic(item) {
      try {
        await this.$store.state.nkclient.makeItemPublic(item._id);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async makeItemPrivate(item) {
      try {
        await this.$store.state.nkclient.makeItemPrivate(item._id);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    getAllSelectedIds() {
      const selectedFolderIds = [];
      const selectedItemIds = [];

      for (const item of this.selected) {
        if (item.isFolder) {
          selectedFolderIds.push(item._id);
        } else {
          selectedItemIds.push(item._id);
        }
      }

      return {
        folderIds: selectedFolderIds,
        itemIds: selectedItemIds,
      };
    },

    async makeAllPublic() {
      try {
        const selection = this.getAllSelectedIds();
        if (selection.itemIds.length) {
          await this.$store.state.nkclient.makeItemPublic(selection.itemIds);
          this.selected = [];
          this.$store.commit("setMessage", "All items were made public");
        } else {
          this.$store.commit("setError", "No item was selected");
        }
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async makeAllPrivate() {
      try {
        const selection = this.getAllSelectedIds();
        if (selection.itemIds.length) {
          await this.$store.state.nkclient.makeItemPrivate(selection.itemIds);
          this.selected = [];
          this.$store.commit("setMessage", "All items were made private");
        } else {
          this.$store.commit("setError", "No item was selected");
        }
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    setAttributes() {
      this.showSetAttributesDialog = true;
    },

    async clearThumbnail(item) {
      try {
        await this.$store.state.nkclient.clearThumbnail(item._id);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async resetThumbnail(item) {
      try {
        await this.$store.state.nkclient.resetThumbnail(item._id);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>
<style>
.itemsListDark .editItemContainer {
  background-color: #181818;
}

.itemsListLight .editItemContainer {
  background-color: #f0f0f0;
}

.itemsListScrollPanel {
}
</style>

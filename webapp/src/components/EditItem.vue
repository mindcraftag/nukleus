<template>
  <v-container fluid grid-list-xl style="overflow: hidden">
    <v-row wrap>
      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-card-actions>
            <v-btn
              v-if="allowEdit"
              color="primary"
              data-test="itemSaveAndCloseButton"
              @click="saveAndClose"
            >
              <font-awesome-icon :icon="['fal', 'save']" size="lg" />
              save & close
            </v-btn>

            <v-btn
                v-if="allowEdit"
                color="primary"
                data-test="itemSaveButton"
                @click="save"
            >
              <font-awesome-icon :icon="['fal', 'save']" size="lg" />
              save
            </v-btn>

            <v-btn data-test="itemCloseButton" @click="cancel">
              <font-awesome-icon :icon="['fal', 'times']" size="lg" />
              close
            </v-btn>

          </v-card-actions>
        </v-card>
      </v-col>

      <v-col d-flex xs12 style="padding-top: 0">
        <v-expansion-panels v-model="openPanels" multiple>
          <v-expansion-panel
            v-if="showMainProperties"
            :ref="(el) => { addPanel(el) }"
            data-test="expansionPanelMainProperties"
          >
            <v-expansion-panel-title
              ><b>Main Properties</b></v-expansion-panel-title
            >
            <v-expansion-panel-text>
              <v-table density="compact" :class="cssClasses">
                <tbody>
                  <tr>
                    <td>Name</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <SmallTextField
                          v-model="itemName"
                          required
                          :readonly="!allowEdit"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Short description</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainerFlexHeight">
                        <SmallTextField
                          v-model="itemShortDescription"
                          :counter="200"
                          :readonly="!allowEdit"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Description</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainerFlexHeight">
                        <SmallTextArea
                          v-model="itemDescription"
                          :height="106"
                          :readonly="!allowEdit"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Tags</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <SmallCombobox
                          v-model="itemTags"
                          multiple
                          :readonly="!allowEdit"
                        ></SmallCombobox>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Flags</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <SmallCombobox
                          v-model="itemFlags"
                          multiple
                          :readonly="!allowEdit"
                        ></SmallCombobox>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="categories && categories.length">
                    <td>Categories</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <SmallSelect
                          v-model="itemCategories"
                          :items="categories"
                          item-title="name"
                          item-value="_id"
                          multiple
                          :readonly="!allowEdit"
                        ></SmallSelect>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="licenses && licenses.length > 1">
                    <td>License</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <SmallSelect
                          v-model="itemLicense"
                          :items="licenses"
                          :readonly="!allowEdit"
                        ></SmallSelect>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="conversationSwitchable">
                    <td>Conversation enabled</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <SmallCheckbox
                          v-model="allowConversation"
                          data-test="itemConversationEnabledCheckbox"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Visibility</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <SmallSelect
                          v-model="visibility"
                          :items="visibilities"
                          :readonly="!allowEdit"
                        ></SmallSelect>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Contributors</td>
                    <td class="fieldValue">
                      <div class="fieldValueContainerFlexHeight">
                        <UserSelector
                          :set-modified-users="(modifiedUsers) => this.contributorChanges = modifiedUsers"
                          :initially-selected-user-ids="itemContributors"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Version</td>
                    <td class="fieldValue">
                      <table style="width: 100%">
                        <tr>
                          <td>
                            <div class="fieldValueContainerFlexHeight">
                              <SmallTextField
                                v-model="itemVersionMajor"
                                type="number"
                                :readonly="!allowEdit"
                              />
                            </div>
                          </td>
                          <td>
                            <div class="fieldValueContainerFlexHeight">
                              <SmallTextField
                                v-model="itemVersionMinor"
                                type="number"
                                :readonly="!allowEdit"
                              />
                            </div>
                          </td>
                          <td>
                            <div class="fieldValueContainerFlexHeight">
                              <SmallTextField
                                v-model="itemVersionRevision"
                                type="number"
                                :readonly="!allowEdit"
                              />
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td>Type</td>
                    <td>
                      {{ itemType }}
                    </td>
                  </tr>
                  <tr>
                    <td>Created at/by</td>
                    <td>
                      {{ createdAtAndBy }}
                    </td>
                  </tr>
                  <tr>
                    <td>Updated at/by</td>
                    <td>
                      {{ updatedAtAndBy }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel
            v-if="expansionPanelFieldsVisible"
            :ref="(el) => { addPanel(el) }"
            data-test="expansionPanelFields"
          >
            <v-expansion-panel-title><b>Fields</b></v-expansion-panel-title>
            <v-expansion-panel-text>
              <FieldsEditor
                :item="item"
                :allow-edit="allowEdit"
                :item-repo="itemRepo"
                :node-name-resolver="nodeNameResolver"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel :ref="(el) => { addPanel(el) }" data-test="expansionPanelUserAttributes">
            <v-expansion-panel-title
              ><b>User attributes</b></v-expansion-panel-title
            >
            <v-expansion-panel-text>
              <UserAttributeEditor
                :item="item"
                :allow-edit="allowEdit"
                :item-repo="itemRepo"
                :node-name-resolver="nodeNameResolver"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel
            v-if="uploadFilesAllowed"
            :ref="(el) => { addPanel(el) }"
            data-test="expansionPanelFile"
          >
            <v-expansion-panel-title><b>File</b></v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-table
                v-if="itemMimeType || itemFileSize"
                density="compact"
                class="fileInfoTable"
              >
                <tbody>
                  <tr>
                    <td>Content Type</td>
                    <td>
                      {{ itemMimeType }}
                    </td>
                  </tr>
                  <tr>
                    <td>Size</td>
                    <td>
                      {{ itemFileSizeString }}
                    </td>
                  </tr>
                  <tr>
                    <td>Original file name</td>
                    <td>
                      {{ itemFilename }}
                    </td>
                  </tr>
                  <tr>
                    <td>SHA-256 Hash</td>
                    <td>
                      {{ itemHash }}
                    </td>
                  </tr>
                  <tr v-if="isPublic">
                    <td>Public Link</td>
                    <td>
                      {{ itemPublicLink }}
                    </td>
                  </tr>
                </tbody>
              </v-table>

              <UploadDropZone
                v-if="allowEdit"
                :post-url="uploadUrl"
                :post-header="uploadHeaders"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel
            v-if="properties.length"
            :ref="(el) => { addPanel(el) }"
            data-test="expansionPanelCalculatedValues"
          >
            <v-expansion-panel-title
              ><b
                >Calculated values ({{ properties.length }})</b
              ></v-expansion-panel-title
            >
            <v-expansion-panel-text>
              <PropertyViewer :properties="properties" />
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel
            v-if="isPublic"
            :ref="(el) => { addPanel(el) }"
            data-test="expansionPanelEmbedding"
          >
            <v-expansion-panel-title
              ><b>Embedding</b></v-expansion-panel-title
            >
            <v-expansion-panel-text>
              <v-col xs12 sm12 md12 pa-1>
                <v-text-field
                  v-model="itemOEmbedLink"
                  label="oEmbed Discoverable Link"
                  readonly
                  append-icon="mdi-content-copy"
                  @click:append="copyOEmbedLink"
                />
              </v-col>
              <v-col xs12 sm12 md12 pa-1>
                <v-text-field
                  v-model="itemViewerLink"
                  label="Viewer Link"
                  readonly
                  append-icon="mdi-content-copy"
                  @click:append="copyViewerLink"
                />
              </v-col>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel :ref="(el) => { addPanel(el) }" data-test="expansionPanelLinkedBy">
            <v-expansion-panel-title
              ><b>Linked by</b></v-expansion-panel-title
            >
            <v-expansion-panel-text>
              <LinkedByList
                :item-id="itemId"
                @open-folder="openFolder"
              ></LinkedByList>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel
            v-if="allowConversation"
            :ref="(el) => { addPanel(el) }"
            data-test="expansionPanelConversation"
          >
            <v-expansion-panel-title
              ><b>Conversation</b></v-expansion-panel-title
            >
            <v-expansion-panel-text>
              <div v-if="conversationAllowedRemotely">
                <Conversation
                  v-if="item"
                  :element="item"
                  element-type="item"
                  :scroll-to-post="scrollToPost"
                  :allow-enable-conversation="allowEdit"
                ></Conversation>
              </div>
              <div v-else>
                <v-alert type="info" border="start">
                  You need to save this item first to activate conversations
                </v-alert>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel :ref="(el) => { addPanel(el) }" data-test="expansionPanelAccessControl">
            <v-expansion-panel-title
              ><b>Access control</b></v-expansion-panel-title
            >
            <v-expansion-panel-text>
              <AclEditor :element="item" :allow-edit="allowEdit"></AclEditor>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!--v-expansion-panel v-if="allowEdit && showHistory" :ref="(el) => { addPanel(el) }" data-test="expansionPanelHistory">
            <v-expansion-panel-title><b>History ({{history.length}})</b></v-expansion-panel-title>
            <v-expansion-panel-text>
              <HistoryViewer :history="history"></HistoryViewer>
            </v-expansion-panel-text>
          </v-expansion-panel-->
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-container>
</template>
<script>

import { watch } from 'vue'
import moment from "moment";

//import HistoryViewer from "./HistoryViewer.vue";
import LinkedByList from "./LinkedByList.vue";
import Conversation from "./Conversation.vue";

import store from "../store";
import permissions from "../modules/permissions";

import {
  UploadDropZone,
  FieldsEditor,
  UserAttributeEditor,
  PropertyViewer,
  AclEditor,
  SmallTextField,
  SmallTextArea,
  SmallSelect,
  SmallCombobox,
  SmallCheckbox,
  UserSelector
} from "@mindcraftgmbh/nukleus-vueui";

export default {
  components: {
    SmallTextField,
    SmallTextArea,
    SmallSelect,
    SmallCombobox,
    SmallCheckbox,
    UploadDropZone,
    UserAttributeEditor,
    FieldsEditor,
    PropertyViewer,
    //HistoryViewer,
    AclEditor,
    LinkedByList,
    Conversation,
    UserSelector
  },

  // --------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------
  filters: {
    formatDate: function (value) {
      return moment(value).format("YYYY-MM-DD hh:mm:ss");
    },
  },

  props: {
    item: {
      type: Object,
    },
    showHistory: {
      type: Boolean,
      default: true,
    },
    showMainProperties: {
      type: Boolean,
      default: true,
    },
    dark: {
      type: Boolean,
      default: false,
    },
    embeddedMode: {
      type: Boolean,
      default: false,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    // ui
    categories: [],
    licenses: [],
    openPanels: [],
    history: [],
    expansionPanels: [],
    conversationAllowedRemotely: false,

    // uploading
    uploadFilesAllowed: false,
    uploadHeaders: {
      "x-access-token": store.state.token,
      "x-request-client": store.state.activeClient,
    },

    // saving modifications
    contributorChanges: null
  }),

  // ------------------------------------------------------------
  // COMPUTED PROPERTIES
  // ------------------------------------------------------------
  computed: {
    itemRepo() {
      return this.$store.state.nkclient.getItemRepo();
    },
    cssClasses: {
      get() {
        if (this.$store.state.darkMode) {
          return "slimForm slimFormDark";
        } else {
          return "slimForm slimFormLight";
        }
      },
    },
    panelMap() {
      let i = 0;
      const map = new Map();
      for (const panel of this.expansionPanels) {
        map.set(panel.$el.attributes["data-test"].nodeValue, i);
        i++;
      }
      return map;
    },
    expansionPanelFieldsVisible() {
      return (
        this.item &&
        this.item.fieldInstances &&
        this.item.fieldInstances.length > 0
      );
    },
    expansionPanelCalculatedValuesVisible() {
      return this.properties.length > 0;
    },
    expansionPanelConversationIndex() {
      const index = this.panelMap.get("expansionPanelConversation");
      return index;
    },
    scrollToPost: {
      get() {
        if (this.$route.query.post) {
          return this.$route.query.post;
        }
        return null;
      },
    },
    conversationSwitchable: {
      get() {
        return (
          this.$store.state.activeClientConversationMode === 2 && this.allowEdit
        );
      },
    },
    allowConversation: {
      get() {
        switch (this.$store.state.activeClientConversationMode) {
          case 0:
            return false; // Always off
          case 1:
            return true; // Always on
          case 2:
            if (this.item) return this.item.allowConversation;
            else return false;
          default:
            console.error(
              "Invalid conversation mode: " +
                this.$store.state.activeClientConversationMode,
            );
            return false;
        }
      },
      set(value) {
        if (this.item) this.item.allowConversation = value;
      },
    },
    itemId() {
      if (this.item) return this.item._id;

      return null;
    },
    uploadUrl() {
      if (this.item) {
        return (
          this.$store.state.nkclient.getApiBaseUrl() +
          "/api/item/upload/" +
          this.item._id
        );
      }

      return "";
    },
    fieldsCount() {
      if (this.item && this.item.fieldInstances.length) {
        return this.item.fieldInstances.length;
      }
      return 0;
    },
    userAttributesCount() {
      if (this.item) return Object.keys(this.item.userAttributes).length;

      return 0;
    },
    allowEdit() {
      if (this.item && this.item.resultingAcl) {
        return permissions.verifyAcl(this.item.resultingAcl, "write");
      }
      return false;
    },
    allowPublish() {
      if (this.item && this.item.resultingAcl) {
        return permissions.verifyAcl(this.item.resultingAcl, "publish");
      }
      return false;
    },
    createdAtAndBy() {
      if (this.item && this.item.createdByUser) {
        return (
          moment(this.item.createdAt).format("YYYY-MM-DD hh:mm:ss") +
          " by " +
          this.item.createdByUser.name
        );
      }
      return "";
    },
    updatedAtAndBy() {
      if (this.item && this.item.updatedByUser) {
        return (
          moment(this.item.updatedAt).format("YYYY-MM-DD hh:mm:ss") +
          " by " +
          this.item.updatedByUser.name
        );
      }
      return "";
    },
    itemName: {
      get: function () {
        if (this.item) {
          return this.item.name;
        }
        return "";
      },
      set: function (value) {
        if (this.item) {
          this.item.name = value;
        }
      },
    },
    itemDescription: {
      get: function () {
        if (this.item) {
          return this.item.description;
        }
        return "";
      },
      set: function (value) {
        if (this.item) {
          this.item.description = value;
        }
      },
    },
    itemShortDescription: {
      get: function () {
        if (this.item) {
          return this.item.shortDescription;
        }
        return "";
      },
      set: function (value) {
        if (this.item) {
          this.item.shortDescription = value;
        }
      },
    },
    itemVersionMajor: {
      get: function () {
        if (this.item && this.item.version) {
          return this.item.version.major || 0;
        }
        return 0;
      },
      set: function (value) {
        if (this.item) {
          this.item.version.major = parseInt(value);
        }
      },
    },
    itemVersionMinor: {
      get: function () {
        if (this.item && this.item.version) {
          return this.item.version.minor || 0;
        }
        return 0;
      },
      set: function (value) {
        if (this.item) {
          this.item.version.minor = parseInt(value);
        }
      },
    },
    itemVersionRevision: {
      get: function () {
        if (this.item && this.item.version) {
          return this.item.version.revision || 1;
        }
        return 0;
      },
      set: function (value) {
        if (this.item) {
          this.item.version.revision = parseInt(value);
        }
      },
    },
    itemTags: {
      get: function () {
        if (this.item) {
          return this.item.tags;
        }
        return "";
      },
      set: function (value) {
        if (this.item) {
          this.item.tags = value;
        }
      },
    },
    itemFlags: {
      get: function () {
        if (this.item) {
          return this.item.flags;
        }
        return "";
      },
      set: function (value) {
        if (this.item) {
          this.item.flags = value;
        }
      },
    },
    itemContributors: {
      get: function () {
        if (this.item) {
          return this.item.contributors || [];
        }
        return "";
      }
    },
    itemCategories: {
      get: function () {
        if (this.item) {
          return this.item.categories || [];
        }
        return "";
      },
      set: function (value) {
        if (this.item) {
          this.item.categories = value;
        }
      },
    },
    itemLicense: {
      get: function () {
        if (this.item) {
          return this.item.license;
        }
        return "";
      },
      set: function (value) {
        if (this.item) {
          this.item.license = value;
        }
      },
    },
    itemType: {
      get: function () {
        if (this.item) {
          return this.item.type;
        }

        return "";
      },
    },
    itemMimeType: {
      get: function () {
        if (this.item) {
          return this.item.mimeType;
        }
        return "";
      },
      set: function (value) {
        if (this.item) {
          this.item.mimeType = value;
        }
      },
    },
    itemFilename: {
      get: function () {
        if (this.item) {
          return this.item.filename;
        }

        return "";
      },
    },
    properties: function () {
      const props = [];
      if (this.item) {
        for (const key in this.item.properties) {
          props.push({ key: key, value: this.item.properties[key] });
        }
      }
      return props;
    },
    itemFileSize: function () {
      if (this.item) {
        return this.item.fileSize;
      }
      return 0;
    },
    itemFileSizeString: function () {
      if (this.item && this.item.filesize) {
        const kb = Math.ceil(this.item.filesize / 1024);
        if (kb < 1024) return kb + " KiB";
        else return Math.ceil((kb / 1024) * 100) / 100 + " MiB";
      } else return "0 KiB";
    },
    itemHash: function () {
      if (this.item && this.item.hash) {
        return this.item.hash;
      }
      return "";
    },
    visibility: {
      get: function () {
        if (this.item) {
          return this.item.visibility;
        }
        return false;
      },
      set: function (value) {
        if (this.item) {
          this.item.visibility = value;
        }
      },
    },
    visibilities: {
      get: function () {
        const result = [
          {
            value: 0,
            title: "Draft",
          },
        ];

        if (this.$store.state.me.features.includes("private_items")) {
          result.push({
            value: 1,
            title: "Private",
          });
          result.push({
            value: 2,
            title: "Not listed",
          });
        }

        if (this.$store.state.activeClientPublicDownloadAllowed) {
          result.push({
            value: 3,
            title: "Public",
          });
        }

        return result;
      },
    },
    isPublic: {
      get: function () {
        if (this.item) {
          return this.item.visibility >= 2;
        }
        return false;
      }
    },
    itemPublicLink: function () {
      if (this.item) {
        return (
          this.$store.state.nkclient.getApiBaseUrl() +
          "/api/item/publicdownload/" +
          this.item._id
        );
      }

      return "";
    },
    itemViewerLink: function () {
      if (this.item) {
        return (
          this.$store.state.nkclient.getViewerBaseUrl() + "/" + this.item._id
        );
      }

      return "";
    },
    itemOEmbedLink: function () {
      if (this.item) {
        return (
          this.$store.state.nkclient.getApiBaseUrl() +
          "/api/item/discover/" +
          this.item._id
        );
      }

      return "";
    },
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  async created() {
    await this.init();

    watch(() => [this.item], () => {
      this.init();
    });
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {

    nodeNameResolver(blockId) {
      return "<unknown node>";
    },

    addPanel(el) {
      this.expansionPanels.push(el);
    },

    openFolder(folderId) {
      this.$emit("open-folder", folderId);
    },

    hasPermission(perm) {
      return permissions.hasPermission(perm);
    },

    async uploadSuccess(result) {
      this.reloadAfterUpload();
    },

    uploadError(error) {
      console.error(error);
      this.$store.commit("setError", error);
      this.reloadAfterUpload();
    },

    async reloadAfterUpload() {
      try {
        if (!this.item) return;

        const itemId = this.item._id;
        let item = await this.$store.state.nkclient.getItemAggregated(itemId);

        this.item.properties = item.properties;
        this.item.filesize = item.filesize;
        this.item.mimeType = item.mimeType;
        this.item.hash = item.hash;

        this.item = Object.assign({}, this.item);

        //if (this.allowEdit) {
        //  this.history = await this.$store.state.nkclient.getItemHistory(this.item._id);
        //}
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async checkUploadsAllowed() {
      const datatypes = await this.$store.state.nkclient.getDatatypesList();
      for (const type of datatypes) {
        if (this.item && this.item.type === type.name) {
          this.fields = type.fields || [];
          if (type.contentTypes && type.contentTypes.length > 0) {
            this.uploadFilesAllowed = true;
            return;
          }
        }
      }

      this.uploadFilesAllowed = false;
    },

    async init() {
      try {
        if (!this.item)
          return;

        await permissions.userAccountInfoReady();

        // Get categories
        // -----------------------------------------------------------
        const categories = await this.$store.state.nkclient.getCategories();
        categories.sort((a, b) => {
          return a.name.localeCompare(b.name);
        });
        this.categories = categories;

        // Get Licenses
        // -----------------------------------------------------------
        const licenses = await this.$store.state.nkclient.getLicenses();
        licenses.sort((a, b) => {
          return a.name.localeCompare(b.name);
        });
        this.licenses = [{ _id: null, name: "None" }, ...licenses];

        this.conversationAllowedRemotely = this.item.allowConversation;

        // Check which panels should be opened
        // -----------------------------------------------------------
        this.openPanels = [];

        if (this.showMainProperties) {
          this.openPanels.push(0);
        }

        if (this.expansionPanelFieldsVisible) {
          if (this.showMainProperties) this.openPanels.push(1);
          else this.openPanels.push(0);
        }

        if (this.allowConversation) {
          this.openPanels.push(this.expansionPanelConversationIndex);
        }

        // Verify version is available
        // -----------------------------------------------------------
        if (!this.item.version) {
          this.item.version = {
            major: 0,
            minor: 0,
            revision: 1
          };
        }

        // Check if uploads are allowed
        // -----------------------------------------------------------
        await this.checkUploadsAllowed();

        // Get history
        // -----------------------------------------------------------
        /*if (this.allowEdit && this.showHistory) {
          // This will take some time to load when history is longer. Do not wait for it.
          this.$store.state.nkclient.getItemHistory(this.item._id).then(function(history) {
            _this.history = history;
          })
        }*/
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async saveAndClose() {
      if (await this.save()) {
        this.$emit("closed");
        this.itemRepo.clear();
        if (!this.embeddedMode) {
          if (this.item.folder)
            this.$router.push("/items/" + this.item.folder._id);
          else
            this.$router.push("/items");
        }
      }
    },

    async save() {
      try {
        this.itemRepo.updateItemLinksAndAttributes();

        const changedContributors = this.getChangedContributors();

        // Send data to server
        // -----------------------------------------------------------
        await this.$store.state.nkclient.updateItem({
          _id: this.item._id,
          name: this.item.name,
          visibility: this.item.visibility,
          type: this.item.type,
          attributes: this.item.attributes,
          userAttributes: this.item.userAttributes,
          links: this.item.links,
          acl: this.item.acl,
          allowConversation: this.item.allowConversation,
          tags: this.item.tags,
          flags: this.item.flags,
          contributors: changedContributors,
          description: this.item.description,
          shortDescription: this.item.shortDescription,
          userAttributeTemplate: this.item.userAttributeTemplate,
          categories: this.item.categories,
          license: this.item.license,
          version: this.item.version
        });

        this.conversationAllowedRemotely = this.item.allowConversation;

        this.$store.commit("setMessage", "Item was saved successfully");
        return true;
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }

      return false;
    },

    cancel() {
      this.$emit("closed");
      this.itemRepo.clear();
      if (!this.embeddedMode) {
        if (window.history.length > 1) this.$router.go(-1);
        else {
          if (this.item.folder)
            this.$router.push("/items/" + this.item.folder._id);
          else this.$router.push("/items");
        }
      }
    },

    async copyOEmbedLink() {
      try {
        await navigator.clipboard.writeText(this.itemOEmbedLink);
        this.$store.commit("setMessage", "Link has been copied to clipboard");
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async copyViewerLink() {
      try {
        await navigator.clipboard.writeText(this.itemViewerLink);
        this.$store.commit("setMessage", "Link has been copied to clipboard");
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    getChangedContributors() {
      if (!this.contributorChanges) {
        return this.itemContributors;
      }

      const {added, removed} = this.contributorChanges;
      const addedIds = added.map(c => c._id);
      const removedIds = removed.map(c => c._id);

      return [...this.itemContributors, ...addedIds].filter(id => !removedIds.includes(id));
    }
  },
};
</script>

<style></style>

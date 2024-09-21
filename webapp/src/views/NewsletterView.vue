<template>
  <v-container fluid>
    <v-card width="100%">
      <v-card-actions>
        <v-btn color="primary" data-test="itemSaveAndCloseButton" @click="saveAndClose" :disabled="!isNewsletterAdmin">
          <font-awesome-icon :icon="['fal', 'save']" size="lg" />
          save & close
        </v-btn>

        <v-btn color="primary" data-test="itemSaveButton" @click="save" :disabled="!isNewsletterAdmin">
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

          <v-col cols="12" sm="6" v-if="isNewsletterAdmin">
            <h4>Editors</h4>
            <UserSelector v-if="editors !== null"
              :set-modified-users="(modifiedUsers) => modifiedEditors = modifiedUsers"
              :initially-selected-user-ids="editors" />
          </v-col>
        </v-row>
      </v-container>
    </v-card>

    <template v-if="isClientAdmin">
      <h1 class="pageTitle">Subscribers</h1>
      <v-card width="100%" style="margin-top: 1rem;">
        <v-container fluid>
          <v-data-table v-model="selected" item-key="_id" density="compact" :headers="headers" return-object
            :items="subscribers" :sort-by="[{ key: 'name', order: 'desc' }]" :footer-props="{
          itemsPerPageOptions: [100, 200, 500],
          options: {
            itemsPerPage: 100,
          },
        }">
            <template #item="props">
              <tr>
                <td class="text-left" style="cursor: pointer; width: 50%">
                  {{ props.item.value.email }}
                </td>
                <td class="text-left" style="white-space: nowrap">
                  {{ formatDate(props.item.value.createdAt) }}
                </td>
              </tr>
            </template>
          </v-data-table>
        </v-container>
      </v-card>
    </template>
  </v-container>
</template>

<script>
import { UserSelector } from '@mindcraftgmbh/nukleus-vueui'
import CreateArticle from "../components/CreateArticle";
import permissions from '@/modules/permissions';
import moment from "moment";
import { nextTick } from 'vue';

export default {
  components: {
    UserSelector,
    CreateArticle
  },
  emits: ["closed"],

  data() {
    return {
      name: "",
      newsletterID: "",
      isPublic: false,
      commentsEnabled: false,
      isOwner: false,
      modifiedEditors: null,
      editors: null,

      subscribers: [],

      // selections
      selected: [],

      // headers for list
      headers: [
        {
          title: "E-Mail",
          key: "email",
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
      showCreateArticleDialog: false,
    }
  },
  mounted: async function () {
    this.newsletterID = this.$route.params.id;
    await this.loadData();
  },

  computed: {
    isNewsletterAdmin: function () {
      return permissions.hasPermission("newsletter_admin");
    },
    isClientAdmin: function () {
      return permissions.hasPermission("client_admin");
    }
  },
  methods: {
    formatDate: function (value) {
      return moment(value).format("YYYY-MM-DD HH:mm:ss");
    },
    async loadData() {
      const newsletter = await this.$store.state.nkclient.getNewsletter(this.newsletterID)

      this.name = newsletter.name;

      // First set the editors to null to trigger the destruction of the UserSelector component.
      // Afterwards load the actual value.
      this.editors = null;
      nextTick(() => {
        this.editors = newsletter.editors;
      });

      this.$store.state.nkclient.eventBus.$emit("breadcrumbUpdate", [{
        name: "Newsletters",
        href: "Newsletters"
      }, {
        name: newsletter.name,
      }]);

      this.subscribers = newsletter.subscribers;
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

      await this.$store.state.nkclient.updateNewsletter(this.newsletterID, this.name, selectedEditors);
      await this.loadData();
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
          this.$router.push("/newsletters");
        }
      }
    },
  },
}
</script>

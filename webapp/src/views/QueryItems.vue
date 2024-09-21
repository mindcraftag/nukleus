<template>
  <v-container fluid grid-list-xl>
    <v-row wrap>
      <v-col d-flex lg12 sm12 xs12>
        <v-card width="100%">
          <v-container fluid grid-list-lg>
            <v-row wrap>
              <v-col xs12>
                <v-form class="searchForm" @submit="sendQuery">
                  <v-container fluid>
                    <v-row wrap>
                      <v-col xs12 sm12 md8>
                        <v-text-field v-model="queryName" label="Name" />
                      </v-col>
                      <v-col xs12 sm12 md4>
                        <v-select
                          v-model="queryState"
                          :items="states"
                          label="State"
                          clearable
                        />
                      </v-col>
                      <v-col xs12 sm12 md8>
                        <v-text-field
                          v-model="queryAttributes"
                          label="Attribute"
                        />
                      </v-col>
                      <v-col xs12 sm12 md4>
                        <v-text-field
                          v-model="queryMimeType"
                          label="Mime type"
                        />
                      </v-col>
                      <v-col xs12 sm12 md12>
                        <v-combobox
                          v-model="queryTypes"
                          :items="itemTypes"
                          chips
                          clearable
                          label="Types"
                          multiple
                        >
                          <template
                            #selection="{ attrs, item, select, selected }"
                          >
                            <v-chip
                              v-bind="attrs"
                              :model-value="selected"
                              closable
                              @click="select"
                              @click:close="removeType(item)"
                            >
                              {{ item }}
                            </v-chip>
                          </template>
                        </v-combobox>
                      </v-col>
                    </v-row>
                    <v-row wrap>
                      <v-col xs12>
                        <v-btn type="submit" color="primary">Search</v-btn>
                      </v-col>
                    </v-row>
                  </v-container>
                </v-form>

                <br />

                <ItemsList
                  :items="queryResult"
                  :job-types="jobTypes"
                  :show-goto-folder-link="true"
                  :allow-jobs="hasPermission('job_create')"
                  :allow-move="hasPermission('item_write')"
                  :allow-delete="hasPermission('item_write')"
                  :allow-edit-item="true"
                  :allow-delete-item="true"
                  :loading="loading"
                >
                </ItemsList>
              </v-col>
            </v-row>
          </v-container>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import permissions from "../modules/permissions";
import ItemsList from "../components/ItemsList.vue";
import {watch} from "vue";

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
      queryName: null,
      queryState: null,
      queryMimeType: null,
      queryAttributes: null,
      queryTypes: null,

      queryResult: [],

      jobTypes: [],
      itemTypes: [],
      states: ["Private", "Public"],
      loading: false,
    };
  },

  // --------------------------------------------------------
  // CREATED
  // --------------------------------------------------------
  created() {
    this.loadManualJobTypes();
    this.loadDatatypes();
    this.queryFromParams();

    watch(() => [this.$route.params.query], () => {
      this.queryFromParams();
    });
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    hasPermission(perm) {
      return permissions.hasPermission(perm);
    },

    removeType(item) {
      this.queryTypes.splice(this.queryTypes.indexOf(item), 1);
      this.queryTypes = [...this.queryTypes];
    },

    queryFromParams() {
      let q = this.$route.params.query;
      if (q) {
        q = q.trim();
        if (q.length) {
          this.queryName = q;
          this.sendQuery();
        }
      }
    },

    async sendQuery(ev) {
      if (ev) {
        ev.preventDefault();
      }

      this.loading = true;
      this.queryResult = [];

      let attribute = null;
      let attributeValue = null;

      if (this.queryAttributes) {
        const parts = this.queryAttributes.split("=");
        if (parts.length === 2) {
          attribute = parts[0];
          attributeValue = parts[1];
        } else {
          this.$store.commit(
            "setError",
            "Attribute field has wrong format. Needs to be 'name=value'",
          );
          return;
        }
      }

      if (!this.queryName) this.queryName = null;

      if (!this.queryAttributes) this.queryAttributes = null;

      if (!this.queryMimeType) this.queryMimeType = null;

      const isPublic =
        this.queryState === "Public"
          ? true
          : this.queryState === "Private"
          ? false
          : undefined;

      const items = await this.$store.state.nkclient.queryItemsList({
        name: this.queryName,
        types: this.queryTypes,
        mimeType: this.queryMimeType,
        public: isPublic,
        attribute: attribute,
        attributeValue: attributeValue,
      });

      for (let item of items) {
        item.isFolder = false;
        item.isEditable = true;
        item.isDeletable = true;
        item.isViewable = item.filesize > 0;
      }

      this.queryResult = items;
      this.loading = false;
    },

    async loadManualJobTypes() {
      try {
        this.jobTypes = await this.$store.state.nkclient.getManualJobTypes();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async loadDatatypes() {
      try {
        this.datatypes = await this.$store.state.nkclient.getDatatypesList();

        this.itemTypes = [];
        for (const type of this.datatypes) {
          this.itemTypes.push(type.name);
        }
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style>
.searchForm .flex {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
</style>

<style></style>

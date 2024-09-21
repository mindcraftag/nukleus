<template>
  <v-text-field
    v-model="searchQuery"
    append-icon="mdi-magnify"
    label="Search"
    single-line
    hide-details
  ></v-text-field>
  <v-progress-linear v-if="loading" indeterminate></v-progress-linear>

  <v-container fluid>
    <v-row>
      <v-col cols="6" md="8" lg="9">

        <v-container ref="scrollContainer" fluid class="scroll-container">
          <v-row>
            <v-col
              v-for="item in items"
              :key="item.id"
              cols="12" md="6" lg="4"
            >
              <v-card style="height: 64px"
                      variant="flat"
                      :color="item === selectedItem ? '#405060' : '#282828'"
                      @click="select(item)">
                <div class="d-flex flex-no-wrap">
                  <div style="min-width: 64px; width: 64px">
                    <ItemThumbnail :size="64" :item="item"></ItemThumbnail>
                  </div>

                  <div class="w-100">
                    <v-card-title class="d-flex justify-space-between flex-no-wrap w-100">
                      <div class="text-h5">
                        {{ item.name }}
                      </div>
                      <div class="text-grey">
                        {{formatSize(item.totalSize)}}
                      </div>
                    </v-card-title>
                    <v-card-subtitle>
                      <ItemUserInfo :item="item" :small="true" />
                    </v-card-subtitle>
                  </div>

                </div>
              </v-card>

            </v-col>
          </v-row>
          <div style="padding-bottom: 100px"></div>
        </v-container>
      </v-col>
      <v-col cols="6" md="4" lg="3">
        <AssetInfo v-if="selectedItem" :item="selectedItem" :preview-index="previewIndex"></AssetInfo>
      </v-col>

    </v-row>
  </v-container>
</template>
<script>

import ItemThumbnail from "../helpers/ItemThumbnail.vue";
import ItemUserInfo from "../helpers/ItemUserInfo.vue";
import AssetInfo from "../helpers/AssetInfo.vue";
import {watch} from "vue";

export default {

  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    ItemThumbnail,
    ItemUserInfo,
    AssetInfo
  },

  // --------------------------------------------------------
  // PROPS
  // --------------------------------------------------------
  props: {
    itemTypes: {
      type: Array,
      default: null
    },
    packageRequired: {
      type: Boolean,
      default: false
    },
    projectFolderId: {
      type: String,
      default: null
    },
    pageSize: {
      type: Number,
      default: 50
    },
    previewIndex: {
      type: Number,
      default: 1
    }
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['selected'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    items: [],
    pageIndex: 0,
    searchQuery: "",
    loading: false,
    noMoreResults: false,
    selectedItem: null
  }),

  // --------------------------------------------------------
  // HOOKS
  // --------------------------------------------------------
  mounted() {
    watch(() => [this.searchQuery], (newValue, oldValue) => {
      if (oldValue[0] !== newValue[0]) {
        this.fetchData(true);
      }
    });

    this.$refs.scrollContainer.$el.addEventListener('scroll', this.handleScroll);
    this.fetchData(true);
  },

  beforeUnmount() {
    this.$refs.scrollContainer.$el.removeEventListener('scroll', this.handleScroll);
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    formatSize: function(value) {
      const units = ['bytes', 'kb', 'MB'];
      let i=0;

      while(true) {
        if (value < 1024 || i===units.length-1) {
          const v = Math.floor(value*100)/100;
          return `${v} ${units[i]}`;
        }
        value /= 1024;
        i++;
      }
    },

    select(item) {
      this.selectedItem = item;
      this.$emit('selected', [item]);
    },

    async fetchData(clear) {
      if (this.loading)
        return;

      if (clear) {
        this.items = [];
        this.noMoreResults = false;
        this.pageIndex = 0;
      }

      if (this.noMoreResults)
        return;

      try {
        this.loading = true;

        const query = {
          fulltext: this.searchQuery,
          types: this.itemTypes,
          withAttachmentInfo: true,
          pageSize: this.pageSize,
          pageIndex: this.pageIndex
        };

        if (this.packageRequired)
          query.onlyPackagedTypes = true;
        else
          query.includePackagedTypes = true;

        const results = await this.$store.state.nkclient.queryItemsList(query);

        if (results.length) {
          this.items = [...this.items, ...results];
          this.pageIndex++;
        } else {
          this.noMoreResults = true;
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }

      this.loading = false;
    },

    handleScroll(event) {
      const container = event.target;
      if (container.scrollHeight - container.scrollTop <= container.clientHeight + 50) {
        this.fetchData();
      }
    }
  }
}

</script>

<style scoped>

.scroll-container {
  max-height: 70vh; /* Adjust the height as necessary */
  overflow-y: auto;
}

</style>

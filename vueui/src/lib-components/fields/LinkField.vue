<template>
  <div
    class="fieldValueContainer"
    @dragover="onDragOver($event)"
    @drop="onDrop($event)"
  >
    <!----------------------------------------------------
      READ / WRITE
    ---------------------------------------------------->
    <div v-if="allowEdit" class="d-flex" style="height: 24px">
      <v-select
        v-model="selectedLink"
        class="linkField"
        :items="linkableItems"
        item-title="name"
        item-key="_id"
        return-object
        density="compact"
        variant="underlined"
        append-icon="mdi-trash-can"
        @update:model-value="$emit('changed')"
        @click:append="modelValue.value = null"
      >
        <template #prepend-inner>
          <ItemThumbnail
            v-if="selectedLink"
            :item="selectedLink"
            :size="20"
            :fetch-size="32"
            icon-size="1x"
            :show-icon-fallback="true"
          />
        </template>
        <template #item="{ item, props: { onClick } }">
          <v-list-item :title="item.title" @click="onClick">
            <template #prepend>
              <ItemThumbnail
                :item="item.raw"
                :size="20"
                :fetch-size="32"
                icon-size="1x"
                :show-icon-fallback="true"
                style="margin-right: 8px"
              />
            </template>
          </v-list-item>
        </template>
      </v-select>
      <v-tooltip v-if="allowEdit && projectFolderId" text="Create a new item" location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon  @click="showItemCreateDialog = true" class="linkFieldOuterAppend" v-bind="props">
            mdi-plus
          </v-icon>
        </template>
      </v-tooltip>
      <v-tooltip v-if="allowEdit" text="Pick an item" location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon @click="pickItem" class="linkFieldOuterAppend" v-bind="props">
            mdi-file-search
          </v-icon>
        </template>
      </v-tooltip>
      <v-tooltip v-if="allowJump && selectedLink" text="Jump to this item" location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon @click="jumpToItem" class="linkFieldOuterAppend" v-bind="props">
            mdi-arrow-right-bold
          </v-icon>
        </template>
      </v-tooltip>
    </div>

    <!----------------------------------------------------
      READ ONLY
    ---------------------------------------------------->
    <div v-else class="d-flex" style="height: 24px">
      <div class="linkReadOnly" @dblclick="jumpToItem">
        {{ selectedLink ? selectedLink.name : "" }}
      </div>

      <v-tooltip v-if="allowJump && selectedLink" text="Jump to this item" location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon @click="jumpToItem" class="linkFieldOuterAppend" v-bind="props">
            mdi-arrow-right-bold
          </v-icon>
        </template>
      </v-tooltip>
    </div>

    <!----------------------------------------------------
          LOADING INDICATOR
        ---------------------------------------------------->

    <v-progress-linear v-if="loading" indeterminate :height="3" color="blue"></v-progress-linear>

    <!----------------------------------------------------
          DIALOGS
        ---------------------------------------------------->

    <ItemPickerDialog
        v-model="showItemPickerDialog"
        :item-types="modelValue.linkableTypes"
        :folder-id="projectFolderId"
        :allow-create="true"
        @item-picked="itemPicked"
    />

    <AssetOrItemPickerDialog
        v-model="showAssetOrItemPickerDialog"
        :item-types="modelValue.linkableTypes"
        :project-folder-id="projectFolderId"
        package-required
        @item-picked="itemPicked"
    ></AssetOrItemPickerDialog>

    <ItemCreator
        v-model="showItemCreateDialog"
        :parent-folder-id="projectFolderId"
        :valid-types="modelValue.linkableTypes"
        @created-item="itemCreated"
    />

  </div>
</template>
<style>

.linkReadOnly {
  height: 24px;
  font-size: 12px;
  padding: 4px;
}

.linkField .v-field__input {
  height: 24px !important;
  max-height: 24px !important;
  min-height: 24px !important;
  font-size: 12px;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.linkField .v-input__append {
  padding: 0 !important;
  padding-top: 2px !important;
  margin: 0 !important;
  max-height: 24px !important;
  min-height: 24px !important;
}

.linkField .v-field__append-inner {
  padding: 0 !important;
  max-height: 24px !important;
  min-height: 24px !important;
}

.linkField .v-field__prepend-inner {
  padding: 0 !important;
  max-height: 24px !important;
  min-height: 24px !important;
}

.linkField .v-select__selection {
  margin: 0 !important;
  height: 24px !important;
}

.linkFieldOuterAppend {
  margin-top: 4px;
}

</style>
<script>

import { watch } from 'vue'
import ItemPickerDialog from '../pickers/ItemPickerDialog.vue'
import ItemThumbnail from '../helpers/ItemThumbnail.vue'
import ItemCreator from '../helpers/ItemCreator.vue'
import { tools } from '@mindcraftgmbh/nukleus-client-api'
import AssetOrItemPickerDialog from "../pickers/AssetOrItemPickerDialog.vue";

export default {

  name: "LinkField",

  // ------------------------------------------------------------
  // COMPONENTS
  // ------------------------------------------------------------
  components: {
    AssetOrItemPickerDialog,
    ItemPickerDialog,
    ItemCreator,
    ItemThumbnail,
  },

  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    linkableTypes: {
      type: Array,
      required: true
    },
    allowEdit: {
      type: Boolean,
    },
    itemRepo: {
      type: Object,
      required: true,
    },
    allowJump: {
      type: Boolean,
      default: false,
    },
    projectFolderId: {
      type: String,
      required: true
    }
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['changed', 'update:model-value'],

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    showItemPickerDialog: false,
    showAssetOrItemPickerDialog: false,
    showItemCreateDialog: false,
    linkableItems: [],
    loading: false
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    selectedLink: {
      get() {
        return this.modelValue.value
      },
      async set(value) {
        if (this.isItemValid(value)) {
          const item = await this.addLinkableItem(value)
          this.modelValue.value = item
        } else {
          console.log(
            'Item type is not valid for this link: ' +
              value.type +
              '. Valid types are: ' +
              this.linkableTypes.join(',')
          )
        }
      },
    },
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  created() {
    watch(() => [this.modelValue], (newValues) => {
      if (newValues[0]) {
        this.loadLinkableItems()
      }
    });

    watch(() => [this.selectedLink], (newValues) => {
      if (newValues[0]) {
        this.addLinkableItem(newValues[0])
      }
    });
  },

  // ------------------------------------------------------------
  // MOUNTED
  // ------------------------------------------------------------
  mounted() {
    this.loadLinkableItems()
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    jumpToItem() {
      if (this.selectedLink)
        this.$store.state.nkclient.eventBus.$emit('nk:jumpToItem', this.selectedLink);
    },

    getItemIcon(item) {
      return tools.getItemIcon(item.type)
    },

    async loadLinkableItems() {
      if (this.modelValue) {
        this.linkableItems = await this.modelValue.linkableItems
        await this.addLinkableItem(this.modelValue.value)
      }
    },

    pickItem() {
      const itemRepo = this.$store.state.nkclient.getItemRepo();
      if (itemRepo.jail.active)
        this.showAssetOrItemPickerDialog = true;
      else
        this.showItemPickerDialog = true;
    },

    itemPicked(item) {
      this.selectedLink = item
      this.$emit('changed')
    },

    async itemCreated(id) {
      try {
        this.loading = true;

        const item = await this.$store.state.nkclient.getItem(id)

        this.itemPicked({
          _id: item._id,
          folderId: item.folder,
          name: item.name,
          type: item.type,
        })
      }
      catch(err) {
        console.error(err);
        this.$store.commit('setError', err.toString());
      }
      finally {
        this.loading = false;
      }
    },

    isItemComplete(item) {
      if (!Array.isArray(item.fields))
        return false

      if (!Array.isArray(item.fieldInstances))
        return false

      return true
    },

    isItemValid(item) {
      if (this.linkableTypes) {
        // The item is valid if it has a linkable type
        if (this.linkableTypes.includes(item.type)) {
          return true
        }

        // Or if it is a Package of a linkable type
        if (
          item.type === 'Package' &&
          this.linkableTypes.includes(item.packageType)
        ) {
          return true
        }

        return false
      }

      return true
    },

    async addLinkableItem(item) {
      if (!item)
          return

      if (typeof item === 'string') {
        // We only have an item ID. Do not load anything
        return;
      }

      try {
        this.loading = true;

        let linkableItems = this.modelValue.linkableItems
        if (linkableItems.then)
          linkableItems = await linkableItems

        for (const linkableItem of linkableItems) {
          if (linkableItem._id === item._id) {
            if (this.isItemComplete(linkableItem)) {
              //console.log("Found complete linkable item");
              return linkableItem
            } else {
              //console.log("Found incomplete linkable item. Removing.");
              linkableItems.removeObject(linkableItem)
              break
            }
          }
        }

        if (!this.isItemComplete(item)) {
          //console.log("Linkable item is incomplete. Load it aggregated...");
          item = await this.itemRepo.loadItemRecursive(item._id, true)
        }

        //console.log("Added new item...");
        linkableItems.push(item)
        this.linkableItems = linkableItems
        return item
      }
      catch(err) {
        console.error(err);
        this.$store.commit('setError', err.toString());
      }
      finally {
        this.loading = false;
      }
    },

    onDragOver(event) {
      event.preventDefault()
    },

    onDrop(event) {
      event.preventDefault()

      const draggedNodes = JSON.parse(event.dataTransfer.getData("draggedNodes"))
      const {id, type, packageType} = draggedNodes[0]

      if (id && type) {
        this.selectedLink = { _id: id, type, packageType }
        this.$emit('changed')
      } else {
        console.log('Invalid item was dropped. Id or type was empty')
      }
    },
  },
}
</script>

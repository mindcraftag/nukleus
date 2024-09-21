<template>
  <Dialog v-model="show" title="Pick asset" width="80%" :persistent="false">
    <template #default>
      <AssetPicker
        ref="itemPicker"
        :item-types="itemTypes"
        :project-folder-id="projectFolderId"
        :preview-index="previewIndex"
        :package-required="packageRequired"
        @selected="onSelectionChanged"
      ></AssetPicker>
    </template>
    <template #actions>
      <v-btn color="primary" :disabled="!selection.length" @click="choose">
        Choose
      </v-btn>
      <v-btn color="normal" @click="close">
        Cancel
      </v-btn>
    </template>
  </Dialog>
</template>
<script>

import AssetPicker from "./AssetPicker.vue";
import Dialog from "../wrappers/Dialog.vue";

export default {
  components: {
    AssetPicker,
    Dialog
  },

  // --------------------------------------------------------------------
  // PROPS
  // --------------------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean,
    },
    itemTypes: {
      type: Array,
    },
    projectFolderId: {
      type: String,
    },
    packageRequired: {
      type: Boolean,
      default: false
    },
    allowCreate: {
      type: Boolean,
      default: false,
    },
    previewIndex: {
      type: Number,
      default: 1
    }
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'item-picked'],

  // --------------------------------------------------------------------
  // DATA
  // --------------------------------------------------------------------
  data: () => ({
    selection: [],
    createInFolder: null,
    createInFolderId: null,
    showCreateItemDialog: false
  }),

  // --------------------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------------------
  computed: {
    show: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      },
    },
  },

  // --------------------------------------------------------------------
  // METHODS
  // --------------------------------------------------------------------
  methods: {

    async choose() {
      this.$emit('item-picked', this.selection[0])
      this.close()
    },

    onSelectionChanged(selection) {
      this.selection = selection;

      if (this.selection.length) {
        if (this.selection[0].createNew) {
          const item = this.selection[0]
          this.createInFolder = item.parent
          this.createInFolderId = item.parent._id
          this.showCreateItemDialog = true
        }
      }
    },

    itemCreated() {
      this.loadChildren(this.createInFolder)
    },

    close() {
      this.show = false
    },
  },
}
</script>

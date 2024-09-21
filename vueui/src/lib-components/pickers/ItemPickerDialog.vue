<template>
  <Dialog v-model="show" title="Pick item">
    <template #default>
      <div style="max-height: 60vh; overflow: auto">
        <ItemPicker
            ref="itemPicker"
            :folder-id="folderId"
            :item-types="itemTypes"
            :allow-create="allowCreate"
            @selected="onSelectionChanged"
        ></ItemPicker>
      </div>
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

  <ItemCreator
      v-model="showCreateItemDialog"
      :parent-folder-id="createInFolderId"
      :valid-types="itemTypes"
      @created-item="itemCreated"
  />
</template>
<script>

import { watch } from 'vue'
import ItemCreator from '../helpers/ItemCreator.vue'
import ItemPicker from "./ItemPicker.vue";
import Dialog from "../wrappers/Dialog.vue";

export default {
  components: {
    ItemPicker,
    ItemCreator,
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
    folderId: {
      type: String,
    },
    allowCreate: {
      type: Boolean,
      default: false,
    },
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
  // CREATED
  // --------------------------------------------------------------------
  created() {
    watch(() => [this.modelValue], (newValues) => {
      if (newValues[0] && this.$refs.itemPicker) {
        this.$refs.itemPicker.reloadFolderHierarchy()
      }
    });
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

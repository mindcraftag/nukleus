<template>
  <Dialog v-model="show" title="Pick folder" max-width="500px">
    <template #default>
      <div style="max-height: 60vh; overflow: auto">
        <FolderPicker :multiselect="multiselect" ref="folderPicker" :folder-id="folderId"  @selected="onSelectionChanged"></FolderPicker>
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
</template>

<style></style>

<script>

import { watch } from 'vue'
import Dialog from '../wrappers/Dialog.vue'
import FolderPicker from "./FolderPicker.vue";

export default {

  components: {
    FolderPicker,
    Dialog
  },

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean,
    },
    folderId: {
      type: String,
    },
    multiselect: {
      type: Boolean,
      default: false,
    }
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'folder-picked'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    selection: []
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    show: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      },
    }
  },

  // --------------------------------------------------------
  // CREATED
  // --------------------------------------------------------
  created() {
    watch(() => [this.modelValue], (newValues) => {
      if (newValues[0] === true && this.$refs.folderPicker) {
        this.$refs.folderPicker.reloadFolderHierarchy();
      }
    });
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    onSelectionChanged(selection) {
      this.selection = selection;
    },

    async choose() {
      this.$emit('folder-picked', this.selection)
      this.close()
    },

    close() {
      this.show = false
    },
  },
}
</script>

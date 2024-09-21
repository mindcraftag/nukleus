<template>
  <Dialog v-model="show" title="Move to folder">
    <template #default>
      <div style="max-height: 80vh; overflow: auto">
        <FolderPicker ref="folderPicker" @selected="onSelectionChanged" />
      </div>
    </template>
    <template #actions>
      <v-btn color="primary" :disabled="!selected.length" @click="move">
        Move
      </v-btn>
      <v-btn color="normal" @click="close">
        Cancel
      </v-btn>
    </template>
  </Dialog>
</template>

<style></style>

<script>

import {watch} from "vue";
import Dialog from "../wrappers/Dialog.vue";
import FolderPicker from "../pickers/FolderPicker.vue";

export default {

  components: {
    FolderPicker,
    Dialog
  },

  // --------------------------------------------------------
  // PROPS
  // --------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean,
    },
    selectedElements: {
      type: Array,
    },
    folderId: {
      type: String,
    },
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'success'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    selected: []
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
    },
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
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
      this.selected = selection;
    },

    async move() {
      try {
        const destFolder = this.selected[0]._id
        const items = []
        const folders = []

        for (const element of this.selectedElements) {
          if (element.isFolder) folders.push(element._id)
          else items.push(element._id)
        }

        if (items.length) {
          await this.$store.state.nkclient.moveItems({
            items: items,
            dest: destFolder,
          })
        }

        if (folders.length) {
          await this.$store.state.nkclient.moveFolders({
            folders: folders,
            dest: destFolder,
          })
        }

        this.$emit('success')
        this.close()
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }
    },
    close() {
      this.show = false
    },
  },
}
</script>

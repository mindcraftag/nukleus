<template>
  <Dialog v-model="show" title="Edit folder" max-width="500px">
    <template #default>
      <v-text-field
          v-model="name"
          :counter="50"
          label="Name"
          density="compact"
          required
      ></v-text-field>

      <AclEditor :element="folder" :allow-edit="true"></AclEditor>
    </template>

    <template #actions>
      <v-btn color="primary" @click="submit">
        <v-icon>mdi-content-save</v-icon>
        save
      </v-btn>
      <v-btn @click="close">
        <v-icon>mdi-close</v-icon>
        close
      </v-btn>
    </template>
  </Dialog>
</template>

<script>

import { watch } from 'vue';
import AclEditor from '../viewers/AclEditor.vue'
import Dialog from "../wrappers/Dialog.vue";

export default {

  components: {
    AclEditor,
    Dialog
  },

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: Boolean,
    folderId: String,
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'updated-folder', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    folder: null,
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
    name: {
      get() {
        if (this.folder) {
          return this.folder.name
        }
        return ''
      },
      set(value) {
        if (this.folder) {
          this.folder.name = value
        }
      },
    },
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  created() {
    watch(() => [this.modelValue], async (newValues) => {
      if (newValues[0] === true) {
        await this.loadFolder()
      }
    });
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async loadFolder() {
      try {
        this.folder = await this.$store.state.nkclient.getFolder(this.folderId)
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }
    },

    async submit() {
      try {
        await this.$store.state.nkclient.updateFolder(this.folder)
        this.close()
        this.$emit('updated-folder')
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }
    },

    close() {
      this.show = false
      this.$emit('closed')
    },
  },
}
</script>

<style></style>

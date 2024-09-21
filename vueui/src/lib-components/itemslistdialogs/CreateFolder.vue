<template>
  <Dialog v-model="show" title="Create folder" max-width="500px">
    <template #default>
      <v-text-field
          v-model="name"
          data-test="nameTextField"
          label="Name"
          density="compact"
          required
          :autofocus="true"
          @keydown="keydown"
      ></v-text-field>

      <v-checkbox
          v-model="enterFolder"
          density="compact"
          data-test="enterFolderCheckbox"
          label="Enter folder"
      ></v-checkbox>
    </template>

    <template #actions>
      <v-btn
          data-test="submitCreateFolder"
          color="primary"
          @click="submit"
      >
        <v-icon>mdi-content-save</v-icon>
        save
      </v-btn>
      <v-btn data-test="cancelCreateFolder" @click="close">
        <v-icon>mdi-close</v-icon>
        close
      </v-btn>
    </template>
  </Dialog>
</template>

<script>

import { watch } from 'vue';
import Dialog from "../wrappers/Dialog.vue";

export default {

  components: {
    Dialog
  },

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean,
    },
    parentFolderId: {
      type: String,
      default: null,
    },
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'created-folder', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    name: '',
    enterFolder: false,
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
      if (newValues[0] === true) {
        this.name = ''
      }
    });
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    keydown(event) {
      if (event.key === 'Enter') {
        this.submit()
      }
    },
    async submit() {
      try {
        const id = await this.$store.state.nkclient.createFolder({
          name: this.name,
          parent: this.parentFolderId || null,
        })

        this.close()
        this.$emit('created-folder', id, this.enterFolder)
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

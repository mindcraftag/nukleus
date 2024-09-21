<template>
  <Dialog v-model="show" title="Create group" max-width="500px">
    <template #default>
      <v-text-field
          v-model="name"
          label="Name"
          required
          density="compact"
          @keydown="keydown"
      ></v-text-field>

      <v-checkbox
          v-model="hasFolder"
          label="Has folder"
          density="compact"
      ></v-checkbox>
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

import { Dialog } from '@mindcraftgmbh/nukleus-vueui'
import { watch } from 'vue'

export default {

  components: {
    Dialog
  },

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: Boolean,
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'created-group', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    name: "",
    hasFolder: false,
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    show: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
  },

  // --------------------------------------------------------
  // CREATED
  // --------------------------------------------------------
  created() {
    watch(() => [this.modelValue], (newValues) => {
      if (newValues[0]) {
        this.name = "";
      }
    });
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    keydown(event) {
      if (event.key === "Enter") {
        this.submit();
      }
    },
    async submit() {
      try {
        const id = await this.$store.state.nkclient.createGroup({
          name: this.name,
          hasFolder: this.hasFolder,
        });

        this.close();
        this.$emit("created-group");
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    close() {
      this.show = false;
      this.$emit("closed");
    },
  },
};
</script>

<style></style>

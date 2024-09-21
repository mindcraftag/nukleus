<template>
  <DialogElement v-model="show" title="Create Newsletter" max-width="500px">

    <template #default>
      <v-text-field v-model="name" data-test="nameTextField" label="Name" density="compact" required
        autofocus></v-text-field>

      <span>Editors</span>
      <UserSelector :set-modified-users="(modifiedUsers) => selectedEditors = modifiedUsers"
        :initially-selected-user-ids="[]" />
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

  </DialogElement>
</template>

<script>

import { Dialog as DialogElement, UserSelector } from '@mindcraftgmbh/nukleus-vueui'
import { watch } from 'vue'

export default {

  components: {
    DialogElement,
    UserSelector
  },

  props: {
    modelValue: Boolean,
  },

  emits: ['update:modelValue', 'created', 'closed'],

  data: () => ({
    name: "",
    selectedEditors: null
  }),

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

  created() {
    watch(() => [this.modelValue], (newValues) => {
      if (newValues[0]) {
        this.name = "";
      }
    });
  },

  methods: {
    keydown(event) {
      if (event.key === "Enter") {
        this.submit();
      }
    },
    async submit() {
      const editors = this.selectedEditors ? (this.selectedEditors.added.map(u => u._id)) : [];

      try {
        await this.$store.state.nkclient.createNewsletter(
          this.name,
          editors
        );

        this.close();
        this.$emit("created");
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

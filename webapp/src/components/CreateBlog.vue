<template>
  <DialogElement v-model="show" title="Create Blog" max-width="500px">

    <template #default>
      <v-text-field
          v-model="name"
          data-test="nameTextField"
          label="Name"
          density="compact"
          required
          autofocus
      ></v-text-field>

      <v-checkbox
          v-model="commentsEnabled"
          data-test="commentsEnabledCheckboxField"
          label="Comments Enabled"
          density="compact"
          required
          ></v-checkbox>
      <v-checkbox
          v-model="isPublic"
          data-test="publicCheckboxField"
          label="Public"
          density="compact"
          required
          ></v-checkbox>

      <span>Editors</span>
      <UserSelector
        :set-modified-users="(modifiedUsers) => selectedEditors = modifiedUsers"
        :initially-selected-user-ids="[]"
      />
    </template>

    <template #actions>
      <v-btn
          data-test="submitCreateBlog"
          color="primary"
          @click="submit"
      >
        <v-icon>mdi-content-save</v-icon>
        save
      </v-btn>
      <v-btn data-test="cancelCreateBlog" @click="close">
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
    isPublic: false,
    commentsEnabled: false,
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
        await this.$store.state.nkclient.createBlog(
          this.name,
          this.isPublic,
          this.commentsEnabled,
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

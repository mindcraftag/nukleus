<template>
  <DialogElement v-model="show" title="Create Page" max-width="500px">

    <template #default>
      <v-text-field v-model="title" data-test="nameTextField" label="Title" density="compact" required
        autofocus></v-text-field>
      <v-text-field v-model="slug" data-test="nameTextField" label="Slug" density="compact" required
        ></v-text-field>
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

import { Dialog as DialogElement } from '@mindcraftgmbh/nukleus-vueui'
import { watch } from 'vue'

export default {

  components: {
    DialogElement,
  },

  props: {
    modelValue: Boolean,
  },

  emits: ['update:modelValue', 'created', 'closed'],

  data: () => ({
    title: "",
    slug: "",
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
      // Reset the form when the dialog is opened.
      if (newValues[0]) {
        this.title = "";
        this.slug = "";
      }
    });
  },

  methods: {
    async submit() {
      try {
        await this.$store.state.nkclient.createPage(
          this.title,
          this.slug,
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

<template>
  <DialogElement v-model="show" title="Create Article" max-width="500px">

    <template #default>
      <v-text-field
          v-model="name"
          data-test="nameTextField"
          label="Title"
          density="compact"
          required
          autofocus
      ></v-text-field>
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

import { Dialog as DialogElement } from '@mindcraftgmbh/nukleus-vueui'
import { watch } from 'vue'

export default {

  components: {
    DialogElement,
  },

  props: {
    modelValue: Boolean,
    blogID: String,
  },

  emits: ['update:modelValue', 'created', 'closed'],

  data: () => ({
    name: "",
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
      try {
        await this.$store.state.nkclient.createArticle(
          this.blogID,
          this.name,
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

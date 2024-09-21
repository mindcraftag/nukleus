<template>
  <Dialog v-model="show" title="Create attribute template" max-width="500px">

    <template #default>
      <v-text-field
          v-model="name"
          data-test="nameTextField"
          label="Name"
          density="compact"
          required
          autofocus
          @keydown="keydown"
      ></v-text-field>
    </template>

    <template #actions>
      <v-btn
          data-test="submitCreateAttributeTemplate"
          color="primary"
          @click="submit"
      >
        <v-icon>mdi-content-save</v-icon>
        save
      </v-btn>
      <v-btn data-test="cancelCreateAttributeTemplate" @click="close">
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
  emits: ['update:modelValue', 'created', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    name: "",
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
        const id = await this.$store.state.nkclient.createAttributeTemplate({
          name: this.name,
        });

        this.close();
        this.$emit("created", id);
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

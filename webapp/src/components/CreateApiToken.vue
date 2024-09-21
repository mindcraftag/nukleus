<template>
  <Dialog v-model="show" :title="`Create ${type === 'api' ? 'API' : 'Access'} token`" max-width="500px">
    <template #default>
      <v-text-field
          v-model="name"
          label="Name"
          required
          @keydown="keydown"
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
  </Dialog>
</template>

<script>

import { watch } from 'vue'
import { Dialog } from "@mindcraftgmbh/nukleus-vueui";

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
      required: true,
    },
    type: {
      type: String,
      required: true,
      validator: function (value) {
        return ["api", "access"].includes(value);
      },
    },
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'created-token', 'closed'],

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
        null;
        this.submit();
      }
    },
    async submit() {
      try {
        if (this.type === "api") {
          await this.$store.state.nkclient.createApiToken({
            name: this.name,
          });
        } else {
          await this.$store.state.nkclient.createClientAccessToken({
            name: this.name,
          });
        }

        this.close();
        this.$emit("created-token");
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

<template>
  <Dialog v-model="show" :title="`Set attribute on ${count} items`">

    <template #default>
      <v-text-field
          v-model="attributeName"
          data-test="attributeName"
          label="Name"
          required
          autofocus
      ></v-text-field>
      <v-text-field
          v-model="attributeValue"
          data-test="attributeValue"
          label="Value"
          required
      ></v-text-field>
    </template>

    <template #actions>
      <v-btn color="primary" @click="save">Save</v-btn>
      <v-btn color="normal" @click="close">Cancel</v-btn>
    </template>

  </Dialog>
</template>

<script>

import { watch } from 'vue'
import { Dialog } from '@mindcraftgmbh/nukleus-vueui'

export default {
  components: {
    Dialog
  },
  props: {
    modelValue: Boolean,
    selectedElements: Array,
  },
  emits: ['update:modelValue', 'success'],
  data: () => ({
    attributeValue: "",
    attributeName: "",
  }),
  computed: {
    count: {
      get() {
        let count = 0;
        for (const element of this.selectedElements) {
          if (!element.isFolder) count++;
        }
        return count;
      },
    },
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
        this.attributeName = "";
        this.attributeValue = "";
      }
    });
  },
  methods: {
    async save() {
      try {
        const ids = [];
        for (const element of this.selectedElements) {
          if (!element.isFolder) {
            ids.push(element._id);
          }
        }

        if (ids.length) {
          const name = this.attributeName.trim();
          const value = this.attributeValue.trim();

          if (!name.length) {
            this.$store.commit("setError", "Name is empty!");
            return;
          }

          if (!value.length) {
            this.$store.commit("setError", "Value is empty!");
            return;
          }

          const attributes = {};
          attributes[name] = value;
          await this.$store.state.nkclient.setAttributes(ids, attributes);
        }

        this.$emit("success");
        this.$store.commit("setMessage", "Attributes written successfully");
        this.close();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    close() {
      this.show = false;
    },
  },
};
</script>

<style></style>

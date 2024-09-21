<template>

  <Dialog v-model="show" :title="title" max-width="500px">
    <template #default>
      {{message}}
    </template>

    <template #actions>
      <v-btn color="primary" @click="okay">
        {{okayText}}
      </v-btn>

      <v-btn v-if="showCancel" @click="cancel">
        {{cancelText}}
      </v-btn>
    </template>
  </Dialog>

</template>
<script>

import Dialog from './Dialog.vue';
import { createApp } from "vue";

const MessageBox = {

  components: {
    Dialog
  },

  props: {
    modelValue: {
      type: Boolean
    },
    title: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: ""
    },
    okayText: {
      type: String,
      default: "OK"
    },
    cancelText: {
      type: String,
      default: "Cancel"
    },
    showCancel: {
      type: Boolean,
      default: false
    }
  },

  emits: ['update:modelValue', 'okay', 'canceled'],

  computed: {
    show: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      }
    }
  },

  methods: {
    okay() {
      this.$emit('okay');
      this.show = false;
    },

    cancel() {
      this.$emit('canceled');
      this.show = false;
    }
  }
}

export default MessageBox;

function createMessageBox(title, message, options) {

  const tempDiv = document.createElement('div');
  const instance = createApp(MessageBox);

  instance.title = title;
  instance.message = message;
  instance.modelValue = true;

  instance.mount(tempDiv);

  document.body.appendChild(instance.$el);
}

export { createMessageBox };

</script>

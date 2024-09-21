<template>
  <div>
    <v-list v-if="allowConversation">
      <ConversationEntry
        v-for="entry in entries"
        :key="entry._id"
        :entry="entry"
        :scroll-to-post="scrollToPost"
        @post="postMessage"
        @deleted="reload"
      >
      </ConversationEntry>
    </v-list>
    <ConversationEntry @post="postMessage"></ConversationEntry>
    <div class="conversationSubscribedState">
      You are{{ !isSubscribed ? " not " : " " }} subscribed to this
      conversation.

      <v-btn variant="flat" @click="toggleSubscription">
        {{ isSubscribed ? "Unsubscribe" : "Subscribe" }}
      </v-btn>
    </div>
  </div>
</template>

<script>

import { watch } from 'vue'
import ConversationEntry from "./ConversationEntry";

export default {
  components: {
    ConversationEntry,
  },

  props: {
    element: {
      type: Object,
      required: true,
    },
    elementType: {
      type: String,
      required: true,
    },
    allowEnableConversation: {
      type: Boolean,
      default: false,
    },
    scrollToPost: {
      type: String,
      required: false,
    },
  },

  data: () => ({
    conversationId: null,
    isSubscribed: false,
    entries: [],
  }),

  computed: {
    allowConversation: {
      get() {
        switch (this.$store.state.activeClientConversationMode) {
          case 0:
            return false; // Always off
          case 1:
            return true; // Always on
          case 2:
            return !!this.element.allowConversation;
          default:
            console.error(
              "Invalid conversation mode: " +
                this.$store.state.activeClientConversationMode,
            );
            return false;
        }
      },
    },
  },

  created() {
    watch(() => [this.element], () => {
      this.init();
    });
  },

  mounted() {
    this.init();
  },

  methods: {
    async postMessage(text, parent) {
      try {
        await this.ensureConversation();
        if (this.conversationId) {
          await this.$store.state.nkclient.postConversationMessage(
            this.conversationId,
            text,
            parent ? parent._id : undefined,
          );
          await this.reload();
        }
      } catch (err) {
        console.log(err);
        this.$store.commit("setError", err.toString());
      }
    },
    async ensureConversation() {
      try {
        if (!this.conversationId)
          this.conversationId =
            await this.$store.state.nkclient.createConversation(
              this.element._id,
              "item",
            );
      } catch (err) {
        console.log(err);
        this.$store.commit("setError", err.toString());
      }
    },
    async toggleSubscription() {
      try {
        if (this.isSubscribed) {
          const r =
            await this.$store.state.nkclient.unsubscribeFromConversation(
              this.conversationId,
            );
          console.log(r);
        } else {
          const r = await this.$store.state.nkclient.subscribeToConversation(
            this.conversationId,
          );
          console.log(r);
        }

        this.isSubscribed = !this.isSubscribed;
      } catch (err) {
        console.log(err);
        this.$store.commit("setError", err.toString());
      }
    },
    async reload() {
      if (this.conversationId) {
        const conversation = await this.$store.state.nkclient.getConversation(
          this.conversationId,
        );
        const hierarchy = [];
        const map = new Map();
        this.isSubscribed = conversation.conversation.subscribed;

        for (const entry of conversation.entries) {
          entry.children = [];

          if (!entry.replyTo) {
            hierarchy.push(entry);
          } else {
            const parent = map.get(entry.replyTo);
            if (parent) {
              parent.children.push(entry);
            } else {
              console.error(
                "Parent conversation entry not found! " + entry.replyTo,
              );
            }
          }

          map.set(entry._id, entry);
        }

        this.entries = hierarchy;
      }
    },
    async init() {
      try {
        this.conversationId = this.element.conversation;
        await this.reload();
      } catch (err) {
        console.log(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style scoped>

.conversationSubscribedState {
  display: flex;
  align-items: center;
  padding-left: 6.7rem;
  margin-top: 0.3rem;
}

.conversationSubscribedState > button {
  height: 20px !important;
  margin-left: 1rem;
}
</style>

<template>
  <v-list-item ref="listItem">
    <template #prepend>
      <Avatar
          v-if="avatarUserId !== null"
          :user-id="avatarUserId"
          :size="32"
      ></Avatar>
    </template>
    <div v-if="entry">
      <v-list-item-title>
        {{ entry.createdBy.name }} - {{ formatDate(entry.createdAt) }}
        <v-btn icon size="small" @click="showReply = !showReply">
          <font-awesome-icon :icon="['fal', 'reply']" />
        </v-btn>
        <v-btn v-if="mayEdit" icon size="small" @click="editPost">
          <font-awesome-icon :icon="['fal', 'edit']" />
        </v-btn>
        <v-btn v-if="mayDelete" icon size="small" @click="deletePost">
          <font-awesome-icon :icon="['fal', 'trash']" />
        </v-btn>
      </v-list-item-title>
      <v-list-item-subtitle>
        <div v-if="editMode">
          <v-textarea
            v-model="message"
            auto-grow
            variant="outlined"
            hide-details
            rows="3"
          ></v-textarea>
          <v-btn :disabled="messageEmpty" @click="saveChanges">
            Save changes
          </v-btn>
          <v-btn @click="editMode = false"> Cancel </v-btn>
        </div>
        <div v-else>
          {{ entry.text }}
        </div>
      </v-list-item-subtitle>
      <div v-if="showReply">
        <ConversationEntry
          :parent="entry"
          @post="propagatePostMessage"
        ></ConversationEntry>
      </div>
      <v-list v-if="entry.children.length">
        <ConversationEntry
          v-for="child in entry.children"
          :key="child._id"
          :entry="child"
          @post="propagatePostMessage"
          @deleted="$emit('deleted')"
        ></ConversationEntry>
      </v-list>

      <v-dialog v-model="showDeletePostDialog" persistent max-width="290">
        <v-card>
          <v-card-title class="text-h5">Delete post?</v-card-title>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="red-darken-1"
              variant="text"
              data-test="confirmDeleteButton"
              @click="confirmDeletePost"
              >Delete</v-btn
            >
            <v-btn
              color="green-darken-1"
              variant="text"
              data-test="cancelDeleteButton"
              @click="showDeletePostDialog = false"
              >Cancel</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
    <div v-else>
      <v-textarea
        v-model="message"
        auto-grow
        variant="outlined"
        hide-details
        rows="3"
      ></v-textarea>
      <v-btn :disabled="messageEmpty" @click="postMessage"> Post </v-btn>
    </div>
  </v-list-item>
</template>
<script>
import Avatar from "./Avatar";
import moment from "moment";

export default {
  name: "ConversationEntry",

  components: {
    Avatar,
  },

  props: {
    entry: {
      type: Object,
    },
    parent: {
      type: Object,
    },
    scrollToPost: {
      type: String,
      required: false,
    },
  },

  data: () => ({
    message: "",
    showReply: false,
    editMode: false,
    showDeletePostDialog: false,
  }),

  computed: {
    messageEmpty() {
      return this.message.trim().length === 0;
    },
    mayDelete() {
      return this.isMyPost && !this.hasChildren;
    },
    mayEdit() {
      return this.isMyPost;
    },
    hasChildren() {
      return this.entry && this.entry.children.length > 0;
    },
    isMyPost() {
      return this.entry && this.entry.createdBy._id === this.myUserId;
    },
    avatarUserId() {
      if (this.entry) return this.entry.createdBy._id;
      else return this.myUserId;
    },
    myUserId() {
      const me = this.$store.state.me;

      if (me) {
        return me._id;
      }

      return null;
    },
  },

  mounted() {
    this.init();
  },

  methods: {
    formatDate: function (value) {
      if (!value) return "<no date>";

      return moment(value).format("YYYY-MM-DD HH:mm:ss");
    },
    init() {
      const _this = this;
      if (
        this.entry &&
        this.scrollToPost &&
        this.scrollToPost === this.entry._id
      ) {
        setTimeout(function () {
          _this.$refs.listItem.$el.scrollIntoView();
        }, 1000);
      }
    },
    editPost() {
      if (this.editMode) {
        this.editMode = false;
      } else {
        this.editMode = true;
        this.message = this.entry.text;
      }
    },
    async saveChanges() {
      try {
        const text = this.message.trim();
        await this.$store.state.nkclient.editConversationMessage(
          this.entry._id,
          text,
        );
        this.entry.text = this.message;
        this.message = "";
        this.editMode = false;
      } catch (err) {
        console.log(err);
        this.$store.commit("setError", err.toString());
      }
    },
    deletePost() {
      this.showDeletePostDialog = true;
    },
    async confirmDeletePost() {
      try {
        await this.$store.state.nkclient.deleteConversationMessage(
          this.entry._id,
        );
        this.showDeletePostDialog = false;
        this.$emit("deleted");
      } catch (err) {
        console.log(err);
        this.$store.commit("setError", err.toString());
      }
    },
    propagatePostMessage(text, parent) {
      this.$emit("post", text, parent);
      this.showReply = false;
    },
    postMessage() {
      this.$emit("post", this.message.trim(), this.parent);
      this.message = "";
    },
  },
};
</script>

<template>
  <div>
    {{ message }}
  </div>
</template>
<script>
export default {
  data: () => ({
    message: "Opening conversation...",
  }),

  async created() {
    const conversationId = this.$route.params.conversationId;
    const conversationEntryId = this.$route.params.conversationEntryId;

    try {
      const result =
        await this.$store.state.nkclient.getConversation(conversationId);
      const conversation = result.conversation;

      switch (conversation.parentType) {
        case "item": {
          this.$router.push({
            name: "EditItem",
            params: {
              id: conversation.parent,
            },
            query: {
              post: conversationEntryId,
            },
          });
          break;
        }
        default: {
          throw "Unknown parent type: " + conversation.parentType;
        }
      }
    } catch (err) {
      console.error(err);
      this.message = err.toString();
    }
  },
};
</script>

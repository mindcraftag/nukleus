<template>
  <v-container fluid>
    <v-card width="100%">
      <v-card-actions>
        <v-btn color="primary" data-test="itemSaveAndCloseButton" @click="saveAndClose">
          <font-awesome-icon :icon="['fal', 'save']" size="lg" />
          save & close
        </v-btn>

        <v-btn color="primary" data-test="itemSaveButton" @click="save">
          <font-awesome-icon :icon="['fal', 'save']" size="lg" />
          save
        </v-btn>

        <v-btn data-test="itemCloseButton" @click="close">
          <font-awesome-icon :icon="['fal', 'times']" size="lg" />
          close
        </v-btn>

      </v-card-actions>
    </v-card>

    <v-card width="100%" style="margin-top: 1rem;">
      <v-container fluid>
        <v-row class="content">

          <v-col cols="12">
            <v-text-field v-model="title" label="Title" density="compact"></v-text-field>
          </v-col>
          <v-col cols="12">
            <v-text-field v-model="tags" label="Tags (comma separated)" density="compact"></v-text-field>
          </v-col>
          <v-col cols="12" sm="4" class="d-flex align-center">
            <v-checkbox v-model="isPublic" label="Public" density="compact" hide-details="auto"></v-checkbox>
          </v-col>
          <v-col v-if="isOwner" cols="12" sm="8" class="d-flex flex-column">
            <div>
              <span>Author</span>
              <span v-if="newAuthors.length > 1" class="ml-5 text-red">You must select exactly one author!</span>
            </div>
            <UserSelector v-if="authors !== null"
              :set-modified-users="(modifiedUsers) => modifiedAuthors = modifiedUsers"
              :initially-selected-user-ids="authors" />
          </v-col>
          <v-col v-else cols="12" sm="8" class="d-flex flex-column">
            <div>
              <span>Author</span>
            </div>
            <span>{{ authorName }}</span>
          </v-col>
        </v-row>
      </v-container>
    </v-card>

    <h1 class="pageTitle">Content</h1>
    <v-card width="100%" style="margin-top: 1rem;">
      <v-container fluid>
        <v-row class="content">

          <v-col cols="12">
            <MonacoEditor v-model:value="content" theme="vs-dark" :options="options" :height="1080"
              language="xml"></MonacoEditor>
          </v-col>
        </v-row>
      </v-container>
    </v-card>

  </v-container>
</template>

<script>
import { UserSelector } from '@mindcraftgmbh/nukleus-vueui'
import MonacoEditor from 'monaco-editor-vue3';


export default {
  components: {
    UserSelector, MonacoEditor
  },
  emits: ["closed"],

  data() {
    return {
      blogID: "",
      articleID: "",
      title: "hi",
      tags: "",
      content: "",
      isPublic: false,
      isOwner: false,
      authorName: "",

      modifiedAuthors: null,
      authors: null,


      options: {
        colorDecorators: true,
        lineHeight: 16 * 1.4,
        tabSize: 2,
      },
    }
  },
  computed: {
    newAuthors: function () {
      if (this.modifiedAuthors === null) {
        return this.authors ?? [];
      }

      const removedUsers = this.modifiedAuthors.removed.map(u => u._id);
      const prevAuthors = [...this.authors].filter(userID => removedUsers.includes(userID));
      for (const user of this.modifiedAuthors.added) {
        prevAuthors.push(user._id);
      }
      return prevAuthors;
    }
  },
  mounted: async function () {

    this.blogID = this.$route.params.id;
    this.articleID = this.$route.params.articleId;

    const blog = await this.$store.state.nkclient.getBlog(this.blogID)
    const article = await this.$store.state.nkclient.getArticle(this.blogID, this.articleID);

    this.isOwner = blog.owner === this.$store.state.me._id;
    this.title = article.title;
    this.tags = article.tags.join(",");
    this.content = article.content;
    this.authors = [article.author];
    this.isPublic = article.public;
    this.authorName = article.authorName;

    this.$store.state.nkclient.eventBus.$emit("breadcrumbUpdate", [{
      name: "Blogs",
      href: "Blogs"
    }, {
      name: blog.name,
      href: "BlogView",
      params: {
        id: this.blogID
      }
    }, {
      name: article.title,
    }]);

  },
  methods: {
    async saveAndClose() {
      await this.save();
      this.close();
    },
    async save() {
      await this.$store.state.nkclient.saveArticle(this.blogID, this.articleID, this.title, this.isPublic, this.tags.split(","), this.newAuthors[0], this.content);
    },
    close() {
      this.$emit("closed");
      if (!this.embeddedMode) {
        if (window.history.length > 1) this.$router.go(-1);
        else {
          if (this.blogID)
            this.$router.push("/blogs/" + this.blogID);
          else this.$router.push("/blogs");
        }
      }
    }
  },
}

</script>

<style scoped lang="scss">
:deep(.v-row > div) {
  padding-top: 0;
  padding-bottom: 0;
}

.content {
  padding: 1rem 0;
}
</style>

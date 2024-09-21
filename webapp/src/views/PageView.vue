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

        <v-btn data-test="itemCloseButton" @click="cancel">
          <font-awesome-icon :icon="['fal', 'times']" size="lg" />
          close
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-card width="100%" style="margin-top: 1rem;">
      <v-container fluid>
        <v-row wrap>
          <v-col cols="12" sm="6">
            <v-text-field v-model="title" data-test="nameTextField" label="Title" density="compact"
              hide-details="auto"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field v-model="slug" data-test="nameTextField" label="Slug" density="compact"
              hide-details="auto"></v-text-field>
          </v-col>

          <v-col cols="12" sm="4" class="d-flex align-center">
            <v-checkbox v-model="isPublic" label="Public" density="compact" hide-details="auto"></v-checkbox>
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
import CreateArticle from "../components/CreateArticle";
import MonacoEditor from 'monaco-editor-vue3';

export default {
  components: {
    UserSelector,
    CreateArticle,
    MonacoEditor
  },
  emits: ["closed"],

  data() {
    return {
      title: "",
      slug: "",
      pageID: "",
      content: "",
      isPublic: false,
      options: {
        colorDecorators: true,
        lineHeight: 16 * 1.4,
        tabSize: 2,
      },
    }
  },
  mounted: async function () {
    this.pageID = this.$route.params.id;
    await this.loadData();
  },

  methods: {
    async loadData() {
      const page = await this.$store.state.nkclient.getPage(this.pageID)

      this.title = page.title;
      this.slug = page.slug;
      this.isPublic = page.public;
      this.content = page.content;

      this.$store.state.nkclient.eventBus.$emit("breadcrumbUpdate", [{
        name: "Pages",
        href: "Pages"
      }, {
        name: page.title,
      }]);
    },
    async save() {
      await this.$store.state.nkclient.updatePage(this.pageID, this.title, this.slug, this.isPublic, this.content);
      await this.loadData();
    },

    async saveAndClose() {
      await this.save();
      this.cancel();
    },

    cancel() {
      this.$emit("closed");
      if (!this.embeddedMode) {
        if (window.history.length > 1) this.$router.go(-1);
        else {
          this.$router.push("/pages");
        }
      }
    },
  },
}
</script>

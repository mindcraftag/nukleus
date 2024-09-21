<template>
  <v-container fluid grid-list-xl>
    <v-row wrap>

      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-card-actions>
            <v-btn color="primary" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn @click="close">
              <v-icon>mdi-close</v-icon>
              close
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-container fluid grid-list-lg>
            <v-row wrap>
              <v-col xs12>
                <form>
                  <v-text-field
                    v-model="name"
                    label="Name"
                    density="compact"
                    required
                  ></v-text-field>

                  <AceEditor
                    v-model:value="code"
                    style="height: calc(100vh - 550px)"
                  />
                </form>
              </v-col>
            </v-row>
          </v-container>
        </v-card>
      </v-col>

      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-card-actions>
            <v-btn color="primary" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn @click="close">
              <v-icon>mdi-close</v-icon>
              close
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

import { AceEditor } from "@mindcraftgmbh/nukleus-vueui";

export default {
  components: {
    AceEditor
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    attributeTemplate: null,
    error: null,
    code: null,
    lang: null,
    theme: null
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    name: {
      get() {
        if (this.attributeTemplate) return this.attributeTemplate.name;

        return "";
      },
      set(value) {
        if (this.attributeTemplate) this.attributeTemplate.name = value;
      },
    }
  },

  created() {
    this.loadData();
  },

  mounted() {
     this.lang = "json";
     this.theme = "twilight";
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async loadData() {
      try {
        const id = this.$route.params.id;
        this.attributeTemplate =
          await this.$store.state.nkclient.getAttributeTemplate(id);
        this.code = JSON.stringify(this.attributeTemplate.fields, null, 2);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    editorInit: function () {

    },

    async submit() {
      try {
        try {
          this.attributeTemplate.fields = JSON.parse(this.code);
          this.error = null;
        } catch (err) {
          this.error = err.toString();
        }

        if (this.error && this.error.length) {
          this.$store.commit(
            "setError",
            "Please fix parsing errors first before saving.",
          );
          return;
        }

        await this.$store.state.nkclient.updateAttributeTemplate(
          this.attributeTemplate,
        );
        this.close();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    close() {
      this.$router.go(-1);
    },
  },
};
</script>

<style></style>

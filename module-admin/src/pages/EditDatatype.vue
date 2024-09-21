<template>

  <div>
    <h1 class="pageTitle" data-test="editClientTitle">Edit datatype</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>

        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-btn color="primary" @click="submit">
                    <v-icon>mdi-content-save</v-icon>
                    save
                  </v-btn>
                  <v-btn @click="close">
                    <v-icon>mdi-close</v-icon>
                    close
                  </v-btn>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-card-title>Edit Datatype</v-card-title>
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-text-field
                    v-model="name"
                    label="Name"
                    required
                  ></v-text-field>

                  <v-text-field
                    v-model="contentTypes"
                    label="Content types"
                  ></v-text-field>

                  <v-checkbox
                    v-model="updateRequiresThumbRefresh"
                    label="Update requires thumb refresh"
                  ></v-checkbox>

                  <v-progress-linear indeterminate v-if="!dataTypeFields"></v-progress-linear>

                  <v-tabs v-else v-model="tab" @change="tabSwitched" align-with-title>
                    <v-tabs-slider></v-tabs-slider>
                    <v-tab>
                      Editor
                    </v-tab>
                    <v-tab>
                      JSON
                    </v-tab>
                  </v-tabs>
                  <v-tabs-items v-model="tab">
                    <v-tab-item>
                      <v-card flat>
                        <DataTypeEditor v-model="dataTypeFields" :datatypes="datatypes" @input="updated"></DataTypeEditor>
                      </v-card>
                    </v-tab-item>
                    <v-tab-item>
                      <v-card flat>
                        <AceEditor
                          ref="aceeditor"
                          v-model="fields"
                          @init="editorInit"
                          lang="json"
                          theme="twilight"
                          width="100%"
                          height="calc(100vh - 550px)"
                          :options="editorOptions"
                        />
                      </v-card>
                    </v-tab-item>
                  </v-tabs-items>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-btn color="primary" @click="submit">
                    <v-icon>mdi-content-save</v-icon>
                    save
                  </v-btn>
                  <v-btn @click="close">
                    <v-icon>mdi-close</v-icon>
                    close
                  </v-btn>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>

      </v-layout>
    </v-container>
  </div>
</template>

<style>

.datatypeFieldsEditor {
  background-color: #141414;
  color: #ffffff;
  font-family: Fira code, Fira Mono, Consolas, Menlo, Courier, monospace;
  font-size: 14px;
  padding: 5px;
  min-height: 200px;
  max-height: calc(100vh - 550px);
}

.ace_search {
  background-color: #202020 !important;
  color: #ffffff !important;
  border: 1px solid #303030 !important;
}

.ace_search_field {
  background-color: #181818 !important;
  color: #ffffff !important;
  border: 1px solid #303030 !important;
}

.ace_searchbtn {
  border: 1px solid #303030 !important;
  background: #202020 !important;
  border-left: 1px solid #404040 !important;
  color: white !important;
}

.ace_searchbtn:last-child {
  border-right: 1px solid #202020 !important;
}

.ace_searchbtn:hover {
  background-color: #404040 !important;
}

.ace_searchbtn_close {
  color: #656565 !important;
}

.ace_searchbtn_close:hover {
  background-color: #656565 !important;
  color: white !important;
}

.ace_button {
  border: 1px solid rgba(100,100,100,0.23) !important;
  color: white !important;
}

.ace_button:hover {
  background-color: #404040 !important;
}

.ace_button:active {
  background-color: #ddd !important;
}

.ace_button.checked {
  border-color: #3399ff !important;
}

</style>

<script>

import AceEditor from 'vuejs-ace-editor';

export default {

  components: {
    AceEditor
  },

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    show: {
      get () {
        return this.value
      },
      set (value) {
        this.$emit('input', value)
      }
    },

    dataTypeFields: {
      get() {
        if (this.datatype)
          return this.datatype.fields;

        return null;
      },
      set(value) {
        if (this.datatype)
          return this.datatype.fields = value;
      }
    }
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    tab: null,
    folder: null,
    datatype: null,
    datatypes: [],
    name: "",
    fields: "",
    contentTypes: "",
    updateRequiresThumbRefresh: false,
    editor: null,
    interval: null,
    editorOptions: {
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      fontSize: 14,
      highlightActiveLine: true,
      showLineNumbers: true,
      tabSize: 2,
      showPrintMargin: false,
      showGutter: true,
    }
  }),

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    editorInit: function () {
      require('brace/ext/language_tools'); //language extension prerequsite...
      require('brace/mode/json');    //language
      require('brace/theme/twilight');
      require('brace/ext/searchbox');
    },
    updated() {
      console.log("Datatype was updated!");
      this.fields = JSON.stringify(this.datatype.fields, null, 4);
    },
    tabSwitched(val) {
      // refresh editor if we switch to its tab
      if (val === 1) {
        const _this = this;
        setTimeout(function() {
          _this.refreshEditor();
        }, 500);
      }
    },
    refreshEditor() {
      if (this.editor) {
        this.editor.resize();
      }
    },
    async load() {
      try {
        const datatypeId = this.$router.currentRoute.params.id;

        const datatypes = await this.$store.state.nkclient.getAllDatatypesList();
        datatypes.sort(function(a, b) { return a.name.localeCompare(b.name)});
        this.datatypes = datatypes;

        this.datatype = await this.$store.state.nkclient.getDatatype(datatypeId);
        this.name = this.datatype.name;
        this.contentTypes = this.datatype.contentTypes.join(', ');
        this.fields = JSON.stringify(this.datatype.fields, null, 4);
        this.updateRequiresThumbRefresh = this.datatype.updateRequiresThumbRefresh;
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async submit () {
      try {
        await this.$store.state.nkclient.updateDatatype({
          _id: this.datatype._id,
          name: this.name,
          contentTypes: this.contentTypes.split(',').map((x) => { return x.trim() }),
          fields: JSON.parse(this.fields),
          updateRequiresThumbRefresh: this.updateRequiresThumbRefresh
        });

        this.close();
        this.$emit('updated-datatype');
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    close () {
      this.$router.push({name: "Datatypes"});
    },

    startInterval() {
      const _this = this;

      this.interval = setInterval(function() {
        if (!_this.editor) {
          if (_this.$refs.aceeditor) {
            _this.editor = _this.$refs.aceeditor.editor;
            _this.refreshEditor();
          }
        } else {
          _this.clearInterval();
        }
      }, 100);
    },

    clearInterval() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }
  },

  mounted() {
    this.startInterval();
  },

  beforeDestroy() {
    this.clearInterval();
  },

  created() {
    this.load();
  }
}
</script>

<style>

</style>

<template>
  <v-dialog width="800" :value="value" persistent>
    <v-card >
      <v-card-title>Default script</v-card-title>
      <v-divider></v-divider>
      <v-card-text>

        <AceEditor
          v-model="editableScript"
          @init="editorInit"
          :lang="language"
          theme="twilight"
          width="100%"
          height="400px"
          :options="editorOptions"
        />

      </v-card-text>
      <v-divider></v-divider>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" text @click="save">Save</v-btn>
        <v-btn color="primary" text @click="close">Close</v-btn>
      </v-card-actions>

    </v-card>
  </v-dialog>
</template>
<script>

import AceEditor from 'vuejs-ace-editor'

export default {

  components: {
    AceEditor
  },

  props: {
    value: {
      type: Boolean,
      required: true
    },
    script: {
      type: String,
      required: true
    },
    language: {
      type: String,
      required: true
    }
  },

  data: () => ({
    editableScript: "",
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

  watch: {
    value: function(to) {
      if (to) {
        this.editableScript = this.script;
      }
    }
  },

  methods: {
    editorInit() {
      require('brace/ext/language_tools')
      require('brace/mode/lua');
      require('brace/mode/glsl');
      require('brace/theme/twilight');
    },

    save() {
      this.$emit('changed', this.editableScript);
      this.close();
    },

    close() {
      this.$emit('input', false);
    }
  }
}

</script>

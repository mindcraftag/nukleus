<template>
  <v-ace-editor
    :lang="lang"
    :theme="theme"
    :options="{
      fontSize: 14,
      highlightActiveLine: true,
      showLineNumbers: true,
      tabSize: 2,
      showPrintMargin: false,
      showGutter: true,
      useWorker: false
    }"
    @init="initEditor"
  />
</template>
<script>

import { watch } from "vue";
import { VAceEditor } from "vue3-ace-editor";
import "./aceconfig"
import ace from "ace-builds"

export default {
  components: {
    VAceEditor
  },

  props: {
    mode: {
      type: String,
      default: "text"
    },
    fileId: {
      type: String,
      default: ""
    }
  },

  emits: ["init", "toggleBreakpoint"],

  data: () => ({
    lang: "text",
    runningMarker: null,
    editor: null,
    sessions: new Map()
  }),

  computed: {
    theme() {
      return this.$store.state.codeEditorTheme;
    },

    session() {
      return this.sessions.get(this.fileId);
    }
  },

  mounted() {
    watch(() => [this.fileId], () => this.updateSession());
    watch(() => [this.mode], () => this.updateMode());

    this.updateSession();
  },

  methods: {
    initEditor(editor) {
      this.editor = editor;

      editor.setKeyboardHandler("ace/keyboard/vscode");

      this.editor.on("guttermousedown", (e) => {
        const target = e.domEvent.target;
        if (target.className.indexOf("ace_gutter-cell") == -1) {
          return;
        }

        if (!this.editor.isFocused()) {
          return;
        }

        if (e.clientX > 25 + target.getBoundingClientRect().left) {
          return;
        }

        const row = e.getDocumentPosition().row;
        this.$emit("toggleBreakpoint", row);
        e.stop();
      });

      this.$emit("init", this);
    },

    setBreakpoint(line, enabled) {
      if (enabled) {
        this.session.setBreakpoint(line);
      } else {
        this.session.clearBreakpoint(line);
      }
    },

    clearBreakpoints() {
      if (this.session)
        this.session.clearBreakpoints();
    },

    setRunningMarker(line) {
      const Range = ace.require("ace/range").Range;
      const range = new Range(line, 0, line, 5);
      this.runningMarker = this.session.addMarker(range, "running", "fullLine");
    },

    removeRunningMarker() {
      if (this.runningMarker) {
        this.session.removeMarker(this.runningMarker);
        this.runningMarker = null;
      }
    },

    openSearchBox() {
      const editor = this.editor;

      if (editor) {
        editor.execCommand("find");
      }
    },

    updateMode() {
      this.session.setMode(`ace/mode/${this.mode}`);
      
      switch(this.mode) {

        case 'lua':
          // For some weird reason, if we do not switch to lua mode once, the lua ext mode will not be able to
          // retrieve the lua mode to base its functionality on.
          this.lang = "lua";
          this.$nextTick(() => this.lang = "luaext")
          break;

        case "json":
        case 'glsl':
          this.lang = this.mode;
          break;

        default: {
          this.lang = "text";
          break;
        }
      }
    },

    updateSession() {
      if (!this.session) {
        const session = ace.createEditSession("");
        session.setUndoManager(new ace.UndoManager());

        this.sessions.set(this.fileId, session);

        // remove the initial empty content from the sessions undo history
        this.$nextTick(() => this.session.getUndoManager().reset());
      }

      this.editor.setSession(this.session);
      this.updateMode();
    }
  }
}

</script>
<style>

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

.ace_gutter-cell.ace_breakpoint{
  border-radius: 20px 0px 0px 20px;
  background: #800000;
  box-shadow: 0px 0px 1px 1px #a00000 inset;
}

</style>
yy
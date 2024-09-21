<template>
  <div>
    <div v-if="computedValue && computedValue.length > 0">

      <div class="float-right" v-if="allowCopyAndPaste">
        <v-btn size="x-small" variant="text" @click="copy">
          <font-awesome-icon :icon="['fal', 'copy']" size="1x" /> Copy
        </v-btn>
        <v-btn v-if="allowEdit" size="x-small" variant="text" @click="paste">
          <font-awesome-icon :icon="['fal', 'paste']" size="1x" /> Paste
        </v-btn>

        <Dialog v-model="showClipboard" title="Clipboard">
          <template #default>
            <div style="max-height: 60vh; overflow: auto">
              <v-textarea v-model="clipboard"
                          style="font-size: 10px"
                          variant="solo"
                          density="compact"
                          hide-details
                          auto-grow
                          flat>
              </v-textarea>
            </div>
          </template>
          <template #actions>
            <v-btn color="primary" v-if="isPaste" @click="confirmPaste">
              Paste
            </v-btn>
            <v-btn color="normal" @click="showClipboard = false">
              Close
            </v-btn>
          </template>
        </Dialog>

      </div>

      <table :class="cssClasses">
        <tbody>
          <FieldRow
            v-for="(field, index) in computedValue"
            :key="index"
            :model-value="field"
            :allow-edit="allowEdit"
            :studio-mode="studioMode"
            :item-repo="itemRepo"
            :node-name-resolver="nodeNameResolver"
            :layer-titles="layerTitles"
            :project-folder-id="projectFolderId"
          ></FieldRow>
        </tbody>
      </table>
    </div>

    <div v-if="!computedValue || !computedValue.length" class="fieldMessage">
      No fields available
    </div>

    <Scripts
      v-if="allowScripts && block && block.parent"
      :block="block"
      :item-repo="itemRepo"
      :allow-edit="allowEdit"
      :studio-mode="studioMode"
      :node-name-resolver="nodeNameResolver"
      :project-folder-id="projectFolderId"
    />
  </div>
</template>
<script>

import FieldRow from './FieldRow.vue'
import Scripts from './Scripts.vue'
import Dialog from "../wrappers/Dialog.vue";

export default {

  name: 'Fields',

  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    Dialog,
    FieldRow,
    Scripts
  },

  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    value: {
      type: Array,
    },
    block: {
      type: Object,
    },
    allowEdit: {
      type: Boolean,
    },
    studioMode: {
      type: Boolean,
      default: false,
    },
    itemRepo: {
      type: Object,
      required: true,
    },
    allowScripts: {
      type: Boolean,
      default: false,
    },
    nodeNameResolver: {
      type: Function,
      required: true
    },
    layerTitles: {
      type: Array
    },
    projectFolderId: {
      type: String,
      required: true
    }
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    clipboard: null,
    showClipboard: false,
    isPaste: false
  }),

  // ------------------------------------------------------------
  // EMITS
  // ------------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    cssClasses: {
      get() {
        if (this.studioMode) {
          return 'fieldsEditor fieldsEditorStudio'
        } else if (this.$store.state.darkMode) {
          return 'fieldsEditor fieldsEditorDark'
        } else {
          return 'fieldsEditor fieldsEditorLight'
        }
      },
    },
    computedValue: {
      get() {
        if (!this.value)
          return null

        const arr = []

        let inSeparator = false
        let separatorFields = null

        for (const field of this.value) {
          if (!inSeparator && field.type !== 'Separator') {
            arr.push(field)
          } else if (field.type === 'Separator') {
            inSeparator = true
            field.separatorFields = separatorFields = []
            arr.push(field)
          } else {
            if (separatorFields)
              separatorFields.push(field)
          }
        }

        return arr
      },
      set(value) {
        console.log('Set new List value: ' + value)
        this.$emit('update:modelValue', value)
      },
    },
    allowCopyAndPaste() {
      for (const field of this.computedValue) {
        if (["Link", "Attribute"].includes(field.type))
          return true;
      }
      return false;
    }
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    async copy() {
      const result = {};
      for (const field of this.computedValue) {
        if (field.type === "Attribute") {
          result[field.name] = JSON.parse(JSON.stringify(field.value));
        } else if (field.type === "Link") {
          if (typeof field.value === 'object')
            result[field.name] = field.value._id;
          else
            result[field.name] = field.value
        }
      }

      const text = JSON.stringify(result, null, 2);

      try {
        await navigator.clipboard.writeText(text);
        this.$store.commit("setMessage", "Copied to clipboard");
      } catch (err) {
        this.clipboard = text;
        this.isPaste = false;
        this.showClipboard = true;
      }
    },

    async paste() {
      try {
        this.clipboard = await navigator.clipboard.readText();
        this.confirmPaste();
      } catch (err) {
        this.showClipboard = true;
        this.isPaste = true;
      }
    },

    confirmPaste() {
      this.showClipboard = false;

      if (!this.clipboard || this.clipboard.trim().length === 0)
        return;

      let data;
      try {
        data = JSON.parse(this.clipboard);
      }
      catch(err) {
        this.$store.commit("setError", "Clipboard contents invalid!");
        console.error(err);
        return;
      }

      for (const field of this.computedValue) {
        if (data.hasOwnProperty(field.name)) {
          if (field.type === "Attribute") {
            field.value = data[field.name];
          } else if (field.type === "Link") {
            field.value = data[field.name];
          }
        }
      }
    }
  }
}
</script>

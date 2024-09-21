<template>

  <div :class="cssClasses">

    <v-toolbar flat height="32px">
      <v-toolbar-title></v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn text rounded @click="openNewFieldDialog(0)">
        <v-icon>mdi-plus-circle-outline</v-icon>
        add field
      </v-btn>
    </v-toolbar>

    <draggable v-model="fields"
               @start="drag=true"
               @end="drag=false"
               handle=".field-drag">

      <DataTypeEditorField v-for="(field, index) in fields"
                           v-model="fields[index]"
                           @input="changed"
                           :datatypes="datatypes"
                           @insert-below="openNewFieldDialog(index+1)"
                           @delete="deleteField(index)" />

    </draggable>

    <NewFieldDialog v-model="showNewFieldDialog" @chosen="addNewField" />

  </div>
</template>
<style>

.datatype-editor-card {
  margin-top: 5px;
  margin-bottom: 5px;
  min-height: 32px;
  overflow: hidden;
}

.data-type-editor .field-drag {
  vertical-align: top;
  padding-top: 8px !important;
  cursor: grab;
  user-select: none;
  min-height: 40px;
  max-height: 80px;
}

.data-type-editor .type-specifier {
  min-width: 90px;
  height: 24px;
  border-radius: 4px;
  padding: 2px !important;
  padding-left: 4px !important;
}

.data-type-editor-dark .type-specifier {
  background-color: #30383e;
  border: 1px solid #405060;
}

.data-type-editor-light .type-specifier {

}

.data-type-editor .type-panel {
  padding: 2px !important;
  padding-right: 4px !important;
  border-radius: 4px;
}

.data-type-editor .field-name {
  display: inline-block;
  white-space: nowrap;
  margin-left: 8px;
  padding-top: 8px !important;
}

.data-type-editor .field-value {
  margin-left: 4px;
  border-radius: 5px !important;
  margin-top: 2px;
  margin-bottom: 2px;
  min-height: 24px;
  max-height: 24px;
  min-width: 24px;
  overflow: hidden;
}

.data-type-editor .v-text-field {
  padding-top: 0;
  margin-top: 0;
  font-size: 12px;
  width: 99%;
}

.data-type-editor .v-input__slot {
  padding: 0;
  margin: 0;
  height: 24px;
}

.data-type-editor .v-input__append-outer {
  padding: 0;
  margin: 0;
  height: 24px;
}

.data-type-editor .v-input__slot:after {
  border: 0 !important;
  content: none !important;
}

.data-type-editor .v-input__slot:before {
  border: 0 !important;
  content: none !important;
}

.data-type-editor .v-input__control {
  height: 24px;
}

.data-type-editor .v-select__selection--comma {
  margin-top: 0;
  margin-bottom: 0;
}

.data-type-editor .v-data-table td {
  height: 32px;
}

.data-type-editor td:first-child {
  width: 30%;
}

/*
  LIGHT MODE
 */

.data-type-editor-light .type-panel {
  border: 1px solid #b0b0b0;
  background: #d8d8d8;
}

.data-type-editor-light .field-type-separator {
  background-color: #f0f0f0 !important;
  border: 2px solid #808080 !important;
  border-left: 4px solid #000000 !important;
  border-radius: 3px !important;
}

.data-type-editor-light .field-type-link {
  border-left: 4px solid #ff0000 !important;
  border-radius: 3px !important;
}

.data-type-editor-light .field-type-attribute {
  border-left: 4px solid #0000ff !important;
  border-radius: 3px !important;
}

.data-type-editor-light .field-type-list {
  border-left: 3px solid #00ff00 !important;
  border-radius: 3px !important;
}

.data-type-editor-light .field-type-tree {
  border-left: 3px solid #00ffff !important;
  border-radius: 3px !important;
}

.data-type-editor-light .separator {
  background-color: #f0f0f0;
}

.data-type-editor-light .listBorder {
  border: 1px solid #f0f0f0;
}

.data-type-editor-light .field-value {
  background-color: #e6e6e6;
  border-top: 1px solid #d0d0d0;
  border-left: 1px solid #d0d0d0;
}

.data-type-editor-light .field-value:hover {
  background-color: #dddddd;
}

/*
  DARK MODE
 */

.data-type-editor-dark .type-panel {
  border: 1px solid #303030;
  background: #282828;
}

.data-type-editor-dark .field-type-separator {
  background-color: #202020 !important;
  border: 1px solid #404040 !important;
  border-left: 3px solid #000000 !important;
  border-radius: 3px !important;
}

.data-type-editor-dark .field-type-link {
  border-left: 3px solid #ff0000 !important;
  border-radius: 3px !important;
}

.data-type-editor-dark .field-type-attribute {
  border-left: 3px solid #0000ff !important;
  border-radius: 3px !important;
}

.data-type-editor-dark .field-type-list {
  border-left: 3px solid #00ff00 !important;
  border-radius: 3px !important;
}

.data-type-editor-dark .field-type-tree {
  border-left: 3px solid #00ffff !important;
  border-radius: 3px !important;
}

.data-type-editor-dark {
  background-color: #202020 !important;
}

.data-type-editor-dark .separator {
  background-color: #101010;
}

.data-type-editor-dark .listBorder {
  margin: 4px;
  border: 1px solid #101010;
}

.data-type-editor-dark .field-value {
  background-color: #181818;
  border: 1px solid #181818;
}

.data-type-editor-dark .field-value:hover {
  background-color: #1a1a1a;
  border: 1px solid #0080ff;
}

</style>
<script>

import NewFieldDialog from "./dialogs/NewFieldDialog";
import DataTypeEditorField from './DataTypeEditorField.vue';
import draggable from 'vuedraggable';

export default {

  components: {
    DataTypeEditorField,
    NewFieldDialog,
    draggable
  },

  name: 'DataTypeEditor',

  props: {
    value: {
      type: Array,
      required: true
    },
    datatypes: {
      type: Array,
      required: true
    }
  },

  data: () => ({
    addNewFieldIndex: null,
    showNewFieldDialog: false,
    drag: false
  }),

  computed: {
    fields: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    },
    cssClasses: {
      get() {
        if (this.$vuetify.theme.dark) {
          return "data-type-editor data-type-editor-dark";
        } else {
          return "data-type-editor data-type-editor-light";
        }
      }
    },
  },

  methods: {
    changed() {
      this.$emit('input', this.value);
    },

    openNewFieldDialog(index){
      this.addNewFieldIndex = index;
      this.showNewFieldDialog = true;
    },

    addNewField(field) {
      this.fields.splice(this.addNewFieldIndex, 0, field);
      this.$emit('input', this.fields);
    },

    deleteField(index) {
      this.fields.splice(index, 1);
      this.$emit('input', this.fields);
    }
  }
}
</script>

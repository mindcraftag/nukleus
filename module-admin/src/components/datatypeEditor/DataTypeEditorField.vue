<template>

  <v-card elevation="2" :class="cssClasses" style="width: 100%;" tile>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>

        <v-flex d-flex lg2 md3 sm3 xs12 class="field-drag" >

          <v-layout row wrap>
            <v-flex d-flex lg6 md6 sm12 xs12 style="padding-top: 12px; padding-bottom: 0">

              <div class="type-specifier" style="cursor: pointer;" @click="openFieldPropsDialog">
                <v-icon large>mdi-drag-vertical</v-icon>
                {{field.type}}
                <span v-if="field.type === 'Link'">
                  <div v-show="loadingManagerIgnore" class="led-red-on"></div>
                  <div v-show="!loadingManagerIgnore" class="led-red-off"></div>
                </span>
                <span v-if="field.type !== 'Separator'">
                  <div v-show="doesNotAffectThumbnail" class="led-green-on"></div>
                  <div v-show="!doesNotAffectThumbnail" class="led-green-off"></div>
                </span>
                <span v-if="field.info">
                  <font-awesome-icon :icon="['fal', 'info-circle']" />
                </span>
              </div>
            </v-flex>

            <v-flex d-flex lg6 md6 sm12 xs12 style="padding-top: 12px; padding-bottom: 0">
              <v-tooltip bottom color="primary">
                <template v-slot:activator="{ on }">
                  <v-btn v-on="on" @click="$emit('insert-below')" icon small>
                    <font-awesome-icon :icon="['fal', 'plus']" />
                  </v-btn>
                </template>
                <span>Insert new field below</span>
              </v-tooltip>

              <v-tooltip bottom color="primary">
                <template v-slot:activator="{ on }">
                  <v-btn v-on="on" @click="showDeleteDialog = true" icon small color="red" >
                    <font-awesome-icon :icon="['fal', 'trash']" />
                  </v-btn>
                </template>
                <span>Delete field</span>
              </v-tooltip>
            </v-flex>
          </v-layout>

        </v-flex>

        <v-flex d-flex lg10 md9 sm9 xs12 style="padding: 2px;">
          <DataTypeEditorFieldSeparator v-if="field.type==='Separator'"
                                        v-model="field" />

          <DataTypeEditorFieldLink      v-if="field.type==='Link'"
                                        v-model="field"
                                        :datatypes="datatypes" />

          <DataTypeEditorFieldAttribute v-if="field.type==='Attribute'"
                                        v-model="field" />

          <DataTypeEditorFieldList      v-if="field.type==='List'"
                                        v-model="field"
                                        :datatypes="datatypes" />

          <DataTypeEditorFieldTree      v-if="field.type==='Tree'"
                                        v-model="field"
                                        :datatypes="datatypes"/>
        </v-flex>

      </v-layout>
    </v-container>

    <v-dialog v-model="showDeleteDialog" persistent max-width="290">
      <v-card>
        <v-card-title class="headline">Delete this field?</v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="red darken-1" text @click="showDeleteDialog = false; $emit('delete');">Delete</v-btn>
          <v-btn color="green darken-1" text @click="showDeleteDialog = false;">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <FieldPropsDialog v-model="showFieldPropsDialog" :field="field" @changed="propsChanged" />

  </v-card>

</template>
<style>

.led-red-on {
  display: inline-block;
  background-color: #ff0000;
  border: 1px solid #808080;
  width: 8px;
  height: 8px;
}

.led-red-off {
  display: inline-block;
  background-color: #400000;
  border: 1px solid #808080;
  width: 8px;
  height: 8px;
}

.led-green-on {
  display: inline-block;
  background-color: #00ff00;
  border: 1px solid #808080;
  width: 8px;
  height: 8px;
}

.led-green-off {
  display: inline-block;
  background-color: #004000;
  border: 1px solid #808080;
  width: 8px;
  height: 8px;
}

</style>
<script>

import DataTypeEditorFieldSeparator from './DataTypeEditorFieldSeparator.vue';
import DataTypeEditorFieldAttribute from './DataTypeEditorFieldAttribute.vue';
import DataTypeEditorFieldLink      from './DataTypeEditorFieldLink.vue';
import DataTypeEditorFieldList      from './DataTypeEditorFieldList.vue';
import DataTypeEditorFieldTree      from './DataTypeEditorFieldTree.vue';
import FieldPropsDialog             from "./dialogs/FieldPropsDialog";

export default {

  components: {
    FieldPropsDialog,
    DataTypeEditorFieldSeparator,
    DataTypeEditorFieldAttribute,
    DataTypeEditorFieldLink,
    DataTypeEditorFieldList,
    DataTypeEditorFieldTree
  },

  props: {
    value: {
      type: Object,
      required: true
    },
    datatypes: {
      type: Array,
      required: true
    }
  },

  data: () => ({
    showDeleteDialog: false,
    showFieldPropsDialog: false
  }),

  computed: {
    doesNotAffectThumbnail: {
      get() {
        return this.field.doesNotAffectThumbnail;
      },
      set(value) {
        if (value)
          this.field.doesNotAffectThumbnail = true;
        else
          delete this.field.doesNotAffectThumbnail;
      }
    },
    loadingManagerIgnore: {
      get() {
        return this.field.loadingManager === 'ignore';
      },
      set(value) {
        if (value)
          this.field.loadingManager = "ignore";
        else
          delete this.field.loadingManager;
      }
    },
    field: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    },
    cssClasses: {
      get() {
        const type = this.field ? this.field.type.toLowerCase() : "unknown";
        return `datatype-editor-card d-flex flex-row field-type-${type}`;
      }
    }
  },

  methods: {
    openFieldPropsDialog() {
      if (this.field.type !== "Separator")
        this.showFieldPropsDialog = true;
    },

    propsChanged(field) {
      this.$emit('input', field);
    },

    changed() {
      this.$emit('input', this.value);
    }
  }
}
</script>

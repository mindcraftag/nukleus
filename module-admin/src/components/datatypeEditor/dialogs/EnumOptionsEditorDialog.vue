<template>
  <v-dialog :value="value" scrollable max-width="400px" persistent>
    <v-card :class="cssClasses">
      <v-card-title>Edit Options</v-card-title>
      <v-divider></v-divider>
      <v-card-text style="height: 400px;">

        <draggable v-model="editableOptions"
                   @start="drag=true"
                   @end="drag=false"
                   draggable=".option-item"
                   handle=".dragicon">

          <div class="option-item d-flex flex-row" v-for="(option, index) in editableOptions" :key="option">
            <v-icon class="dragicon">mdi-drag-vertical</v-icon>
            <div class="field-value">
              <v-text-field style="width: 300px;" dense :value="option" @input="update(index, $event)" />
            </div>
            <v-btn icon @click="remove(option)">
              <font-awesome-icon :icon="['fal', 'trash']" size="1x" />
            </v-btn>
          </div>

        </draggable>

        <div class="option-item d-flex flex-row">
          <div class="field-value" style="margin-left: 16px; ">
            <v-text-field style="width: 300px;" dense v-model="newOption" />
          </div>
          <v-btn icon @click="add">
            <font-awesome-icon :icon="['fal', 'plus']" size="1x" />
          </v-btn>
        </div>

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
<style>

.enum-options-dialog .option-item {
  width: 100%;
}

.enum-options-dialog .field-value {
  margin-left: 4px;
  border-radius: 5px !important;
  margin-top: 2px;
  margin-bottom: 2px;
  min-height: 24px;
  max-height: 24px;
  min-width: 24px;
  overflow: hidden;
}

.enum-options-dialog-light .field-value {
  background-color: #e6e6e6;
  border-top: 1px solid #d0d0d0;
  border-left: 1px solid #d0d0d0;
}

.enum-options-dialog-light .field-value:hover {
  background-color: #dddddd;
}

.enum-options-dialog-dark .field-value {
  background-color: #181818;
  border: 1px solid #181818;
}

.enum-options-dialog-dark .field-value:hover {
  background-color: #1a1a1a;
  border: 1px solid #0080ff;
}

.enum-options-dialog .v-text-field {
  padding-top: 0;
  margin-top: 0;
  font-size: 12px;
  width: 99%;
}

.enum-options-dialog .v-input__slot {
  padding: 0;
  margin: 0;
  height: 24px;
}

.enum-options-dialog .v-input__append-outer {
  padding: 0;
  margin: 0;
  height: 24px;
}

.enum-options-dialog .v-input__slot:after {
  border: 0 !important;
  content: none !important;
}

.enum-options-dialog .v-input__slot:before {
  border: 0 !important;
  content: none !important;
}

.enum-options-dialog .v-input__control {
  height: 24px;
}

.enum-options-dialog .v-select__selection--comma {
  margin-top: 0;
  margin-bottom: 0;
}

</style>
<script>

import draggable from 'vuedraggable'

export default {

  components: {
    draggable
  },

  props: {
    value: {
      type: Boolean,
      default: true
    },
    options: {
      type: Array
    }
  },

  data: () => ({
    newOption: "",
    editableOptions: [],
    drag: false
  }),

  watch: {
    value: function(to) {
      if (to)
        this.createEditableOptions();
    }
  },

  computed: {
    cssClasses: {
      get() {
        if (this.$vuetify.theme.dark) {
          return "enum-options-dialog enum-options-dialog-dark";
        } else {
          return "enum-options-dialog enum-options-dialog-light";
        }
      }
    },
  },

  methods: {
    createEditableOptions() {
      this.editableOptions = JSON.parse(JSON.stringify(this.options));
    },

    update(index, value) {
      this.editableOptions[index] = value;
    },

    add() {
      const newOption = this.newOption.trim();

      if (newOption.length === 0)
        return;

      for (const option of this.editableOptions) {
        if (option === newOption) {
          return;
        }
      }

      this.editableOptions.push(newOption);
      this.newOption = "";
    },

    remove(option) {
      this.editableOptions.removeObject(option);
    },

    close() {
      this.$emit('input', false);
    },

    save() {
      this.$emit('options-changed', this.editableOptions);
      this.close();
    }
  },

  mounted() {
    this.createEditableOptions();
  }

}

</script>

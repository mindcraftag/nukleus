<template>
  <div style="width: 100%">
    <div class="d-flex flex-row">
      <div class="field-name">
        Label:
      </div>
      <div class="field-value">
        <v-text-field dense v-model="field.displayName" @input="changed" />
      </div>
      <div class="field-name">
        Name:
      </div>
      <div class="field-value">
        <v-text-field dense v-model="field.name" @input="changed" />
      </div>
    </div>
    <div>
      <v-toolbar flat height="32px">
        <v-toolbar-title></v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn text rounded @click="addChildType">
          <v-icon>mdi-plus-circle-outline</v-icon>
          add child type
        </v-btn>
      </v-toolbar>

      <div v-for="(childType, index) of field.childTypes" :key="index">
        <DataTypeEditorChildType v-model="field.childTypes[index]" :datatypes="datatypes" @input="changed" @delete="deleteChildType(index)" />
      </div>
    </div>
  </div>
</template>

<script>

import DataTypeEditorChildType from './DataTypeEditorChildType'

export default {

  components: {
    DataTypeEditorChildType
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

  computed: {
    field: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    }
  },

  methods: {
    changed() {
      this.$emit('input', this.value);
    },
    addChildType() {
      this.value.childTypes.splice(0, 0, {
        typeName: "NewChildType",
        fields: []
      });
      this.$emit('input', this.value);
    },
    deleteChildType(index) {
      this.value.childTypes.splice(index, 1);
      this.$emit('input', this.value);
    }
  }

}
</script>

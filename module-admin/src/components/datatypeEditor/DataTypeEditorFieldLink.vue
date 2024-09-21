<template>

  <v-container fluid grid-list-xl>
    <v-layout row wrap>

      <v-flex d-flex lg2 md6 sm12 xs6 style="padding: 2px;">
        <div class="field-name">
          Label:
        </div>
        <div class="field-value">
          <v-text-field dense v-model="field.displayName" @input="changed" />
        </div>
      </v-flex>
      <v-flex d-flex lg2 md6 sm12 xs6 style="padding: 2px;">
        <div class="field-name">
          Usage:
        </div>
        <div class="field-value">
          <v-text-field dense v-model="field.usageAs" @input="changed" />
        </div>
      </v-flex>
      <v-flex d-flex lg8 md12 sm12 xs12 class="type-panel">
        <div style="min-width: 100px; width: 100px; overflow: hidden; padding: 2px">

        </div>

        <div class="field-name">
          Linkable types:
        </div>
        <div class="field-value">
          <v-combobox v-model="field.linkableTypes"
                      :items="datatypeNames"
                      hide-selected
                      multiple
                      @change="changed"
          ></v-combobox>
        </div>
      </v-flex>

    </v-layout>
  </v-container>

</template>

<script>

export default {
  name: 'DataTypeEditorFieldLink',

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
    datatypeNames: {
      get() {
        return this.datatypes.map(x => x.name);
      }
    },
    typePanelCss: {
      get() {
        if (this.$vuetify.theme.dark)
          return "padding: 2px; border: 1px solid #303030; background: #282828; padding-right: 4px; border-radius: 4px;";
        else
          return "padding: 2px; border: 1px solid #b0b0b0; background: #d8d8d8; padding-right: 4px; border-radius: 4px;";
      }
    },
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
    }
  }
}
</script>

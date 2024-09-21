<template>
  <div class="d-flex flex-row">
    <div class="field-name">
      Language:
    </div>
    <div class="field-value">
      <v-select v-model="field.language"
                :items="languages"
                @change="changed"
                dense
      ></v-select>
    </div>
    <v-btn small @click="editDefaultScript">Edit default script</v-btn>
    <ScriptValueDialog v-model="showScriptValueDialog" :script="defaultScript" :language="field.language" @changed="scriptChanged"></ScriptValueDialog>
  </div>
</template>

<script>

import ScriptValueDialog from '../dialogs/ScriptValueDialog'

export default {

  components: {
    ScriptValueDialog
  },

  props: {
    value: {
      type: Object,
      required: true
    }
  },

  data: () => ({
    languages: ['lua', 'glsl'],
    showScriptValueDialog: false
  }),

  computed: {
    field: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    },
    defaultScript: {
      get() {
        if (!this.value.defaultValue) {
          this.value.defaultValue = {
            code: ""
          };
        }

        return this.value.defaultValue.code;
      },
      set(value) {
        this.value.defaultValue.code = value;
        this.changed();
      }
    }
  },

  methods: {
    scriptChanged(script) {
      this.defaultScript = script;
    },
    changed() {
      this.$emit('input', this.value);
    },

    editDefaultScript() {
      this.showScriptValueDialog = true;
    }
  }
}
</script>

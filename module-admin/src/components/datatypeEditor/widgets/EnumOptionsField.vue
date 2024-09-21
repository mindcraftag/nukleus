<template>
  <div style="margin-top: 4px;" @click="pickOptions">
    {{optionsString}}
    <EnumOptionsEditorDialog v-model="showOptionsEditor"
                             :options="value"
                             @options-changed="$emit('input', $event)">
    </EnumOptionsEditorDialog>
  </div>
</template>
<script>

import EnumOptionsEditorDialog from "../dialogs/EnumOptionsEditorDialog";

export default {

  components: {
    EnumOptionsEditorDialog
  },

  props: {
    value: {
      type: Array
    },
    maxlength: {
      type: Number,
      default: 50
    }
  },

  data: () => ({
    showOptionsEditor: false
  }),

  computed: {
    optionsString: {
      get() {
        const joined = this.value.join(', ');
        let str = `${this.value.length} options: ${joined}`;
        if (str.length > this.maxlength) {
          str = str.substr(0, this.maxlength) + "...";
        }
        return str;
      }
    }
  },

  methods: {
    pickOptions() {
      this.showOptionsEditor = true;
    }
  }

}

</script>

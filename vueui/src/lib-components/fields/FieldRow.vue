<template>
  <tr v-show="!hidden">
    <td
      v-if="field.type !== 'Tree' &&
            field.type !== 'List' &&
            field.type !== 'Separator' &&
            field.datatype !== 'Script' &&
            field.displayName !== ''"
      class="fieldName">

      <span @dblclick="copyFieldName" style="user-select: none;">{{ field.displayName }}</span>

      <v-tooltip v-if="field.info" location="bottom">
        <template #activator="{ props }">
          <v-icon color="primary" dark v-bind="props">
            mdi-information
          </v-icon>
        </template>
        <span>{{ field.info }}</span>
      </v-tooltip>
    </td>
    <td
      v-else-if="field.type === 'Separator'"
      class="fieldValue"
      colspan="2"
    >
      <Separator
        :model-value="field"
        :allow-edit="allowEdit"
        :studio-mode="studioMode"
        :is-list="false"
        :item-repo="itemRepo"
        :node-name-resolver="nodeNameResolver"
        :layer-titles="layerTitles"
        :project-folder-id="projectFolderId"
        @changed="$emit('changed')"
      />
    </td>
    <td
      v-if="field.type !== 'Separator'"
      class="fieldValue"
      :colspan="
                field.displayName === '' ||
                field.type === 'Tree' ||
                field.type === 'List' ||
                field.datatype === 'Script'
                  ? 2
                  : 1
              "
    >
      <Field :model-value="field"
             :allow-edit="allowEdit"
             :studio-mode="studioMode"
             :item-repo="itemRepo"
             :node-name-resolver="nodeNameResolver"
             :layer-titles="layerTitles"
             :project-folder-id="projectFolderId"
             @changed="$emit('changed')">
      </Field>
    </td>
  </tr>
</template>
<script>

import { defineComponent, watch } from "vue";
import Separator from "./Separator.vue";
import Field from "./Field.vue";

export default defineComponent({

  name: "FieldRow",

  // ------------------------------------------------------------
  // COMPONENT
  // ------------------------------------------------------------
  components: {
    Field,
    Separator
  },

  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    modelValue: {
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
    hidden: false
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    field: {
      get() {
        return this.modelValue;
      }
    }
  },

  // ---------------------------------------------------------
  //  HOOKS
  // ---------------------------------------------------------
  mounted() {
    watch(() => [this.modelValue], () => {
      this.updateHidden();
    });

    this.updateHidden();

    this.$store.state.nkclient.eventBus.$on('nk:field:hiddenChanged', this.hiddenChanged);
  },

  beforeUnmount() {
    this.$store.state.nkclient.eventBus.$off('nk:field:hiddenChanged', this.hiddenChanged);
  },

  methods: {
    hiddenChanged(id, value) {
      if (this.modelValue && this.modelValue.id === id) {
        this.updateHidden();
      }
    },

    updateHidden() {
      this.hidden = this.modelValue.hidden;
    },

    async copyFieldName() {
      try {
        await navigator.clipboard.writeText(this.field.name);
        this.$store.commit("setMessage", "Copied field name to clipboard");
      } catch (err) {
        console.log("Field name is: " + this.field.name);
      }
    }
  }

})
</script>

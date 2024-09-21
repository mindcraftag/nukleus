<template>
  <div>
    <ReadOnlyAlert v-if="itemIsReadOnly"></ReadOnlyAlert>
    <PackageAlert v-if="itemIsPackaged"></PackageAlert>

    <Fields
      :value="fieldInstances"
      :allow-edit="allowEdit && !itemIsReadOnly"
      :studio-mode="studioMode"
      :is-list="false"
      :item-repo="itemRepo"
      :node-name-resolver="nodeNameResolver"
      :layer-titles="layerTitles"
      :project-folder-id="projectFolderId"
    />
  </div>
</template>
<script>

import { watch } from 'vue';
import Fields from './Fields.vue'
import ReadOnlyAlert from "../helpers/ReadOnlyAlert.vue";
import PackageAlert from "../helpers/PackageAlert.vue";

export default {

  name: "FieldsEditor",

  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    ReadOnlyAlert,
    PackageAlert,
    Fields,
  },

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    item: {
      type: Object,
      default: {},
    },
    allowEdit: {
      type: Boolean,
      default: false,
    },
    studioMode: {
      type: Boolean,
      default: false,
    },
    fieldsSource: {
      type: String,
      default: 'fieldInstances',
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
    fieldInstances: [],
    itemIsReadOnly: false,
    itemIsPackaged: false
  }),

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    updateSource() {
      const _this = this;

      this.fieldInstances = [];

      if (this.item) {
        this.$nextTick(function() {
          _this.fieldInstances = this.item[this.fieldsSource];
          _this.itemIsReadOnly = this.item.readOnly;
          _this.itemIsPackaged = this.item.isPackaged;
        });
      }
    }
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  created() {
    this.updateSource();

    watch(() => [this.item, this.fieldsSource, this.layerTitles], () => {
      this.updateSource();
    });
  },
}
</script>

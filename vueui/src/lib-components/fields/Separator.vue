<template>
  <div class="separator">
    <div
      class="separator-title" @dblclick="collapsed = !collapsed"
      :draggable="Boolean(draggingInfo)"
      @dragstart="draggingInfo && draggingInfo.handleDragStart(draggingInfo.index)"
      @dragend="draggingInfo && draggingInfo.handleDragEnd()"
    >
      {{ displayName }}
      <div class="float-right">
        <v-icon v-if="displayRemove" @click="$emit('remove')">mdi-delete</v-icon>
        <v-icon v-if="collapsed" @click="collapsed = !collapsed"
          >mdi-chevron-down</v-icon
        >
        <v-icon v-else @click="collapsed = !collapsed">mdi-chevron-up</v-icon>
      </div>
    </div>
    <v-expand-transition>
      <div v-if="!collapsed" class="separator-content">
        <Fields
          v-if="modelValue"
          :value="fieldInstances"
          :allow-edit="allowEdit"
          :studio-mode="studioMode"
          :is-list="false"
          :item-repo="itemRepo"
          :node-name-resolver="nodeNameResolver"
          :layer-titles="layerTitles"
          :project-folder-id="projectFolderId"
          @changed="$emit('changed')"
        />
        <slot v-else></slot>
      </div>
    </v-expand-transition>
  </div>
</template>
<script>

import { watch } from 'vue'

export default {

  name: 'Separator',

  props: {
    modelValue: {
      type: Object,
      default: null
    },
    title: {
      type: String,
      default: ""
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
      default: null
    },
    nodeNameResolver: {
      type: Function,
      default: null
    },
    displayRemove: {
      type: Boolean,
      default: false
    },
    draggingInfo: {
      type: Object,
      default: null
    },
    layerTitles: {
      type: Array
    },
    projectFolderId: {
      type: String,
      required: true
    }
  },

  emits: ['changed', 'remove'],

  data: () => ({
    collapsed: false,
  }),

  computed: {
    displayName: {
      get() {
        if (this.modelValue)
          return this.modelValue.displayName

        return this.title;
      },
    },
    fieldInstances: {
      get() {
        if (this.modelValue)
          return this.modelValue.separatorFields

        return null;
      },
    },
  },

  created() {
    watch(() => [this.modelValue], (newValues) => {
      this.updateCollapsed()
    });

    this.updateCollapsed()
  },

  methods: {
    updateCollapsed() {
      if (this.modelValue) {
        this.collapsed = this.modelValue.collapsed
      }
    },
  },
}
</script>

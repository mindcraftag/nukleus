<template>
  <TreeView
      :value="treeNodes"
      :parse-node="parseNode"
      :get-children="getChildren"
      :allow-multiselect="multiselect"
      :selected-nodes="selectedNodes"
      indent="1rem"
      @toggle="onNodeToggled"
      @select="onNodeSelected"
  >
    <template #content="{ node }">
      <slot name="prepend" :node="node"></slot>
      <slot :node="node">
        <span style="cursor: pointer">{{ node.name }}</span>
      </slot>
    </template>
  </TreeView>
</template>
<script>

import { watch } from 'vue'
import TreeView from "./TreeView.vue";

export default {

  // -----------------------------------------------------------------
  //  COMPONENTS
  // -----------------------------------------------------------------
  components: {
    TreeView
  },

  // -----------------------------------------------------------------
  //  PROPS
  // -----------------------------------------------------------------
  props: {
    nodes: {
      type: Array,
      required: true
    },
    fetchChildren: {
      type: Function,
      default: null
    },
    multiselect: {
      type: Boolean,
      default: false
    }
  },

  // -----------------------------------------------------------------
  //  EMITS
  // -----------------------------------------------------------------
  emits: ['selection-changed'],

  // -----------------------------------------------------------------
  //  DATA
  // -----------------------------------------------------------------
  data: () => ({
    treeNodes: [],
    selectedNodes: []
  }),

  // -----------------------------------------------------------------
  //  COMPUTED
  // -----------------------------------------------------------------
  computed: {
    selection: {
      get() {
        return this.selectedNodes;
      },
      set(value) {
        this.selectedNodes = value;
        this.$emit('selection-changed', value);
      }
    }
  },

  // -----------------------------------------------------------------
  //  CREATED
  // -----------------------------------------------------------------
  created() {
    watch(() => [this.nodes], (newValues) => {
      this.treeNodes = newValues[0];
    });
  },

  // -----------------------------------------------------------------
  //  METHODS
  // -----------------------------------------------------------------
  methods: {

    onNodeSelected(ev, data) {
      this.selection = data;
    },

    parseNode(node) {
      return {
        id: node._id,
        isLeaf: node.isLeaf,
        isExpanded: !!node.isExpanded,
        isDraggable: false,
        // Disabled nodes can't be selected, but they appear like normal nodes.
        // Nodes with showDisabled = true are slightly translucent.
        disabled: !!node.disabled,
        showDisabled: !!node.showDisabled
      };
    },

    onNodeToggled(event, node) {
      node.isExpanded = !node.isExpanded;

      if (node.isExpanded && !node.isLoaded) {
        if (this.fetchChildren) {
          this.fetchChildren(node);
          node.isLoaded = true;
        }
      }

      this.forceRefresh();
    },

    forceRefresh() {
      //this.treeNodes = structuredClone(this.treeNodes);
    },

    getChildren(node) {
      return node.children;
    },
  }
}

</script>

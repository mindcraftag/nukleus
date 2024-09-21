<!--
    The TreeViewNode component render a single node in the tree view. It's a recursive component, so it renders all the child nodes of the node that is passed in.
-->
<template>
  <!-- .item is the wrapper around the entire TreeViewNode component -->
  <div v-if="value" class="item">
    <!-- .itemMain renders the elements for the node that was passed in
          During a drag operation the .itemDisabled CSS class is applied. -->
    <div
      :key="data.id"
      :class="['itemMain', showDisabled ? 'itemDisabled' : ''].join(' ')"
      :draggable="data.isDraggable"
      @click="$emit('select', $event, value, !!data.disabled)"
      @dblclick="$emit('doubleclick', $event, value, !!data.disabled)"
      @contextmenu="$emit('contextmenu', $event, value, !!data.disabled)"
      @dragstart="onDragStart($event)"
      @dragend="onDragEnd($event)"
      @dragover.stop="onDragOver($event)"
      @dragleave.stop="onDragLeave($event)"
      @drop="onDrop($event)"
    >
      <!-- If this node is not a leaf, then an arrow will be rendered which can be used to expand / contract the node. -->
      <div class="itemIcon" @click.stop="$emit('toggle', $event, value)">
        <template v-if="!data.isLeaf">
          <v-icon v-if="data.isExpanded">mdi-chevron-down</v-icon>
          <v-icon v-else>mdi-chevron-right</v-icon>
        </template>
        <template v-else>
          <div style="width: 1.3rem"></div>
        </template>
      </div>

      <!-- .itemContent displays the user provided template for the node content -->
      <div
        :class="
          [
            'itemContent',
            data.id && selectedNodeIDs.includes(data.id) ? 'itemSelected' : '',
            showDropLocation ? 'itemDraggedOver' : '',
            data.showDisabled ? 'itemDisabled' : '',
          ].join(' ')
        "
      >
        <slot name="content" :node="value"></slot>
      </div>
    </div>

    <div
      v-if="data.isExpanded"
      v-for="(child, index) of children"
      :style="'margin-left: ' + indent"
    >
      <TreeViewDivider
        v-if="allowReordering"
        @nodeOnDividerDrop="(ev) => $emit('nodeOnDividerDrop', ev, data, index)"
      ></TreeViewDivider>
      <!-- If this node is expanded, then we want to display every child as it's own TreeViewNode component.
         We need to listen on the events and "bubble" them up so they can be handled by the TreeView. -->
      <TreeViewNode
        :value="child"
        :in-drag-mode="inDragMode"
        :get-children="getChildren"
        :parse-node="parseNode"
        :is-drop-target-for="isDropTargetFor"
        :current-drag-event="currentDragEvent"
        :selected-node-i-ds="selectedNodeIDs"
        :currently-dragged-node="currentlyDraggedNode"
        :indent="indent"
        :allow-reordering="allowReordering"
        @contextmenu="(ev, data, disabled) => $emit('contextmenu', ev, data, disabled)"
        @select="(ev, data, disabled) => $emit('select', ev, data, disabled)"
        @doubleclick="(ev, data, disabled) => $emit('doubleclick', ev, data, disabled)"
        @toggle="(ev, data) => $emit('toggle', ev, data)"
        @nodeOnDrag="(ev, data) => $emit('nodeOnDrag', ev, data)"
        @nodeOnNodeDrop="(ev, data, valid) => $emit('nodeOnNodeDrop', ev, data, valid)"
        @nodeOnDividerDrop="(ev, data, index) => $emit('nodeOnDividerDrop', ev, data, index)"
      >
        <template #content="{ node }">
          <slot name="content" :node="node"></slot>
        </template>
      </TreeViewNode>
      <TreeViewDivider 
        v-if="allowReordering && showLastChildDivider(index, children, child)" 
        @nodeOnDividerDrop="(ev) => $emit('nodeOnDividerDrop', ev, data, index+1)"
      ></TreeViewDivider>
    </div>
  </div>
</template>

<script>

import { watch } from 'vue'
import TreeViewDivider from './TreeViewDivider.vue'

export default {
  name: 'TreeViewNode',
  components: { TreeViewDivider },
  props: {
    // The data that belongs to this node in the tree hierachy. This field can have any form.
    value: {},
    // Whether or not the user is currently doing a drag-and-drop operation in the tree.
    inDragMode: Boolean,
    // A function that takes in this.value and returns an array of children.
    getChildren: Function,
    // A function that takes in a node and returns data that is required to render the node.
    // See the comment at the top of TreeView.vue for more information.
    parseNode: Function,
    // A function that takes in another TreeViewNodes "value" field and returns a boolean to indicate if this node is a drop-location for the other node.
    // The first argument is null if an external file is being dragged.
    isDropTargetFor: Function,
    // The node that is currently being dragged.
    currentlyDraggedNode: Object,
    currentDragEvent: Object,
    // An array of selected node IDs.
    selectedNodeIDs: Array,
    indent: String,
    // A boolean to indicate if nodes can be reordered (Will render dividers if set to true)
    allowReordering: Boolean
  },
  emits: ['select', 'doubleclick', 'toggle', 'nodeOnDrag', 'nodeOnNodeDrop', 'nodeOnDividerDrop', 'contextmenu'],
  data: () => ({
    // Whether or not this node is being dragged.
    isBeingDragged: false,
    // Whether or not a different node is being held above this node.
    isDraggedOver: false,
    data: {},
    children: [],
  }),
  computed: {
    // Whether or not this node is a drop location for the currently dragged node.
    // If it's not, then it should be grayed out.
    showDisabled() {
      if (this.isBeingDragged) return true

      if (this.inDragMode) {
        if (
          this.isDropTargetFor(
            this.currentlyDraggedNode,
            this.value,
            this.currentDragEvent
          )
        ) {
          return false
        } else {
          return true
        }
      }
      return false
    },
    // Whether or not this node should display the "drop location" indicator.
    // If it is, then it should be highlighted while the user is hovering over it.
    showDropLocation() {
      if (
        this.isDraggedOver &&
        this.isDropTargetFor(
          this.currentlyDraggedNode,
          this.value,
          this.currentDragEvent
        )
      ) {
        return true
      }
      return false
    },
  },
  created() {
    watch(() => [this.value], () => {
      this.computeData()
    }, { deep: true });
  },
  mounted() {
    this.computeData()
  },
  methods: {
    // We only recalculate the node data and the children when the value changes.
    computeData() {
      this.data = this.parseNode(this.value)
      this.children = this.getChildren(this.value)
    },
    onDragStart(ev) {
      this.isBeingDragged = true
      this.$emit('nodeOnDrag', ev, this.value)
    },
    onDragEnd() {
      this.isBeingDragged = false
      this.isDraggedOver = false
    },
    onDragOver(ev) {
      ev.preventDefault()
      ev.stopPropagation()
      this.isDraggedOver = true
    },
    onDragLeave(ev) {
      ev.preventDefault()
      ev.stopPropagation()
      this.isDraggedOver = false
    },
    onDrop(ev) {
      this.isDraggedOver = false
      this.isBeingDragged = false

      const valid = this.isDropTargetFor(
        this.currentlyDraggedNode,
        this.value,
        ev
      )
      this.$emit('nodeOnNodeDrop', ev, this.value, valid)
    },
    showLastChildDivider(index, children, child) {
      const {isLeaf, isExpanded} = this.parseNode(child);
      const isLastChild = index + 1 === children.length;
      const isSingleRow = isLeaf || !isExpanded
      const parentIsRootNode = this.value.isRoot;

      return isLastChild && (parentIsRootNode || isSingleRow);
    }
  },
}
</script>

<style scoped>
.item {
  cursor: default;
}

.item .v-icon {
  font-size: 1.2rem !important;
}

.itemMain {
  display: flex;
  align-items: center;
  border-radius: 0.3rem;
  margin-top: 3px;
  transition: opacity 0.2s;
}

.itemDisabled {
  opacity: 0.5;
}

.itemContent {
  border-radius: 0.3rem;
  border: 1px solid transparent;
  padding-left: 0.2rem;
  padding-right: 0.6rem;
  flex: 1;
  display: flex;
  align-items: center;
  user-select: none;
  transition: background-color 0.1s;
}

.itemSelected {
  border: 1px solid rgb(55, 111, 216);
  background-color: #1464c01e;
}

.itemDraggedOver {
  background-color: #3687e4;
}

.itemMain:hover {
  background-color: #303030;
}

.itemName {
  font-size: 1rem;
  font-weight: 500;
  margin-left: 0.5rem;
}

.itemIcon {
  opacity: 0.4;
}

.itemIcon:hover {
  opacity: 0.8;
}
</style>

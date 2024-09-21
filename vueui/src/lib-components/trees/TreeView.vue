<!--
    The TreeView displays the passed in data as a tree structure.
    It uses TreeViewNode components to render the individual items. The TreeView component itself is a wrapper that handles user events: selecting, toggling and dragging nodes.

    Props:
    - value: an array of nodes, where every node is an object. It's useful if every node also contains it's child nodes.
    - getChildren: a function that takes in a single node and returns an array of its child nodes
    - parseNode: a function that takes in a single node and returns an object with the following properties
      - id: the id of the node
      - isLeaf: a boolean to indicate if this node is a leaf node (i.e. a node without children)
      - isExpanded: a booean to indicate if this node should be expanded in the view
      - isDraggable: a boolean to indicate if this node can be dragged
    - isDropTargetFor: a function that decides if a certain node (first argument) can be dropped on another node (second argument)
    - allowMultiselect: a boolean to indicate if multiple nodes can be selected at the same time (Shift + Left Click for a range select and Ctrl + Left Click for an additive select)
    - allowReordering: a boolean to indicate if nodes can be reordered (Will render dividers if set to true)
    - indent: a CSS unit for a width that's used to indent the nodes in the tree view (i.e. "1rem" or "10px")
    - selectedNodes: an array of the IDs of nodes that are currently selected

    Events:
    - select: emitted when a user selects a node (or a range of nodes if allowed). The first argument is the event of the click and the second is the array of selected node IDs.
    - toggle: emitted when a user toggles a node (i.e. to expand it). The first argument is the event of the click and the second is the node that was toggled.
    - handleDrag: emitted when a user starts a drag operation. The first argument is the event of the drag and the second is the node that is being dragged.
                  You can set the dataTransfer of the drag operation here.
    - handleNodeDrop: emitted when a user drops a node on another node. The first argument is the event of the drop and the second is the node that is being dropped.
    - handleDividerDrop: emitted when a user drops a node on a divider. The first argument is the event of the drop, the second is the node that is being dropped and the third is the index of the divider.
-->
<template>
  <!-- The wrapper element must handle the different drag events to prevent flickering when moving the mouse cursor. -->
  <div
    ref="wrapper"
    class="wrapper"
    @dragstart="onDragStart($event)"
    @dragover.stop.prevent="onDragOver($event)"
    @dragenter.stop.prevent="onDragOver($event)"
    @dragleave.stop.prevent="onDragLeave($event)"
    @dragend="onDragEnd($event)"
  >
    <!-- Render a TreeViewNode for every child in the "value" array and pass on all the props to the TreeViewNodes. -->
    <TreeViewNode
      v-for="elem of value"
      :value="elem"
      :style="'margin-left: ' + indent"
      :in-drag-mode="inDragMode"
      :get-children="getChildren"
      :parse-node="parseNode"
      :is-drop-target-for="isDropTargetFor"
      :selected-node-i-ds="selectedNodeIDs"
      :currently-dragged-node="currentlyDraggedNode"
      :indent="indent"
      :allow-reordering="allowReordering"
      @contextmenu="handleContextMenu"
      @select="handleSelect"
      @doubleclick="handleDoubleClick"
      @toggle="(ev, data) => $emit('toggle', ev, data)"
      @nodeOnDrag="handleDrag"
      @nodeOnNodeDrop="handleNodeDrop"
      @nodeOnDividerDrop="handleDividerDrop"
    >
      <!-- Insert the "content" slot into the "content" template of the TreeView, so the template passed in by the user can
           be used by the TreeViewNodes children too. -->
      <template #content="{ node }">
        <slot name="content" :node="node"></slot>
      </template>
    </TreeViewNode>
  </div>
</template>

<style scoped>
.wrapper {
  overflow-x: hidden;
  container-type: inline-size;
}
</style>

<script>

import { watch } from 'vue'
import TreeViewNode from './TreeViewNode.vue'

export default {
  components: { TreeViewNode },
  props: {
    // An array of nodes, where every node is an object.
    value: Array,

    // Whether or not the TreeView should allow selecting multiple nodes at the same time.
    allowMultiselect: Boolean,

    // Whether or not the TreeView should allow reordering nodes (and render dividers).
    allowReordering: Boolean,

    // A function that takes in a node and returns an array of its children.
    getChildren: Function,

    // A function that takes in a node and returns data that is required to render the node.
    // See the comment at the top of this file for more information.
    parseNode: Function,

    // A function that takes two nodes and decides if the first node can be dropped on the second node.
    isDropTargetFor: Function,

    // An array of the IDs of currently selected nodes.
    selectedNodes: Array,

    // How much the TreeViewNodes should be indented, expressed in CSS units (i.e. "1rem" or "10px").
    indent: String,

    allowEdit: {
      type: Boolean,
      default: true
    }
  },
  emits: ['select', 'doubleclick', 'toggle', 'handleDrag', 'handleNodeDrop', 'handleDividerDrop', 'contextmenu'],
  data: () => ({
    // Whether or not the TreeView is currently in drag mode.
    inDragMode: false,
    // The node that is currently being dragged.
    currentlyDraggedNode: {},
    // The node that was selected directly (i.e. because the user clicked on it, not because it was part of a range selection).
    // This is used to give a nice user experience when the user selects multiple nodes.
    directlySelectedNode: null,
    // Array of the IDs of the currently selected nodes.
    selectedNodeIDs: [],
  }),
  created() {
    watch(() => [this.selectedNodes], (newValues) => {
      this.selectedNodeIDs = newValues[0].map((elem) => this.parseNode(elem).id)
    });
  },
  methods: {
    // When a drag starts, we want to clear the selected nodes and highlight drop targets (i.e. show items grayed out).
    onDragStart(ev) {
      this.inDragMode = true
    },
    // When a drag ends, we want to go back to the normal display.
    onDragEnd() {
      this.inDragMode = false
    },
    // When a drag operation enters a node, we need to prevent flickering of the cursor, by setting the dropEffect.
    onDragOver(ev) {
      if (!this.inDragMode) {
        this.inDragMode = true
      }

      ev.dataTransfer.dropEffect = 'move'
      return false
    },
    // When the users cursor leaves during a drag operation, we want to go back to the normal display.
    // Otherwise we can't detect when the user finishes the drag operation by dropping the dragged element on another (external) component.
    onDragLeave(ev) {
      // If this drag leave event occured inside the wrapper, then the users cursor did not really leave, but just entered another element.
      const isInside = this.$refs.wrapper.contains(ev.relatedTarget)

      if (this.inDragMode && !isInside) {
        this.inDragMode = false
      }
    },
    handleContextMenu(event, data, disabled) {
      if (!disabled)
        this.$emit('contextmenu', event, data);
    },
    handleDoubleClick(event, data, disabled) {
      if (!disabled)
        this.$emit('doubleclick', event, data);
    },
    // Select nodes when the user clicks on a node.
    handleSelect(event, data, shouldDisable) {
      // If the user clicked on a disabled node without holding shift, we deselect all nodes.
      if ((!event || !event.shiftKey) && shouldDisable) {
        this.directlySelectedNode = null
        this.$emit('select', event, []);
        return;
      }

      // If the user is holding shift, we want to select all nodes between the previously selected node and the currently selected node.
      if (
        event.shiftKey &&
        this.directlySelectedNode &&
        this.allowMultiselect
      ) {
        // First determine the visible nodes.
        const apparentView = this.getApparentView(this.value)
        const visibleNodeIDs = apparentView.map(
          (elem) => this.parseNode(elem).id
        )

        // Find the index of the previously selected node and the currently selected node.
        const indexOfPrevious = visibleNodeIDs.indexOf(
          this.parseNode(this.directlySelectedNode).id
        )
        const indexOfCurrent = visibleNodeIDs.indexOf(this.parseNode(data).id)
        const lowerBound = Math.min(indexOfPrevious, indexOfCurrent)
        const upperBound = Math.max(indexOfPrevious, indexOfCurrent)

        // Collect all nodes between the previously selected node and the currently selected node.
        const selectedNodes = []
        for (let i = lowerBound; i <= upperBound; i++) {
          // Only select nodes in the selection that are not disabled.
          if (!this.parseNode(apparentView[i]).disabled) {
            selectedNodes.push(apparentView[i])
          }
        }

        this.$emit('select', event, selectedNodes)
      }
      // If the user is holding CTRL, we want to to toggle the selection of the clicked node.
      else if (
        event.ctrlKey &&
        this.directlySelectedNode &&
        this.allowMultiselect
      ) {
        const clickedNodeIsSelected = this.selectedNodes.find(node => node.id === data.id);
        const newSelection = clickedNodeIsSelected
          ? this.selectedNodes.filter(node => node.id !== data.id)
          : [...this.selectedNodes, data];

        this.directlySelectedNode = data
        this.$emit('select', event, newSelection)
      }
      // If this is a normal selection, we only select the node the user clicked on, unless it's disabled.
      else {
        let newSelection = [data]
        this.directlySelectedNode = data

        if (shouldDisable) {
          newSelection = []
          this.directlySelectedNode = data
        }
        this.$emit('select', event, newSelection)
      }
    },
    // When a user drops something on a node, we want to check if the drop is valid and then emit the handleNodeDrop event.
    handleNodeDrop(event, data, valid) {
      event.preventDefault()
      this.inDragMode = false

      if (valid && this.allowEdit) {
        this.$emit('handleNodeDrop', event, data)
      }
    },
    
    handleDividerDrop(event, data, index) {
      event.preventDefault()
      this.inDragMode = false

      if (this.allowEdit) {
        this.$emit('handleDividerDrop', event, data, index)
      }
    },
    // When a user starts dragging a node we want to store the dragged node.
    handleDrag(event, data) {
      this.currentlyDraggedNode = data
      this.$emit('handleDrag', event, data)
    },
    // This function returns an array of the nodes that are currently visible.
    // If a node is expanded, it's children are also visible. Otherwise only the node itself is visible.
    getApparentView(value) {
      const res = []
      for (const elem of value) {
        if (this.parseNode(elem).isExpanded) {
          res.push(elem)
          res.push(...this.getApparentView(this.getChildren(elem)))
        } else {
          res.push(elem)
        }
      }
      return res
    },
  },
}
</script>

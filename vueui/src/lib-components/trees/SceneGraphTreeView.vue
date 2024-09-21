<!--
    The SceneGraphTreeView component renders a list of "blocks" from the engine as a tree view.
-->
<template>
  <TreeView
    :value="value"
    :allow-multiselect="true"
    :allow-reordering="true"
    :allow-edit="allowEdit"
    :get-children="getChildren"
    :parse-node="parseNode"
    :is-drop-target-for="isDropTargetFor"
    :selected-nodes="selectedNodes"
    indent="0.5rem"
    @contextmenu="(ev, data) => $emit('contextmenu', ev, data)"
    @handleNodeDrop="handleNodeDrop"
    @handleDividerDrop="handleDividerDrop"
    @handleDrag="handleDrag"
    @doubleclick="(ev, data) => $emit('doubleclick', ev, data)"
    @select="(ev, data) => $emit('select', ev, data)"
    @toggle="(ev, data) => $emit('toggle', ev, data)"
  >
    <template #content="{ node }">
      <!-- Display an icon for every item. -->
      <div class="item-icon">
        <font-awesome-icon
          :icon="getItemIcon(node.type)"
          :color="$root.iconColor"
        />
      </div>

      <!-- We use :set here to be able to access the node information, while also falling back to an empty object. -->
      <div
        class="itemTitle"
        :class="node.computed.active === false ? 'itemInactive' : ''"
      >
        <!-- Show the item name as inactive if the item is disabled. -->
        <span>
          {{ node.computed.name || node.displayName }}
        </span>

        <!-- If the item is disabled, show a status behind the item name.  -->
        <span v-if="node.computed.active === false" class="itemDisabled">
          (Disabled)
        </span>

        <!-- If the item has any scripts attached, show the number of scripts. -->
        <div v-if="node.scriptCount" class="item-scriptcount">
          ({{ node.scriptCount }} Script{{ node.scriptCount > 1 ? 's' : '' }})
        </div>
      </div>

      <!-- Display the node type on the right side (i.e. "Mesh" or "Lightsource") -->
      <i class="treeSidebarGrey">{{ node.type }}</i>
    </template>
  </TreeView>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
}

.itemTitle {
  flex: 1;
  margin-left: 0.6rem;
  display: flex;
  white-space: nowrap;
}

.item-scriptcount {
  width: 12px;
  display: inline-block;
  opacity: 0.7;
  margin-left: 0.4rem;
}

.itemDisabled {
  margin-left: 0.4rem;
}

.itemInactive {
  opacity: 0.35;
}
</style>

<script>
import TreeView from './TreeView.vue'
import uitools from '../../js-modules/uitools.js'

export default {
  components: { TreeView },
  props: {
    value: Array,
    allowUpload: Boolean,
    allowEdit: {
      type: Boolean,
      default: true
    },
    selectedNodes: Array,
  },
  emits: ['toggle', 'select', 'doubleclick', 'reloadFolder', 'moveItem', 'upload', 'contextmenu'],
  methods: {
    // This method extracts the value of a field from a block.
    // For some reason the functions that the block provides to do the same thing are not available here.
    findFieldInBlock(block, fieldName) {
      for (const field of block.fields || []) {
        if (field.name === fieldName) return field.value
      }
      return null
    },
    getChildren(node) {
      return node.blocks
    },
    parseNode(node) {
      return {
        id: node.id,
        isLeaf: node.blocks.length === 0,
        isExpanded: node.isExpanded,
        isDraggable: node.isDraggable,
      }
    },
    // It would be better if we only allow the drop for items that are actually droppable, like scripts, but that
    // is not possible because we cannot access the dataTransfer information from the drag event.
    // So instead we show every node as a valid drop target.
    isDropTargetFor(nodeAbove, nodeTarget, ev) {
      return true
    },
    handleDrag(event, node) {
      const draggedNodeIsInSelectedNodes = this.selectedNodes.find(selectedNode => selectedNode.id === node.id) 
      
      const draggedNodes = draggedNodeIsInSelectedNodes 
        ? this.selectedNodes
        : [node]

      const draggedNodesInfo = draggedNodes.map(node => ({
        id: node.id,
        folder: node.folder,
        type: node.type,
        elementType: node.elementType,
      }))

      event.dataTransfer.setData("draggedNodes", JSON.stringify(draggedNodesInfo))
    },
    async handleNodeDrop(event, destNode) {
      event.preventDefault()

      let files = event.target.files || event.dataTransfer.files
      if (files && files.length) {
        // Print out a warning message when the user tries to drag files directly to the scenegraph.
        console.warn(
          'Dropping files directly to the scenegraph is not supported. Upload them first in the asset view, then drag them here.'
        )

        return
      } 

      // If the user dragged items from the AssetView, we emit the "treeItemDrop" event, which will be handled by the engine.
      const draggedNodes = JSON.parse(event.dataTransfer.getData("draggedNodes"))
      const draggedItems = draggedNodes.map(node => ({
        id: node.id,
        type: node.type
      }))

      this.$store.state.nkclient.eventBus.$emit('nk:engine:treeItemDrop', draggedItems, destNode.id)
    },
    async handleDividerDrop(event, parentNode, index) {
      event.preventDefault()

      let files = event.target.files || event.dataTransfer.files
      if (files && files.length) {
        // Print out a warning message when the user tries to drag files directly to the scenegraph.
        console.warn(
          'Dropping files directly to the scenegraph is not supported. Upload them first in the asset view, then drag them here.'
        )

        return
      } 

      const draggedNodes = JSON.parse(event.dataTransfer.getData("draggedNodes"))
      const draggedIds = draggedNodes.map(node => node.id)
      const dividerParentNodeId = parentNode.id

      this.$store.state.nkclient.eventBus.$emit('nk:engine:treeItemDividerDrop', draggedIds, dividerParentNodeId, index)
    },
    getItemStyle(node) {
      if (node && node.data) {
        if (!node.data.isItem) {
          return 'color: #ffffff'
        }
      }

      return 'color: #d0d0d0'
    },

    getItemIcon(type) {
      return uitools.getItemIcon(type)
    },
  },
}
</script>

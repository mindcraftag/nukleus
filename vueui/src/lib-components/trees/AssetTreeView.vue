<!--
    The AssetTreeView renders a list of files and folders as a tree structure, with support for thumbnails.
-->
<template>
  <!-- We give the TreeView a custom key property, so we can force it to rerender whenever we change the thumbnails. -->
  <TreeView
    :key="key"
    ref="treeView"
    :value="value"
    :allow-multiselect="true"
    :get-children="getChildren"
    :parse-node="parseNode"
    :is-drop-target-for="isDropTargetFor"
    :selected-nodes="selectedNodes"
    indent="1rem"
    @contextmenu="(ev, data) => $emit('contextmenu', ev, data)"
    @select="(ev, data) => $emit('select', ev, data)"
    @toggle="(ev, data) => $emit('toggle', ev, data)"
    @handleDrag="handleDrag"
    @handleNodeDrop="handleNodeDrop"
    @doubleclick="(ev, data) => $emit('doubleclick', ev, data)"
  >
    <template #content="{ node }">
      <!-- Display a folder icon if the node is not an item, or otherwise the thumbnail. -->
      <div class="item-icon" style="margin-right: 4px">
        <v-icon v-if="!node.data.isItem">
          {{ node.isExpanded ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <ItemThumbnail v-else
                       :size="16"
                       :fetch-size="32"
                       icon-size="1x"
                       :item="node.data"
                       :show-icon-fallback="true">
        </ItemThumbnail>
      </div>

      <!-- Display the title and then some information about item. -->
      <span class="itemTitle" :style="getItemStyle(node)">
        {{ node.title }}
        <font-awesome-icon
          v-if="!node.data.isItem && !node.data.isWritable"
          :icon="['fal', 'lock']"
          color="#808080"
        />
        <font-awesome-icon
          v-if="isItemNotListed(node)"
          :icon="['fal', 'globe']"
          color="#00ff00"
        />
        <font-awesome-icon
          v-if="isItemPublic(node)"
          :icon="['fal', 'globe']"
          color="#0080ff"
        />
      </span>

      <i v-if="node.data.totalSize" class="assetSize">
        {{ formatSize(node.data.totalSize) }}
      </i>

      <!-- Display the type of this item (i.e. "Script" or "Mesh") -->
      <i v-if="node.data.type && node.data.type !== 'root'" class="itemType">
        {{ node.data.type === 'Package' ? node.data.packageType + " (Packaged)" : node.data.type }}

        <!-- Display the MIME type of this item (i.e. "text/x-lua")-->
        <i v-if="node.data.mimeType" class="mimeType">
          {{ shortenMimeType(node.data.mimeType) }}
        </i>
      </i>
    </template>
  </TreeView>
</template>

<style scoped>

.wrapper {
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  padding: 0.5rem;
}

.itemTitle {
  flex: 1;
  white-space: nowrap;
  margin-right: 1rem;
}

.assetSize {
  flex: 1;
  color: var(--color-grey);
  white-space: nowrap;
  margin-right: 1rem;
}

.itemType {
  flex: 1;
  color: var(--color-grey);
  white-space: nowrap;
}

.mimeType {
  color: var(--color-grey);
  white-space: nowrap;
}

@container (max-width: 400px) {

  .itemType {
    flex: 0;
  }

  .assetSize {
    display: none;
  }

  .mimeType {
    display: none;
  }
}

</style>

<script>

import TreeView from './TreeView.vue'
import uitools from '../../js-modules/uitools'
import lodash from 'lodash'
import ItemThumbnail from "../helpers/ItemThumbnail.vue";

export default {
  components: {ItemThumbnail, TreeView },
  props: {
    value: Array,
    selectedNodes: Array,
    allowUpload: Boolean,
  },
  emits: ['toggle', 'select', 'reloadFolder', 'moveItem', 'upload', 'contextmenu', 'doubleclick'],
  data: () => ({
    key: Date.now().toString()
  }),
  methods: {
    shortenMimeType(mimeType) {
      switch(mimeType) {
        case "image/png": return "(Png)";
        case "image/jpeg": return "(Jpeg)";
        case "model/gltf-binary": return "(Glb)";
        case "model/obj": return "(Obj)";
        case "image/fbx": return "(Fbx)";
        case "image/draco": return "(Draco)";
        case "image/ply": return "(Ply)";
      }
      return "";
    },
    formatSize: function(value) {
      const units = ['bytes', 'kb', 'MB'];
      let i=0;

      while(true) {
        if (value < 1024 || i===units.length-1) {
          const v = Math.floor(value*100)/100;
          return `${v} ${units[i]}`;
        }
        value /= 1024;
        i++;
      }
    },
    getChildren(node) {
      return node.children
    },
    parseNode(node) {
      return {
        id: node.data.id,
        isLeaf: node.isLeaf,
        isExpanded: node.isExpanded,
        isDraggable: true,
      }
    },
    isDropTargetFor(nodeAbove, nodeTarget) {
      return !nodeTarget.data.isItem
    },
    handleDrag(event, node) {
      const draggedNodeIsInSelectedNodes = this.selectedNodes.find(selectedNode => selectedNode.data.id === node.data.id) 

      const draggedNodes = draggedNodeIsInSelectedNodes 
        ? this.selectedNodes
        : [node]

      const draggedNodesInfo = draggedNodes.map(node => ({
        id: node.data.id,
        folder: node.data.parentId || 0,
        isItem: node.data.isItem,
        type: node.data.type,
        elementType: node.data.elementType,
        packageType: node.data.packageType
      }))

      event.dataTransfer.setData("draggedNodes", JSON.stringify(draggedNodesInfo))
    },
    async handleNodeDrop(event, node) {
      event.preventDefault()

      const destFolderId = node.data.id

      let files = event.target.files || event.dataTransfer.files
      if (files && files.length) {
        // If files where dropped and we allow the upload of items, then emit the "upload" event.
        // ---------------------------------------------------------------------------------
        if (this.allowUpload) {
          this.$emit('upload', files, destFolderId)
        } else {
          console.warn('Dropping files is not supported.')
        }
      } else {
        // If the drop event did not contain any items, then check if it is a move operation.
        // ---------------------------------------------------------------------------------
        const draggedNodes = JSON.parse(event.dataTransfer.getData("draggedNodes"))
        const items = [];
        const folders = [];
        
        for (const draggedNode of draggedNodes) {
          const sourceItemId = draggedNode.id
          const sourceFolderId = draggedNode.folder
          const sourceIsItem = draggedNode.isItem

          if (!sourceItemId) continue;

          if (sourceIsItem) {
            items.push({ _id: sourceItemId, sourceFolderId });
          } else {
            folders.push({ _id: sourceItemId, sourceFolderId });
          }
        }

        this.deselectAll();
        await this.moveItemsAndFolders(items, folders, destFolderId);
      }
    },
    async moveItemsAndFolders(items, folders, destFolderId) {
      try {
        const foldersToRefresh = new Map();
        foldersToRefresh.set(destFolderId, true);

        // Emit the "moveItem" event, so the parent component can perform an optimistic update.
        // -----------------------------------------------------------------------------------------
        for (const item of items) {
          this.$emit('moveItem', item._id, item.sourceFolderId, destFolderId);
          foldersToRefresh.set(item.sourceFolderId, true);
        }

        for (const folder of folders) {
          this.$emit('moveItem', folder._id, folder.sourceFolderId, destFolderId);
          foldersToRefresh.set(folder.sourceFolderId, true);
        }

        // Move items and folders
        // -----------------------------------------------------------------------------------------
        if (items.length) {
          await this.$store.state.nkclient.moveItems({
            items: items.map(x => x._id),
            dest: destFolderId,
          });
        }

        if (folders.length) {
          await this.$store.state.nkclient.moveFolders({
            folders: folders.map(x => x._id),
            dest: destFolderId,
          });
        }

        // Reload the affected folders to make sure that the UI is up to date.
        // This is especially important if the move operation failed on the server,
        // so we can go back to a consistent state.
        // -----------------------------------------------------------------------------------------
        for (const folderId of foldersToRefresh.keys()) {
          this.$emit('reloadFolder', folderId);
        }
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    deselectAll() {
      this.$emit('select', null, []);
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
    isItemPublic(node) {
      if (node && node.data) {
        if (node.data.isItem) {
          if (node.data.visibility >= 2)
            return true
        }
      }
      return false
    },

    isItemNotListed(node) {
      if (node && node.data) {
        if (node.data.isItem) {
          if (node.data.visibility === 2)
            return true
        }
      }
      return false
    },
    // This function is used to force the TreeView to update.
    // It will only execute once every 400ms at most.
    forceUpdate: lodash.debounce(function (_this) {
      _this.key = Date.now().toString()
    }, 400),
  },
}

</script>

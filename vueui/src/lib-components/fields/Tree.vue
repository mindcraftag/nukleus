<template>
  <div>
    <div :class="cssClassesContainer">
      <div :class="cssClasses">
        <v-card>
          <v-card-text class="treeOptionsContainer pa-1">
            <div>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn size="x-small" class="bg-main" :disabled="!canAddItem" v-bind="props">
                    <font-awesome-icon :icon="['fal', 'plus']" size="1x" />
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-for="(entry, index) in templates"
                    :key="index"
                    @click="handleAddSelection(entry)"
                  >
                    <v-list-item-title>{{ entry.typeName }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
              <v-btn
                size="x-small"
                class="bg-main"
                :disabled="!canDeleteItems"
                @click="removeSelectedNodes"
              >
                <font-awesome-icon :icon="['fal', 'minus']" size="1x" />
              </v-btn>
              <v-btn
                size="x-small"
                class="bg-main"
                :disabled="!canCloneItems"
                @click="cloneSelectedNodes"
              >
                <font-awesome-icon :icon="['fal', 'clone']" size="1x" />
              </v-btn>
            </div>
            <v-text-field
              v-model="searchQuery"
              label="Search"
              density="compact"
              variant="underlined"
              single-line
              hide-details
              class="searchQuery"
            >
              <template v-slot:prepend>
                <v-icon small> mdi-magnify </v-icon>
              </template>
              <template v-slot:append v-if="searchQuery.length > 0">
                <v-icon small @click="() => searchQuery=''"> mdi-close </v-icon>
              </template>
            </v-text-field>

          </v-card-text>
        </v-card>
        <div ref="treeContainerScrollarea" class="treeContainerScrollarea">
          <SceneGraphTreeView
            :value="searchFilteredData"
            :selected-nodes="selectedNodes"
            :allow-edit="allowEdit"
            @doubleclick="handleDoubleClick"
            @contextmenu="onContextMenu"
            @select="handleSelect"
            @toggle="handleToggle"
          ></SceneGraphTreeView>
        </div>
      </div>
      <div class="treeContainerFields">
        <Fields
          :value="selectedFields"
          :block="selectedBlock"
          :allow-edit="allowEdit"
          :is-list="false"
          :studio-mode="studioMode"
          :item-repo="itemRepo"
          :allow-scripts="true"
          :node-name-resolver="nodeNameResolver"
          :layer-titles="layerTitles"
          :project-folder-id="projectFolderId"
          @changed="$emit('changed')"
        />
      </div>
    </div>
  </div>

  <v-menu
    v-model="showContextMenu"
    v-if="allowEdit"
    close-on-content-click
    offset-y
    :nudge-width="200"
    :style="{ position: 'absolute', top: contextMenuY + 'px', left: contextMenuX + 'px' }"
  >
    <v-list density="compact">
      <v-list-item @click=""> <!-- click event handler is just for styling -->
        <v-menu>
          <template #activator="{ props }">
            <v-list-item-title v-bind="props">Add item</v-list-item-title>
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="(entry, index) in templates"
              :key="index"
              @click="addTreeEntryToSelectedNodes(entry)"
            >
              <v-list-item-title>{{ entry.typeName }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-list-item>
      <v-list-item @click="removeSelectedNodes">
        <v-list-item-title>Remove</v-list-item-title>
      </v-list-item>
      <v-list-item @click="cloneSelectedNodes">
        <v-list-item-title>Clone</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
<script>

import { toRaw } from 'vue'
import uitools from '../../js-modules/uitools'
import SceneGraphTreeView from '../trees/SceneGraphTreeView.vue'
import lodash from 'lodash'

export default {

  name: 'Tree',

  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    SceneGraphTreeView,
  },

  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    modelValue: {
      type: Array,
    },
    title: {
      type: String,
    },
    allowEdit: {
      type: Boolean,
    },
    templates: {
      type: Array,
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

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    data: [],
    activeNode: null,
    selectedNodes: [],
    searchQuery: "",
    clipboard: {type: null, nodes: []},
    showContextMenu: false,
    contextMenuX: 0,
    contextMenuY: 0,
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    cssClasses: {
      get() {
        if (this.studioMode) {
          return 'treeContainerTree treeContainerTreeStudio'
        } else if (this.$store.state.darkMode) {
          return 'treeContainerTree treeContainerTreeDark'
        } else {
          return 'treeContainerTree treeContainerTreeLight'
        }
      },
    },
    cssClassesContainer: {
      get() {
        if (this.studioMode) {
          return 'treeContainer treeContainerStudio'
        } else if (this.$store.state.darkMode) {
          return 'treeContainer treeContainerDark'
        } else {
          return 'treeContainer treeContainerLight'
        }
      },
    },
    selectedFields: {
      get() {
        if (this.activeNode && this.activeNode.fields) {
          return this.activeNode.fields
        } else {
          return null
        }
      },
    },
    selectedBlock: {
      get() {
        if (this.activeNode) {
          return this.activeNode
        } else {
          return null
        }
      },
    },
    canAddItem: {
      get() {
        return this.allowEdit && this.selectedNodes.length !== 0
      },
    },
    canDeleteItems: {
      get() {
        if (!this.allowEdit) return false
        if (this.selectedNodes.length === 0) return false
        if (this.selectedNodes.every(node => node.parent)) return true

        return false
      },
    },
    canCloneItems: {
      get() {
        if (!this.allowEdit) return false
        if (this.selectedNodes.length === 0) return false
        if (this.selectedNodes.every(node => node.parent)) return true

        return false
      },
    },
    searchFilteredData: {
      get() {
        if (this.searchQuery.trim() === "") return this.data

        // make copy of the tree and trim it based on search query
        const treeCopy = structuredClone(toRaw(this.data))
        this.markSearchMatches(treeCopy, treeCopy[0])
        this.trimForSearchMatches(treeCopy[0])
        return treeCopy
      }
    }
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    markSearchMatches(root, node) {
      const displayName = node.computed.name && node.computed.name.length > 0
                            ? node.computed.name
                            : node.displayName;
      const nameToQuery = displayName.toLowerCase();
      const searchQuery = this.searchQuery.toLowerCase()

      // mark current node and its ancestors to prevent deletion later
      if (nameToQuery.includes(searchQuery)) {
        let currNode = node;

        while (currNode) {
          currNode.matchesSearch = true
          currNode = this.findNodeById(root, currNode.parentId)
        }
      }

      for (const block of node.blocks) {
        this.markSearchMatches(root, block)
      }
    },
    trimForSearchMatches(node) {
      node.blocks = node.blocks.filter(block => block.matchesSearch)

      for (const block of node.blocks) {
        this.trimForSearchMatches(block)
      }
    },
    findFieldInBlock(block, fieldName) {
      for (const field of block.fields || []) {
        if (field.name === fieldName) return field.value
      }
      return null
    },

    copyBlocks(blocks, isRoot) {
      const copy = []
      for (const block of blocks) {
        const prevNode = this.findNodeById(this.data, block.id)

        copy.push({
          id: block.id,
          isRoot: !!isRoot,
          displayName: block.displayName,
          name: block.name,
          computed: {
            active: this.findFieldInBlock(block, 'Active'),
            name: this.findFieldInBlock(block, 'Name'),
          },
          elementType: 'ScenegraphNode',
          isExpanded: prevNode ? prevNode.isExpanded : true,
          isSelected: block.isSelected,
          isDraggable: isRoot ? false : true,
          scriptCount: block.scripts.length,
          type: block.type,
          parentId: block.parent ? block.parent.id : null,
          blocks: this.copyBlocks(block.blocks),
        })
      }

      return copy
    },

    // We don't want to pass on the data as it is directly to the tree view, because the data (i.e. the prop "value") is coming
    // straight from the engine and changes very rapidly. Therefore we make a copy of it and pass that to the tree view.
    updateData: lodash.throttle(_this => {
      _this.data = _this.copyBlocks(_this.modelValue, true)
    }, 250),

    deselectAll() {
      this.activeNode = null
      this.selectedNodes = []
    },

    getItemIcon(type) {
      return uitools.getItemIcon(type)
    },

    async addTreeEntryToSelectedNodes(templateEntry) {
      const newNodes = this.selectedNodes.map(node => this.addTreeEntry(templateEntry, node));

      return Promise.all(newNodes);
    },

    async addTreeEntry(templateEntry, newParentNode) {
      const newBlock = await this.itemRepo.createNewBlock(templateEntry, newParentNode)

      this.$emit('update:modelValue', this.modelValue)
      this.$emit('changed')

      return newBlock
    },

    removeSelectedNodes() {
      for (const node of this.selectedNodes) {
        this.removeNode(node)
      }
    },

    removeNode(node) {
      const parent = node.parent

      if (!parent) return;

      this.itemRepo.removeBlock(node, parent)

      if (node === this.activeNode) {
        this.activeNode = null
      }

      // deselect all selected non-root nodes
      this.selectedNodes = this.selectedNodes.filter(node => !node.parent)
    },

    moveTreeEntries(nodes, parent) {
      const nodeIds = nodes.map(node => node.id)
      const parentId = parent.id
      
      this.$store.state.nkclient.eventBus.$emit('nk:engine:treeCutPaste', nodeIds, parentId)
    },

    cloneTreeEntries(nodes, parent) {
      for(const node of nodes) {
        const newParent = parent ?? node.parent
        this.cloneNode(node, newParent)
      }
    },

    cloneSelectedNodes() {
      for (const node of this.selectedNodes) {
        this.cloneNode(node, node.parent)
      }
    },

    cloneNode(node, parent) {
      if (!node || !parent) return

      return this.itemRepo.cloneBlock(node, parent)
    },

    emitSelectionEvent(ids) {
      const selectionIds = ids ?? this.selectedNodes.map(node => node.id)
      this.$store.state.nkclient.eventBus.$emit('nk:sgitem:selected', selectionIds)
    },

    handleDoubleClick(ev, node) {
      this.$store.state.nkclient.eventBus.$emit('nk:sgitem:doubleClick', node.id)
    },

    handleSelect(ev, nodes) {
      this.setSelectedNodes(nodes)
      this.emitSelectionEvent()
    },

    setSelectedNodes(nodes) {
      this.selectedNodes = nodes

      if (nodes.length > 0) {
        this.activeNode = nodes[0]
      } else {
        this.activeNode = null
      }

      // open all parents of the selected nodes
      for (const node of this.selectedNodes) {
        if (!node) continue

        let parentId = node.id

        while (parentId) {
          const node = this.findNodeById(this.searchFilteredData, parentId)
          if (!node)
            break

          node.isExpanded = true
          parentId = node.parentId
        }
      }
    },

    handleToggle(ev, node) {
      node.isExpanded = !node.isExpanded
    },

    findNodeById(blocks, id) {
      for (const elem of blocks) {
        if (elem.id === id) return elem
        else {
          const res = this.findNodeById(elem.blocks, id)
          if (res) return res
        }
      }

      return null
    },

    cut(e) {
      // Do nothing if we cut from an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      this.clipboard.type = "CUT"
      this.clipboard.nodes = [...this.selectedNodes]
    },

    copy(e) {
      // Do nothing if we copy from an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      this.clipboard.type = "COPY"
      this.clipboard.nodes = [...this.selectedNodes]
    },

    paste(e) {
      if (!this.activeNode) return

      // Do nothing if we paste into an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (this.clipboard.type === "COPY") {
        this.cloneTreeEntries(this.clipboard.nodes, this.activeNode)
      } else if (this.clipboard.type === "CUT") {
        this.moveTreeEntries(this.clipboard.nodes, this.activeNode)
        this.resetClipboard()
      }
    },

    resetClipboard() {
      this.clipboard.nodes = []
      this.clipboard.type = null
    },

    clone() {
      this.cloneTreeEntries(this.clipboard.nodes)
    },

    onContextMenu(event, node) {
      const foundContextNodeInSelectedNodes = this.selectedNodes.find(selectedNode => selectedNode.id === node.id)

      if (!foundContextNodeInSelectedNodes) {
        const contextMenuNode = this.findNodeById(this.modelValue, node.id)
        this.setSelectedNodes([contextMenuNode])
        this.emitSelectionEvent()
      }

      this.showContextMenu = true
      this.contextMenuX = event.clientX
      this.contextMenuY = event.clientY
    },

    async handleAddSelection(entry) {
      const newSelectedNodes = await this.addTreeEntryToSelectedNodes(entry)

      this.$nextTick(() => {
        const newSelectedNodeIds = newSelectedNodes.map(node => node.id)
        this.emitSelectionEvent(newSelectedNodeIds)
      })
    },

    onItemsSelected(ids) {
      const newSelectedNodes = ids.map(id => this.findNodeById(this.modelValue, id))
      this.setSelectedNodes(newSelectedNodes)
    }
  },

  mounted() {
    const client = this.$store.state.nkclient
    const eventBus = client.eventBus
    const itemRepo = client.itemRepo
    const shortcuts = client.profiler.engine.shortcuts

    this.onItemsSelected(itemRepo.selectedSgItems);

    eventBus.$on('nk:sgitem:selected', (ids) => this.onItemsSelected(ids))

    eventBus.$on('nk:itemRepo:blockAdded', () => this.updateData(this))
    eventBus.$on('nk:itemRepo:scriptAdded', () => this.updateData(this))
    eventBus.$on('nk:itemRepo:scriptDeleted', () => this.updateData(this))
    eventBus.$on('nk:itemRepo:blockDeleted', () => this.updateData(this))
    eventBus.$on('nk:itemRepo:fieldChanged', () => this.updateData(this))

    shortcuts.on('Cut', this.cut)
    shortcuts.on('Copy', this.copy)
    shortcuts.on('Paste', this.paste)
    shortcuts.on('Clone', this.clone)

    this.updateData(this)
  },

  beforeUnmount() {
    const client = this.$store.state.nkclient
    const eventBus = client.eventBus
    const shortcuts = client.profiler.engine.shortcuts

    eventBus.$offByOwner('nk:itemRepo:blockAdded', this)
    eventBus.$offByOwner('nk:itemRepo:scriptAdded', this)
    eventBus.$offByOwner('nk:itemRepo:scriptDeleted', this)
    eventBus.$offByOwner('nk:itemRepo:blockDeleted', this)
    eventBus.$offByOwner('nk:itemRepo:fieldChanged', this)

    shortcuts.off('Cut', this.cut)
    shortcuts.off('Copy', this.copy)
    shortcuts.off('Paste', this.paste)
    shortcuts.off('Clone', this.clone)
  }
}
</script>

<style>
  .searchQuery {
    width: auto !important;
  }

  .searchQuery .v-field__input {
    font-size: 11.5px !important;
    padding: 4px 4px 16px 8px !important;
  }

  .searchQuery .v-field-label {
    --v-field-padding-start: 4px !important;
  }
  .searchQuery .v-input__prepend {
    margin-inline-end: 4px !important;
  }
  .searchQuery .v-field__field {
    height: 24px !important;
  }
  .treeOptionsContainer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background-color: var(--color-dark-main-highlight1) !important;
  }
</style>

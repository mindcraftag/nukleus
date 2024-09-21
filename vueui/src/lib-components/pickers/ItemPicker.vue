<template>
  <v-progress-linear v-if="loading" indeterminate></v-progress-linear>
  <SimpleTreeView :nodes="treeNodes" :fetch-children="loadChildren" @selection-changed="onSelectionChanged">
    <template #prepend="{ node }">
      <div style="margin-right: 8px">
        <font-awesome-icon
            v-if="node.createNew"
            :icon="['fal', 'plus']"
            :color="$root.iconColor"
            size="1x"
        />
        <ItemThumbnail
            v-else-if="node.hasThumbnail"
            :item="node"
            :size="16"
            :fetch-size="32"
        />
        <font-awesome-icon
            v-else
            :icon="getItemIcon(node, node.isExpanded)"
            :color="$root.iconColor"
            size="1x"
        />
      </div>
    </template>
  </SimpleTreeView>
</template>
<script>

import SimpleTreeView from "../trees/SimpleTreeView.vue";
import ItemThumbnail from "../helpers/ItemThumbnail.vue";
import {watch} from "vue";
import { verifyAcl } from '@mindcraftgmbh/nukleus-client-api'
import uitools from "../../js-modules/uitools";

export default {

  // --------------------------------------------------------
  // COMPONENT
  // --------------------------------------------------------
  components: {
    SimpleTreeView,
    ItemThumbnail
  },

  // --------------------------------------------------------
  // PROPS
  // --------------------------------------------------------
  props: {
    itemTypes: {
      type: Array,
    },
    folderId: {
      type: String,
    },
    allowCreate: {
      type: Boolean,
      default: false,
    },
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['selected'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    treeNodes: [],
    selected: [],
    loading: false,
  }),

  // --------------------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------------------
  computed: {
    itemRepo() {
      return this.$store.state.nkclient.getItemRepo()
    },
    rootFolderId() {
      if (!this.itemRepo.jail.active) return 0

      // we're jailed but item is not yet loaded. No directory loading possible
      if (!this.itemRepo.activeItem) return undefined

      // item has no folder so it is in true root.
      if (!this.itemRepo.activeItem.folder) return 0

      // folder is an object. return it's id
      if (this.itemRepo.activeItem.folder._id)
        return this.itemRepo.activeItem.folder._id

      // folder is the Id itself
      return this.itemRepo.activeItem.folder
    },
    mountedFolders() {
      if (!this.itemRepo.jail.active) return []

      return this.itemRepo.jail.mountedFolders
    },
  },

  // --------------------------------------------------------
  // MOUNTED
  // --------------------------------------------------------
  mounted() {
    watch(() => [this.rootFolderId, this.mountedFolders], () => {
      this.reloadFolderHierarchy()
    });

    this.reloadFolderHierarchy();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async canWriteToFolder(folderId) {
      if (this.$store && this.$store.state.me) {
        const userInfo = this.$store.state.me
        const acl = await this.$store.state.nkclient.getFolderAcl(folderId)
        return verifyAcl(userInfo, acl, 'write')
      }

      return false
    },

    getItemIcon(item, open) {
      if (!item.isItem)
        if (open) return ['fal', 'folder-open']
        else return ['fal', 'folder']
      else {
        return uitools.getItemIcon(item.type)
      }
    },

    isItemFiltered(item) {
      if (Array.isArray(this.itemTypes)) {
        return !this.itemTypes.includes(item.type)
      }

      return false
    },

    onSelectionChanged(selection) {
      this.selected = selection;
      this.$emit('selected', selection);
    },

    async loadFolder(folder, includeFolderItselfAsChild) {
      const folderId = folder && folder._id ? folder._id : folder
      const folders = await this.$store.state.nkclient.getFoldersInFolderList(
          folderId,
          { resolveNames: true}
      )
      const items = await this.$store.state.nkclient.getItemsInFolderList(
          folderId
      )

      folders.children.sort(function (a, b) {
        return a.name.localeCompare(b.name)
      })
      items.sort(function (a, b) {
        return a.name.localeCompare(b.name)
      })

      const result = []
      for (const childFolder of folders.children) {
        result.push({
          _id: childFolder._id,
          folderId: childFolder.parent,
          hasThumbnail: false,
          name: childFolder.name,
          children: [],
          isItem: false,
          // While folders should not be selectable, they should not appear disabled, since they can still be opened.
          // Therefore we only set disabled = true, but without showDisabled = true.
          disabled: true,
          parent: folder,
        })
      }

      if (this.allowCreate) {
        const canWrite = await this.canWriteToFolder(folderId)
        if (canWrite) {
          result.push({
            _id: folderId + 'new',
            createNew: true,
            name: 'Create new item',
            isLeaf: true,
            disabled: false,
            parent: folder,
          })
        }
      }

      for (const item of items) {
        result.push({
          _id: item._id,
          folderId: item.folder,
          hasThumbnail: item.thumbnailCount > 0,
          name: item.name,
          type: item.type,
          isItem: true,
          // We set isLeaf = true to tell the TreeView that this node has no children and doesn't need a toggle to expand it.
          isLeaf: true,
          hash: item.hash,
          updatedAt: item.updatedAt,
          disabled: this.isItemFiltered(item),
          showDisabled: this.isItemFiltered(item),
          parent: folder,
        })
      }

      if (includeFolderItselfAsChild) {
        return {
          _id: folderId,
          folderId: null,
          hasThumbnail: false,
          name: folders.parent.name,
          children: result,
          isItem: false,
          disabled: false,
          parent: null,
        }
      }

      return result
    },

    async reloadFolderHierarchy() {
      try {
        if (this.rootFolderId === undefined) return

        this.loading = true

        // Create root node
        // ------------------------------------------------------------------
        this.items = []
        const root = {
          name: '/',
          _id: this.rootFolderId,
          isExpanded: true,
          isLoaded: true,
          children: [],
        }

        // Load the root folder elements
        // ------------------------------------------------------------------
        const treeNodes = []
        if (this.rootFolderId !== undefined) {
          await this.loadChildren(root, true)
          for (const folderId of this.mountedFolders) {
            const additionalChild = await this.loadAdditionalChildren(folderId)
            treeNodes.push(additionalChild)
          }
          treeNodes.push(root)
        }

        // If we're given an initial folder to open, check its path and then expand the tree
        // ------------------------------------------------------------------
        if (this.folderId) {
          const path = await this.$store.state.nkclient.getFolderPath(
              this.folderId
          )
          if (path.elements && path.elements.length > 0) {
            await this.expandTo(path.elements, root.children)
          }
        }

        this.treeNodes = treeNodes
        this.selected = [];
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }

      this.loading = false
    },

    async expandTo(elements, items) {
      if (elements.length) {
        const element = elements[0]
        for (const item of items) {
          if (item._id === element.id) {
            await this.loadChildren(item, true)
            item.isExpanded = true;
            item.isLoaded = true;
            await this.expandTo(elements.slice(1), item.children)
          }
        }
      }
    },

    async loadChildren(item, noSetLoadingFlag) {
      try {
        if (!noSetLoadingFlag) this.loading = true

        item.children = await this.loadFolder(item._id)
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }

      if (!noSetLoadingFlag) this.loading = false
    },

    async loadAdditionalChildren(folderId) {
      return await this.loadFolder(folderId, true)
    },
  },
}
</script>

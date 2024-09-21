<template>
  <v-progress-linear v-if="loading" indeterminate></v-progress-linear>
  <SimpleTreeView :multiselect="multiselect" :nodes="treeNodes" :fetch-children="loadChildren" @selection-changed="onSelectionChanged">
    <template #prepend="{ node }">
      <v-icon style="margin-right: 8px;">
        {{ node.isExpanded ? 'mdi-folder-open' : 'mdi-folder' }}
      </v-icon>
    </template>
  </SimpleTreeView>
</template>
<script>

import SimpleTreeView from "../trees/SimpleTreeView.vue";

export default {

  // --------------------------------------------------------
  // COMPONENT
  // --------------------------------------------------------
  components: {
    SimpleTreeView
  },

  // --------------------------------------------------------
  // PROPS
  // --------------------------------------------------------
  props: {
    folderId: {
      type: String,
    },
    multiselect: {
      type: Boolean,
      default: false,
    }
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

  // --------------------------------------------------------
  // MOUNTED
  // --------------------------------------------------------
  mounted() {
    this.reloadFolderHierarchy();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    onSelectionChanged(selection) {
      this.selected = selection;
      this.$emit('selected', selection);
    },
    async loadFolder(folderId) {
      const folders = await this.$store.state.nkclient.getFoldersInFolderList(
          folderId,
          { resolveNames: true }
      )
      const result = []
      for (const folder of folders.children) {
        result.push({
          _id: folder._id,
          name: folder.name,
          children: [],
        })
      }
      return result
    },
    async reloadFolderHierarchy() {
      try {
        this.loading = true

        // Create root node
        // ------------------------------------------------------------------
        const root = {
          name: '/',
          _id: null,
          id: null,
          isExpanded: true,
          isLoaded: true,
          children: [],
        }

        // Load the root folder elements
        // ------------------------------------------------------------------
        const treeNodes = []
        await this.loadChildren(root, true)
        treeNodes.push(root)

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
        this.selected = []
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

    async loadChildren(folder, noSetLoadingFlag) {
      try {
        if (!noSetLoadingFlag) this.loading = true

        // Load children and add the id field to all of them
        const children = (await this.loadFolder(folder._id)).map(c => ({
          ...c,
          id: c._id
        }))
        children.sort(function (a, b) {
          return a.name.localeCompare(b.name)
        })
        folder.children = children
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }

      if (!noSetLoadingFlag) this.loading = false
    }
  },
}
</script>

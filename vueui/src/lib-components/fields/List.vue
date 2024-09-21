<template>
  <div :class="cssClassesContainer">
    <div :class="cssClasses" style="padding: 4px;">
      <div class="dropTargetContainer">
          <div
            v-if="shouldRenderDropTarget(0)"
            class="dropTarget"
            @dragover.stop="onDragOver($event, 0)"
            @dragleave.stop="onDragLeave"
            @drop="handleDrop(0)">
          </div>
        </div>
      <div v-for="(entry, index) in entries" :key="index">
        <Separator
          :display-remove="allowEdit"
          :title="`${elementName} ${index+1}`"
          :project-folder-id="projectFolderId"
          :dragging-info="allowEdit ? {
            index,
            handleDragStart,
            handleDragEnd
          } : null"
          @remove="removeEntry(index)">

          <Fields
            :title="displayName"
            :value="entry.fields"
            :allow-edit="allowEdit"
            :is-list="true"
            :item-repo="itemRepo"
            :studio-mode="studioMode"
            :node-name-resolver="nodeNameResolver"
            :layer-titles="layerTitles"
            :project-folder-id="projectFolderId"
            @changed="$emit('changed')"
          />

        </Separator>
        <div class="dropTargetContainer">
          <div
            v-if="shouldRenderDropTarget(index+1)"
            class="dropTarget"
            @dragover.stop="onDragOver($event, 0)"
            @dragleave.stop="onDragLeave"
            @drop="handleDrop(index+1)">
          </div>
        </div>
      </div>

      <div v-if="templates && allowEdit" class="fieldListButtons">
        <v-btn size="x-small" class="bg-main" @click="addEntry">
          <v-icon>mdi-plus</v-icon> New {{elementName}}
        </v-btn>
        <v-btn
          size="x-small"
          class="bg-main"
          :disabled="!blocks || !blocks.length"
          @click="removeEntry()"
        >
          <v-icon>mdi-minus</v-icon> Remove {{elementName}}
        </v-btn>
      </div>

      <div v-if="!blocks || !blocks.length" class="fieldMessage">No entries</div>
    </div>
  </div>
</template>
<script>

import { watch } from 'vue'
import Separator from "./Separator.vue"

export default {

  name: "List",
  components: {Separator},

  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    title: {
      type: String,
      required: true
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
      required: true,
    },
    nodeNameResolver: {
      type: Function,
      default: null
    },
    layerTitles: {
      type: Array,
      default: null
    },
    projectFolderId: {
      type: String,
      required: true
    }
  },

  // ---------------------------------------------------------
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    entries: [],
    draggedListIndex: -1
  }),

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
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

    templates() {
      if (this.modelValue)
        return this.modelValue.templates

      return []
    },

    elementName() {
      if (this.templates && this.templates.length)
        return this.templates[0].displayName

      return ''
    },

    displayName() {
      if (this.modelValue)
        return this.modelValue.displayName

      return ''
    },

    namespace() {
      if (this.modelValue)
        return this.modelValue.name

      return ''
    },

    blocks() {
      if (this.modelValue)
        return this.modelValue.blocks

      return []
    },
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {

    updateEntries() {
      this.entries = [...this.blocks]
    },

    async addEntry() {

      // Get template for new entry
      // ---------------------------------------------------------------
      let templateEntry = this.templates[0]
      if (!templateEntry) {
        throw new Error("No template is available to instantiate")
      }

      // Create new block from template
      // ---------------------------------------------------------------
      const newBlock = await this.itemRepo.createNewListEntry(templateEntry, this.modelValue)

      // Push new entry to list
      // ---------------------------------------------------------------
      this.blocks.push(newBlock)
      this.updateEntries()
      this.$emit('update:modelValue', this.modelValue)
      this.$emit('changed')
    },

    removeEntry(index) {

      // If no index is specified, remove the last entry
      // ---------------------------------------------------------------
      if (index === undefined)
        index = this.blocks.length - 1

      // Remove entry from the list
      // ---------------------------------------------------------------
      this.blocks.splice(index, 1)
      this.updateEntries()
      this.$emit('update:modelValue', this.modelValue)
      this.$emit('changed')
    },

    shouldRenderDropTarget(dropTargetIndex) {
      if (!this.allowEdit)
        return false;

      if (this.draggedListIndex === -1) {
        return false
      }

      // cannot drop items at their neighbouring drop targets
      return (
        dropTargetIndex !== this.draggedListIndex &&
        dropTargetIndex !== this.draggedListIndex + 1
      )
    },

    handleDragStart(listIndex) {
      this.draggedListIndex = listIndex
    },

    handleDragEnd() {
      this.draggedListIndex = -1
    },

    // save old item --> replace with dummy at old index --> insert new item --> remove dummy
    handleDrop(newIndex) {
      const blocks = this.blocks
      const dummy = `REPLACEMENT_DUMMY_${Math.random()}`
      const itemToMove = blocks[this.draggedListIndex]

      blocks[this.draggedListIndex] = dummy
      blocks.splice(newIndex, 0, itemToMove)

      this.modelValue.blocks = blocks.filter(entry => entry !== dummy)
      this.draggedListIndex = -1
      this.updateEntries()
      this.$emit('update:modelValue', this.modelValue)
      this.$emit('changed')
    },

    onDragOver(e) {
      e.preventDefault()
      e.stopPropagation()
    },
    onDragLeave(e) {
      e.preventDefault()
      e.stopPropagation()
    },
  },

  mounted() {
    this.updateEntries()

    watch(() => [this.modelValue], () => {
      this.updateEntries()
    })
  }
}
</script>

<style scoped>

.dropTargetContainer {
  height: 12px;
}

.dropTarget{
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    border-radius: 5px;
    /* only "colors" half of the background to simulate margin to still have all of the dropping space */
    background: linear-gradient(to bottom, transparent 25%,#3687e4 25%, #3687e4 75%, transparent 75%);
}

</style>

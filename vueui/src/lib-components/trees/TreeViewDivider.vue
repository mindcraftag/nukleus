

<template>
  <div
    :class="['divider', isDraggedOver ? 'isDraggedOver' : ''].join(' ')"
    @dragover.stop="onDragOver($event)"
    @dragleave.stop="onDragLeave($event)"
    @drop="onDrop($event)"
  ></div>
</template>
  
<script>
  
export default {
  name: 'TreeViewDivider',
  props: {
    index: Number
  },
  emits: ['nodeOnDividerDrop'],
  data: () => ({
    // Whether or not a node is being held above this divider.
    isDraggedOver: false,
  }),

  methods: {
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
      this.$emit('nodeOnDividerDrop', ev) 
    },
  },
}
</script>

<style scoped>
  .divider {
    height: 0.25rem;
    width: 100%;
  }
  .isDraggedOver {
    background-color: #3687e4;
  }
</style>
  
<template>
  <div
    class="fieldValueContainer"
    @dragover="onDragOver($event)"
    @drop="onDrop($event)"
  >
    <SmallTextField
        v-if="allowEdit"
        v-model="resolvedName"
        append-icon="mdi-trash-can"
        @click:append="computedValue = null"
    />
    <SmallTextField
        v-else="allowEdit"
        v-model="resolvedName"
        read-only
    />
  </div>
</template>
<script>

import SmallTextField from "../wrappers/SmallTextField.vue";

export default {

  name: "NodeField",

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  components: {
    SmallTextField
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      default: null,
    },
    allowEdit: {
      type: Boolean,
      required: true,
      default: false,
    },
    nodeNameResolver: {
      type: Function,
      required: true
    }
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    resolvedName: {
      get() {
        if (this.modelValue) {
          if (this.nodeNameResolver) {
            return this.nodeNameResolver(this.modelValue)
          }
          return '<unknown node>'
        } else {
          return '<empty>'
        }
      },
    },
    computedValue: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
        this.$emit('changed')
      },
    },
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    onDragOver(event) {
      event.preventDefault()
    },

    onDrop(event) {
      event.preventDefault()

      if (!this.allowEdit)
        return;

      const draggedNodes = JSON.parse(event.dataTransfer.getData("draggedNodes"))
      const {id, elementType} = draggedNodes[0]
      
      if (id && elementType === 'ScenegraphNode') {
        this.computedValue = id
        this.$emit('changed')
      } else {
        console.error(
          'Invalid element type was dropped. Only scenegraph nodes supported'
        )
      }
    },
  },
}
</script>

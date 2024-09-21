<template>
  <div :class="cssClasses">
    <form role="form" enctype="multipart/form-data">
      <div class="uploadBoxMain">
        <div
          ref="dropArea"
          class="dropArea"
          :class="dragCss"
          @click="clicked"
          @dragover.prevent
          @drop.prevent="onDrop"
          @dragenter="onDragEnter"
          @dragend="onDragLeave"
          @dragleave="onDragLeave"
        >
          <h3>{{ dropAreaPrimaryMessage }}</h3>
          <input
            id="items"
            ref="inputBox"
            type="file"
            name="file"
            required
            multiple
            @change="onChange"
          />
          <p class="help-block">{{ dropAreaSecondaryMessage }}</p>
        </div>
      </div>
    </form>
  </div>
</template>

<style>
.uploadBox h3 {
  padding-top: 1em;
}

.uploadBox .uploadBoxMain {
  position: relative;
  margin-bottom: 1em;
}

.uploadBox .dropArea {
  position: relative;
  width: 100%;
  text-align: center;
  font-size: 1em;
  padding-top: 0;
  height: 70px;
  cursor: pointer;
}

.uploadBoxStudio .dropArea {
  border: 1px dashed var(--color-dark-main-highlight2);
  background-color: var(--color-dark-main-darker1);
}

.uploadBoxDark .dropArea {
  border: 1px dashed #303030;
  background-color: #202020;
}

.uploadBoxLight .dropArea {
  border: 1px dashed #e0e0e0;
  background-color: #f0f0f0;
}

.uploadBox .dropArea input {
  display: none;
}

.dropAreaDragging {
  border: 1px solid #0080ff !important;
}
</style>

<script>

export default {
  props: {
    postUrl: {
      type: String,
      default: '',
    },
    postHeader: {
      type: [Object],
      default: () => {},
    },
    dropAreaPrimaryMessage: {
      type: String,
      default: 'Drop files here',
    },
    dropAreaSecondaryMessage: {
      type: String,
      default: 'or click to upload',
    },
    emitToEventBus: {
      type: Boolean,
      default: true,
    },
    studioMode: {
      type: Boolean,
      default: false
    }
  },

  /*
   * The component's data.
   */
  data() {
    return {
      dragging: false,
    }
  },

  computed: {
    cssClasses: {
      get() {
        if (this.studioMode) {
          return 'uploadBox uploadBoxStudio'
        } else if (this.$store.state.darkMode) {
          return 'uploadBox uploadBoxDark'
        } else {
          return 'uploadBox uploadBoxLight'
        }
      },
    },

    dragCss: {
      get() {
        if (this.dragging) return 'dropAreaDragging'
        else return ''
      },
    },
  },

  methods: {
    clicked() {
      this.$refs.inputBox.click()
    },

    onDragEnter(e) {
      //console.log("Drag enter");
      this.dragging = true
      return true
    },

    onDragLeave(e) {
      //console.log("dragleave");
      const rect = this.$refs.dropArea.getBoundingClientRect()
      if (
        e.clientY < rect.top ||
        e.clientY >= rect.bottom ||
        e.clientX < rect.left ||
        e.clientX >= rect.right
      ) {
        this.dragging = false
      }
      return false
    },

    onDrop(e) {
      //console.log("drop");
      this.dragging = false
      this.doUpload(e)
      return false
    },

    onChange(e) {
      //console.log("change", e);
      this.doUpload(e)
    },

    doUpload(e) {
      let files = e.target.files || e.dataTransfer.files
      if (files && files.length) {
        console.log('New upload.', files)

        if (this.emitToEventBus)
          this.$store.state.nkclient.eventBus.$emit('queueUpload', files, this.postUrl, this.postHeader)
        else this.$emit('upload', files)
      }
    },
  },
}
</script>

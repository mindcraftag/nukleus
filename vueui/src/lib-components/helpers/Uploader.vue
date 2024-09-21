<template>
  <v-card
    v-if="uploads.length"
    :class="cssClass"
    :loading="runningUploads > 0"
    elevation="10"
  >
    <v-card-subtitle>Uploads</v-card-subtitle>

    <v-list lines="two">
      <v-list-item v-for="upload in uploads" :key="upload.id">
        <v-list-item avatar>
          <v-icon>mdi-file</v-icon>
        </v-list-item>

        <v-list-item-title
          >`{{ upload.name }} ({{ upload.bytesUploadedCurrent | formatBytes }} /
          {{ upload.bytesTotal | formatBytes }}</v-list-item-title
        >
        <v-list-item-subtitle>
          <v-progress-linear
            v-if="!upload.error"
            :model-value="upload.progress"
          ></v-progress-linear>
          <span v-if="upload.error" class="uploaderError">{{
            upload.error
          }}</span>
        </v-list-item-subtitle>

        <v-list-item-action>
          <v-btn icon @click="removeUpload(upload)">
            <v-icon>mdi-trash-can</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<style>
.uploaderCard {
}

.uploaderCardFixed {
  z-index: 1000 !important;
  position: fixed !important;
  right: 10px !important;
  bottom: 10px !important;
  width: 400px !important;
}

.uploaderError {
  color: #800000 !important;
}
</style>

<script>
import uitools from '../../js-modules/uitools'
import axios from 'axios'

export default {
  name: 'Uploader',

  // ------------------------------------------------------------
  // FILTERS
  // ------------------------------------------------------------
  filters: {
    formatBytes(bytes) {
      if (bytes > 1024) {
        bytes /= 1024
        if (bytes > 1024) {
          bytes /= 1024
          if (bytes > 1024) {
            bytes /= 1024
            return `${Math.round(bytes * 100) / 100} GiB`
          } else {
            return `${Math.round(bytes * 100) / 100} MiB`
          }
        } else {
          return `${Math.round(bytes * 100) / 100} KiB`
        }
      } else {
        return `${bytes} bytes`
      }
    },
  },

  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    mode: {
      type: String,
      default: 'fixed',
    },
    name: {
      type: String,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    uploads: [],
    runningUploads: 0,
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    cssClass() {
      switch (this.mode) {
        case 'fixed':
          return 'uploaderCardFixed'

        default:
          return 'uploaderCard'
      }
    },
  },

  mounted() {
    const _this = this

    this.$store.state.nkclient.eventBus.$on('queueUpload', function (files, url, headers, name, userData) {
      if (files && files.length && url && url.length) {
        console.log('Received new upload.', files, url, headers, name, userData)
        if (_this.name == name)
          _this.createUpload(files, url, headers, userData)
      }
    })
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    getProgress(upload) {
      return (100 / upload.bytesTotal) * upload.bytesUploaded
    },

    removeUpload(upload) {
      if (upload.isUploading) upload.cancelToken.cancel()
      this.uploads.removeObject(upload)
    },

    createUpload(files, url, headers, userData) {
      let bytesTotal = 0

      for (let file of files) {
        bytesTotal += file.size
      }

      const newUpload = {
        id: uitools.createGUID(),
        files: files,
        url: url,
        headers: headers,
        name: `Uploading ${files.length} file(s)`,
        bytesTotal: bytesTotal,
        bytesUploaded: 0,
        bytesUploadedCurrent: 0,
        progress: 0,
        isUploading: false,
        error: null,
        cancelToken: axios.CancelToken.source(),
        userData: userData,
      }

      console.log('New upload', newUpload)

      this.uploads.push(newUpload)
      this.startUpload(newUpload)
    },

    async startUpload(upload) {
      const _this = this

      this.runningUploads++

      for (const file of upload.files) {
        const formData = new FormData()
        formData.append('file', file)

        upload.isUploading = true

        await axios({
          method: 'post',
          url: upload.url,
          data: formData,
          headers: upload.headers,
          cancelToken: upload.cancelToken.token,
          onUploadProgress: function (progressEvent) {
            upload.bytesUploadedCurrent =
              upload.bytesUploaded + progressEvent.loaded
            upload.progress =
              (100 / upload.bytesTotal) * upload.bytesUploadedCurrent
          },
        })
          .then((response) => {
            if (response.data.result === 'failed') {
              upload.error = response.data.error
              this.$emit('failed', upload)
            } else {
              this.$emit('succeeded', upload)
            }
          })
          .catch((error) => {
            upload.isUploading = false

            if (
              error.response.data &&
              error.response.data.result === 'failed'
            ) {
              upload.error = error.response.data.error
            } else {
              upload.error = error
            }
            this.$emit('failed', upload)
          })

        if (upload.error) {
          upload.isUploading = false
          this.runningUploads--
          return
        }

        upload.bytesUploaded += file.size
      }

      upload.isUploading = false
      _this.removeUpload(upload)
      this.runningUploads--
    },
  },
}
</script>

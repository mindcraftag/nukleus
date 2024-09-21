<template>
  <v-dialog v-model="showUpdateDialog" max-width="290">
    <v-card>
      <v-card-title class="text-h5">Update available</v-card-title>

      <v-card-text>
        {{ updateText }}
      </v-card-text>

      <v-card-actions>
        <div class="flex-grow-1"></div>

        <v-btn color="green-darken-1" variant="text" @click="refresh">
          Refresh
        </v-btn>

        <v-btn
          color="green-darken-1"
          variant="text"
          @click="showUpdateDialog = false"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import axios from 'axios'

export default {
  props: {
    watch: {
      type: String,
      default: '/index.html',
    },
    updateText: {
      type: String,
      default:
        'A new software version is available. Please refresh to load it.',
    },
    interval: {
      type: Number,
      default: 60000,
    },
  },

  data() {
    return {
      updateAvailable: false,
      showUpdateDialog: false,
      fileContent: null,
    }
  },

  created() {
    this.updateCheck()
  },

  methods: {
    updateCheck() {
      const vm = this

      if (!vm.updateAvailable) {
        vm.check().then(function (result) {
          if (result) {
            vm.showUpdateDialog = true
            vm.updateAvailable = true
          }
        })
        setTimeout(this.updateCheck, this.interval)
      }
    },
    refresh() {
      window.location.reload()
    },
    check() {
      const vm = this

      return axios
        .get(this.watch)
        .then(function (res) {
          if (res.data) {
            if (!vm.fileContent) {
              vm.fileContent = res.data
            } else {
              if (vm.fileContent !== res.data) {
                return true
              }
            }
          }
          return false
        })
        .catch(function (err) {
          console.error(err)
        })
    },
  },
}
</script>

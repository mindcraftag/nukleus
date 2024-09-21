<template>
  <Dialog v-model="show" :title="jobDisplayName">

    <template #default>
      <div style="margin-bottom: 20px">
        <ParameterEditor
            :parameters="parameters"
            :current-folder-id="currentFolderId"
            @changed="paramsUpdated"
        />
      </div>
    </template>

    <template #actions>
      <v-btn color="primary" @click="submit">
        <v-icon>mdi-cog</v-icon>
        create job
      </v-btn>
      <v-btn @click="close">
        <v-icon>mdi-close</v-icon>
        cancel
      </v-btn>
    </template>

  </Dialog>
</template>

<script>

import Dialog from '../wrappers/Dialog.vue'
import ParameterEditor from './ParameterEditor.vue'

export default {

  components: {
    Dialog,
    ParameterEditor,
  },

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: Boolean,
    selectedElements: Array,
    jobType: Object,
    jobTypes: Array,
    currentFolderId: String,
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'created-job', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    name: '',
    paramValues: null,
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    show: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      },
    },

    jobName: {
      get() {
        if (this.jobType) return this.jobType.name

        return ''
      },
    },

    jobDisplayName: {
      get() {
        if (this.jobType) return this.jobType.displayName

        return ''
      },
    },

    parameters: {
      get() {
        if (this.jobType) {
          return this.jobType.parameters
        }

        return []
      },
    },
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    paramsUpdated(values) {
      this.paramValues = values
    },
    async submit() {
      try {
        const elements = []
        for (const element of this.selectedElements) {
          if (element._id) {
            elements.push({
              _id: element._id,
              isFolder: element.isFolder,
            })
          }
        }

        const id = await this.$store.state.nkclient.createJob({
          type: this.jobName,
          elements: elements,
          parameters: this.paramValues,
        })

        this.close()
        this.$emit('created-job')
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }
    },
    close() {
      this.show = false
      this.$emit('closed')
    },
  },
}
</script>

<style></style>

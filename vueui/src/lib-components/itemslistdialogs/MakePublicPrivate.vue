<template>
  <v-dialog v-model="show" max-width="500px">
    <v-card>
      <v-card-title>Make {{ makePublic ? 'public' : 'private' }}</v-card-title>
      <v-container fluid grid-list-lg>
        <v-row wrap>
          <v-col xs12>
            <div style="margin-bottom: 20px">
              <v-checkbox
                v-model="recursive"
                data-test="recursiveCheckbox"
                label="Recursive"
                hide-details
              ></v-checkbox>

              <v-checkbox
                v-model="inSubfolders"
                data-test="recursiveCheckbox"
                label="Within subfolders"
                hide-details
              ></v-checkbox>
            </div>

            <v-btn color="primary" @click="submit">
              <v-icon>mdi-cog</v-icon>
              execute
            </v-btn>
            <v-btn @click="close">
              <v-icon>mdi-close</v-icon>
              close
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    item: {
      type: Object,
    },
    makePublic: {
      type: Boolean,
      default: false,
    },
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    recursive: false,
    inSubfolders: false,
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
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async submit() {
      try {
        if (!this.item) return

        if (this.makePublic)
          await this.$store.state.nkclient.makeItemPublic(
            this.item._id,
            this.recursive,
            this.inSubfolders
          )
        else
          await this.$store.state.nkclient.makeItemPrivate(
            this.item._id,
            this.recursive,
            this.inSubfolders
          )

        this.close()
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

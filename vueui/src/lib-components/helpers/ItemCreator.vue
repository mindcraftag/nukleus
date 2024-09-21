<template>
  <v-dialog v-model="show" max-width="500px">
    <v-card width="100%" data-test="createItemDialog">
      <v-card-title>Create Item</v-card-title>
      <v-container fluid grid-list-lg>
        <v-row wrap>
          <v-col xs12>
            <v-text-field
              v-model="name"
              label="Name"
              data-test="nameTextField"
              required
              autofocus
              @keydown="keydown"
            />
            <v-select
              v-model="type"
              :items="types"
              label="Type"
              data-test="typeSelect"
              required
            />
            <v-select
              v-if="
                userAttributeTemplates.length > 1 &&
                $store.state.activeClientAttributeTemplatesAllowed
              "
              v-model="userAttributeTemplate"
              :items="userAttributeTemplates"
              return-object
              item-value="_id"
              item-title="name"
              label="Attribute Template"
              data-test="attributeTemplateSelect"
            />

            <v-btn color="primary" data-test="submitCreateItem" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn data-test="cancelCreateItem" @click="close">
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

import { watch } from 'vue'

export default {
  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    parentFolderId: {
      type: String,
    },
    validTypes: {
      type: Array,
      required: false,
    },
  },

  emits: ['update:modelValue'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    name: null,
    type: null,
    userAttributeTemplate: null,
    types: [],
    datatypes: [],
    userAttributeTemplates: [],
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
  // CREATED
  // --------------------------------------------------------
  created() {
    watch(() => [this.modelValue], (newValues) => {
      if (newValues[0]) {
        this.name = ''
        this.type = ''
        this.loadDatatypes()
        this.loadUserAttributeTemplates()
      }
    });
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    keydown(event) {
      if (event.key === 'Enter') {
        this.submit()
      }
    },

    async loadUserAttributeTemplates() {
      try {
        if (this.$store.state.activeClientAttributeTemplatesAllowed) {
          const userAttributeTemplates =
            await this.$store.state.nkclient.getAttributeTemplates()
          userAttributeTemplates.sort((a, b) => {
            return a.name.localeCompare(b.name)
          })
          this.userAttributeTemplates = [
            { _id: null, name: 'none' },
            ...userAttributeTemplates,
          ]
        } else {
          this.userAttributeTemplates = [{ _id: null, name: 'none' }]
        }
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }
    },

    async loadDatatypes() {
      try {
        let datatypes = await this.$store.state.nkclient.getDatatypesList()

        if (this.validTypes) {
          datatypes = datatypes.filter((x) => this.validTypes.includes(x.name))
        }

        datatypes.sort((a, b) => {
          return a.name.localeCompare(b.name)
        })
        this.datatypes = datatypes

        const types = []
        let defaultType = null
        for (const type of this.datatypes) {
          if (type.name === 'Dataset' || !defaultType) defaultType = type.name
          types.push(type.name)
        }
        this.types = types
        this.type = defaultType
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }
    },

    async submit() {
      try {
        const userAttributeTemplate = this.userAttributeTemplate
          ? this.userAttributeTemplate._id
          : undefined

        const visibility = this.$store.state.nkclient.getRootVisibility();

        const id = await this.$store.state.nkclient.createItem({
          name: this.name,
          type: this.type,
          userAttributeTemplate: userAttributeTemplate,
          folder: this.parentFolderId,
          visibility: visibility
        })

        this.close()
        this.$emit('created-item', id);
        this.$store.state.nkclient.eventBus.$emit('nk:folder:changed', this.parentFolderId);
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

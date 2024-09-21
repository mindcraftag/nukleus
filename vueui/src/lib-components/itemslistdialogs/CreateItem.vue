<template>
  <Dialog v-model="show" title="Create item" max-width="500px">
    <template #default>
      <v-text-field
          v-model="name"
          label="Name"
          data-test="nameTextField"
          density="compact"
          required
          autofocus
          @keydown="keydown"
      />
      <v-select
          v-model="type"
          :items="types"
          density="compact"
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
          density="compact"
          return-object
          item-value="_id"
          item-title="name"
          label="Attribute Template"
          data-test="attributeTemplateSelect"
      />
      <v-select
        v-if="itemTemplatesByType.length > 1"
        v-model="itemTemplate"
        :items="itemTemplates"
        density="compact"
        return-object
        item-value="_id"
        item-title="name"
        label="Item Template"
        data-test="itemTemplateSelect"
      />
    </template>

    <template #actions>
      <v-btn color="primary" data-test="submitCreateItem" @click="submit">
        <v-icon>mdi-content-save</v-icon>
        save
      </v-btn>
      <v-btn data-test="cancelCreateItem" @click="close">
        <v-icon>mdi-close</v-icon>
        close
      </v-btn>
    </template>
  </Dialog>
</template>

<script>

import { watch } from 'vue';
import Dialog from "../wrappers/Dialog.vue";

export default {

  components: {
    Dialog
  },

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: {
      type: Boolean,
    },
    parentFolderId: {
      type: String,
      default: null,
    },
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'created-item', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    name: '',
    type: null,
    userAttributeTemplate: null,
    itemTemplate: null,
    types: [],
    datatypes: [],
    userAttributeTemplates: [],
    itemTemplates: []
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
    itemRepo() {
      return this.$store.state.nkclient.getItemRepo()
    },
    itemTemplatesByType() {
      return this.itemTemplates.filter((x) => {
        return !x.type || x.type === this.type;
      });
    }
  },

  // --------------------------------------------------------
  // CREATED
  // --------------------------------------------------------
  created() {
    watch(() => [this.modelValue], (newValues) => {
      if (newValues[0]) {
        this.name = ''
        this.type = ''
        this.userAttributeTemplate = ''
        this.loadDatatypes()
        this.loadUserAttributeTemplates()
        this.loadItemTemplates()
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

    async loadItemTemplates() {
      try {
        const itemTemplates = await this.$store.state.nkclient.getItemTemplatesList();
        itemTemplates.sort((a, b) => {
          return a.name.localeCompare(b.name)
        })
        this.itemTemplates = [
          { _id: null, name: 'none' },
          ...itemTemplates,
        ];
        console.log(this.itemTemplates);
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
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
        const datatypes = await this.$store.state.nkclient.getDatatypesList()
        datatypes.sort((a, b) => {
          return a.name.localeCompare(b.name)
        })
        this.datatypes = datatypes

        const types = []
        let defaultType = null
        for (const type of this.datatypes) {
          if (type.name === 'Dataset') defaultType = type.name
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
          : undefined;

        const itemTemplate = this.itemTemplate
          ? this.itemTemplate._id
          : undefined;

        let visibility = 1;

        // When we create new items, they should have the same visibility as the currently active item
        if (this.itemRepo.activeItem) {
          visibility = this.itemRepo.activeItem.visibility;
        }

        const id = await this.$store.state.nkclient.createItem({
          name: this.name,
          type: this.type,
          userAttributeTemplate: userAttributeTemplate,
          itemTemplate: itemTemplate,
          folder: this.parentFolderId || null,
          visibility: visibility
        })

        this.close()
        this.$emit('created-item', id)
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

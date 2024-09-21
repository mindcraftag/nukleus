<template>
  <Dialog v-model="show" title="New access control entry" max-width="500px">
    <template #default>
      <v-select
          v-model="type"
          :items="typeItems"
          density="compact"
          label="Type"
          data-test="aclTypeSelect"
      ></v-select>

      <v-select
          v-if="type === 'User'"
          v-model="user"
          :items="users"
          item-title="name"
          density="compact"
          label="User"
          return-object
          data-test="aclUserSelect"
      ></v-select>

      <v-select
          v-if="type === 'Group'"
          v-model="group"
          :items="groups"
          item-title="name"
          density="compact"
          label="Group"
          return-object
          data-test="aclGroupSelect"
      ></v-select>

      <v-checkbox
          v-model="canRead"
          label="Can read"
          :hide-details="true"
          density="compact"
          data-test="aclCanReadCheckbox"
      ></v-checkbox>

      <v-checkbox
          v-model="canWrite"
          label="Can write"
          :hide-details="true"
          density="compact"
          data-test="aclCanWriteCheckbox"
      ></v-checkbox>

      <v-checkbox
          v-model="canPublish"
          label="Can publish"
          :hide-details="true"
          density="compact"
          data-test="aclCanPublishCheckbox"
      ></v-checkbox>
    </template>

    <template #actions>
      <v-btn color="primary" data-test="aclSaveButton" @click="submit">
        <v-icon>mdi-content-save</v-icon>
        save
      </v-btn>

      <v-btn data-test="aclCloseButton" @click="close">
        <v-icon>mdi-close</v-icon>
        close
      </v-btn>
    </template>
  </Dialog>
</template>
<script>

import { watch } from 'vue'
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
    aclEntry: {
      type: Object,
    },
    users: {
      type: Array,
    },
    groups: {
      type: Array,
    },
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'updated-acl', 'created-acl', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    type: 'Everyone',
    user: null,
    group: null,
    canRead: false,
    canWrite: false,
    canPublish: false,
    typeItems: ['Everyone', 'User', 'Group'],
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
        this.updateValues()
      }
    });

    this.updateValues()
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    getUserById(id) {
      for (const user of this.users) {
        if (user._id === id) return user
      }

      return null
    },

    getGroupById(id) {
      for (const group of this.groups) {
        if (group._id === id) return group
      }

      return null
    },

    updateValues() {
      if (this.aclEntry) {
        this.user = this.getUserById(this.aclEntry.user)
        this.group = this.getGroupById(this.aclEntry.group)

        if (this.group) this.type = 'Group'
        else if (this.user) this.type = 'User'
        else this.type = 'Everyone'

        if (Array.isArray(this.aclEntry.can)) {
          this.canRead = this.aclEntry.can.includes('read')
          this.canWrite = this.aclEntry.can.includes('write')
          this.canPublish = this.aclEntry.can.includes('publish')
        }
      } else {
        this.type = 'Everyone'
        this.user = null
        this.group = null
        this.canRead = false
        this.canWrite = false
        this.canPublish = false
      }
    },

    async submit() {
      try {
        let entry = this.aclEntry || {}

        entry.user =
          this.type === 'User' ? (this.user ? this.user._id : null) : null
        entry.group =
          this.type === 'Group' ? (this.group ? this.group._id : null) : null
        entry.can = []

        if (this.canRead) entry.can.push('read')

        if (this.canWrite) entry.can.push('write')

        if (this.canPublish) entry.can.push('publish')

        if (!entry.user && this.type === 'User') {
          this.$store.commit('setError', 'Please select a user')
          return
        }

        if (!entry.group && this.type === 'Group') {
          this.$store.commit('setError', 'Please select a user')
          return
        }

        if (this.aclEntry) {
          this.$emit('updated-acl', entry)
        } else {
          this.$emit('created-acl', entry)
        }

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

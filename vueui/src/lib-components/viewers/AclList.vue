<template>
  <v-card style="margin-bottom: 10px" elevation="0">
    <v-card-title>
      {{ title }}
      <v-spacer></v-spacer>
      <v-btn
        v-if="allowEdit"
        size="small"
        data-test="createAclButton"
        @click="createAcl"
        >Create</v-btn
      >
    </v-card-title>
    <v-card-text density="compact">
      <v-table>
        <thead>
          <tr>
            <th>User / Groups</th>
            <th>Permissions</th>
            <th v-if="showSource">Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in editingAcls" :key="entry._id" :data-text="getUserOrGroupString(entry)">
            <td>{{ getUserOrGroupString(entry) }}</td>
            <td>{{ getActionsString(entry) }}</td>
            <td v-if="showSource">{{ entry.source }}</td>
            <td>
              <v-btn
                  v-if="allowEdit"
                  variant="text"
                  size="small"
                  data-test="editAclButton"
                  @click="editAcl(entry)"
              >
                Edit
              </v-btn>
              <v-btn
                  v-if="allowEdit"
                  variant="text"
                  size="small"
                  data-test="removeAclButton"
                  @click="removeAcl(entry)"
              >
                Remove
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>

    <AclEditDialog
      v-if="allowEdit"
      v-model="showEditorDialog"
      :acl-entry="editingAcl"
      :users="users"
      :groups="groups"
      @created-acl="createdAcl"
      @updated-acl="updatedAcl"
    >
    </AclEditDialog>
  </v-card>
</template>

<style></style>

<script>

import { watch } from 'vue';
import AclEditDialog from './AclEditDialog.vue'

export default {
  components: {
    AclEditDialog,
  },

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    modelValue: {
      type: Array,
    },
    title: {
      type: String,
    },
    users: {
      type: Array,
    },
    groups: {
      type: Array,
    },
    showSource: {
      type: Boolean,
      default: true,
    },
    allowEdit: {
      type: Boolean,
      default: false,
    },
    studioMode: {
      type: Boolean,
      default: false,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    editingAcls: [],
    showEditorDialog: false,
    editingAcl: null,
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    cssClasses: {
      get() {
        if (this.studioMode) {
          return 'aclEditor aclEditorStudio'
        } else if (this.$store.state.darkMode) {
          return 'aclEditor aclEditorDark'
        } else {
          return 'aclEditor aclEditorLight'
        }
      },
    },
    headers: {
      get() {
        const list = []

        list.push({
          title: 'User / Group',
          key: 'userOrGroup',
          sortable: true,
        })

        list.push({
          title: 'Permissions',
          key: 'permissions',
          sortable: false,
        })

        if (this.showSource) {
          list.push({
            title: 'Source',
            key: 'source',
            sortable: true,
          })
        }

        list.push({
          title: '',
          key: 'actions',
          sortable: false,
        })

        return list
      },
    },
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  created() {
    watch(() => [this.modelValue], (newValues) => {
      this.init()
    });
  },

  // ------------------------------------------------------------
  // WATCHES
  // ------------------------------------------------------------
  mounted() {
    this.init()
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    init() {
      this.editingAcls = this.modelValue
    },

    createdAcl(acl) {
      if (this.exists(acl)) {
        this.updatedAcl(acl)
      } else {
        this.editingAcls.push(acl)
        this.$emit('input', this.editingAcls)
      }
    },

    updatedAcl(acl) {
      let existingAcl = this.find(acl)
      if (existingAcl) {
        existingAcl.can = acl.can
        this.$emit('input', this.editingAcls)
      }
    },

    find(findAcl) {
      for (const acl of this.editingAcls) {
        if (acl.user === findAcl.user && acl.group === findAcl.group) return acl
      }
      return null
    },

    exists(findAcl) {
      return this.find(findAcl) !== null
    },

    getUserOrGroupString(acl) {
      if (acl.user) {
        for (const user of this.users) {
          if (user._id === acl.user) return 'User: ' + user.name
        }
        return '<Unknown user>'
      }

      if (acl.group) {
        for (const group of this.groups) {
          if (group._id === acl.group) return 'Group: ' + group.name
        }
        return '<Unknown group>'
      }

      return 'Everyone'
    },

    getActionsString(acl) {
      if (Array.isArray(acl.can)) {
        return acl.can.join(', ')
      }

      return '<invalid>'
    },

    createAcl() {
      this.editingAcl = null
      this.showEditorDialog = true
    },

    editAcl(acl) {
      this.editingAcl = acl
      this.showEditorDialog = true
    },

    removeAcl(acl) {
      this.editingAcls.removeObject(acl)
      this.$emit('input', this.editingAcls)
    },
  },
}
</script>

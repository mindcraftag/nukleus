<template>
  <div>
    <AclList
      v-model="localAcl"
      :title="localTitle"
      :users="users"
      :groups="groups"
      :show-source="false"
      :allow-edit="allowEdit"
      :studio-mode="studioMode"
    >
    </AclList>

    <AclList
      v-if="!clientMode"
      title="Accumulated access control list"
      :model-value="resultingAcl"
      :users="users"
      :groups="groups"
      :show-source="true"
      :allow-edit="false"
      :studio-mode="studioMode"
    >
    </AclList>
  </div>
</template>

<style></style>

<script>
import AclList from './AclList.vue'

export default {
  components: {
    AclList,
  },

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    element: {
      // the edited element (item or folder)
      type: Object,
    },
    allowEdit: {
      type: Boolean,
      default: false,
    },
    studioMode: {
      type: Boolean,
      default: false,
    },
    clientMode: {
      type: Boolean,
      default: false,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    users: [],
    groups: [],
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    localTitle: {
      get() {
        if (this.clientMode) return 'Base access control list'
        else return 'Local access control list'
      },
    },
    localAcl: {
      get() {
        if (this.element && Array.isArray(this.element.acl)) {
          return this.element.acl
        }

        return []
      },
      set(value) {
        if (this.element) {
          this.element.acl = value
        }
      },
    },
    resultingAcl: {
      get() {
        if (this.element && Array.isArray(this.element.resultingAcl)) {
          return this.element.resultingAcl
        }

        return []
      },
      set(value) {
        if (this.element) {
          this.element.resultingAcl = value
        }
      },
    },
  },

  mounted() {
    this.loadData()
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    async loadData() {
      const users = await this.$store.state.nkclient.getUsersList()
      users.sort((a, b) => {
        return a.name.localeCompare(b.name)
      })
      this.users = users

      const groups = await this.$store.state.nkclient.getGroupsList()
      groups.sort((a, b) => {
        return a.name.localeCompare(b.name)
      })
      this.groups = groups
    },
  },
}
</script>

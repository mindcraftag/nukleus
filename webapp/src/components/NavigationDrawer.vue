<template>
  <v-navigation-drawer
    id="navigationDrawer"
    v-model="isToggled"
    class="navDrawer"
    :disable-route-watcher="true"
    :rail="true"
    theme="dark"
    mobile-breakpoint="800"
    :color="$vuetify.theme.current.navbarColor"
  >

    <div v-show="homeFolder">
      <v-tooltip location="right" color="primary" text="Go to my home folder">
        <template #activator="{ props }">
          <v-btn data-test="itemsNavDrawerButton" icon v-bind="props" @click="goHome">
            <font-awesome-icon :icon="['fal', 'home']" size="lg" />
          </v-btn>
        </template>
      </v-tooltip>
    </div>

    <v-tooltip location="right" color="primary">
      <template #activator="{ props }">
        <v-btn
          data-test="itemsNavDrawerButton"
          :color="
            $route.name === 'Items' || $route.name === 'ItemsRoot'
              ? '#406080'
              : ''
          "
          icon
          v-bind="props"
          @click="changeRoute('ItemsRoot')"
        >
          <font-awesome-icon :icon="['fal', 'list']" size="lg" />
        </v-btn>
      </template>
      <span>Items</span>
    </v-tooltip>

    <v-tooltip location="right" color="primary">
      <template #activator="{ props }">
        <v-btn
          data-test="queryNavDrawerButton"
          :color="$route.name === 'Query' ? '#406080' : ''"
          icon
          v-bind="props"
          @click="changeRoute('Query')"
        >
          <font-awesome-icon :icon="['fal', 'search']" size="lg" />
        </v-btn>
      </template>
      <span>Query for items</span>
    </v-tooltip>

    <div v-show="tablesMenuVisible">
      <v-tooltip location="right" color="primary">
        <template #activator="{ props }">
          <v-btn
            data-test="tablesNavDrawerButton"
            :color="$route.name === 'Tables' ? '#406080' : ''"
            icon
            v-bind="props"
            @click="changeRoute('Tables')"
          >
            <font-awesome-icon :icon="['fal', 'table']" size="lg" />
          </v-btn>
        </template>
        <span>Tables</span>
      </v-tooltip>
    </div>

    <v-menu
      v-if="
        userMenuVisible ||
        groupsMenuVisible ||
        jobMenuVisible ||
        attributeTemplatesMenuVisible ||
        blogsMenuVisible
      "
      open-on-hover
      location="end"
    >
      <template #activator="{ props }">
        <v-btn icon v-bind="props">
          <font-awesome-icon :icon="['fal', 'user-shield']" size="lg" />
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item
          v-show="userMenuVisible"
          :color="$route.name === 'Users' ? '#406080' : ''"
          @click="changeRoute('Users')"
        >
          <v-list-item-title>
            <div style="width: 32px; display: inline-block">
              <font-awesome-icon :icon="['fal', 'user']" size="lg" />
            </div>
            Users
          </v-list-item-title>
        </v-list-item>

        <v-list-item
          v-show="groupsMenuVisible"
          :color="$route.name === 'Groups' ? '#406080' : ''"
          @click="changeRoute('Groups')"
        >
          <v-list-item-title>
            <div style="width: 32px; display: inline-block">
              <font-awesome-icon :icon="['fal', 'users']" size="lg" />
            </div>
            Groups
          </v-list-item-title>
        </v-list-item>

        <v-list-item
          v-show="jobMenuVisible"
          :color="$route.name === 'Jobs' ? '#406080' : ''"
          @click="changeRoute('Jobs')"
        >
          <v-list-item-title>
            <div style="width: 32px; display: inline-block">
              <font-awesome-icon :icon="['fal', 'tasks']" size="lg" />
            </div>
            Jobs
          </v-list-item-title>
        </v-list-item>

        <v-list-item
          v-show="attributeTemplatesMenuVisible"
          :color="$route.name === 'AttributeTemplates' ? '#406080' : ''"
          @click="changeRoute('AttributeTemplates')"
        >
          <v-list-item-title>
            <div style="width: 32px; display: inline-block">
              <font-awesome-icon
                :icon="['fal', 'drafting-compass']"
                size="lg"
              />
            </div>
            Attribute Templates
          </v-list-item-title>
        </v-list-item>

        <v-list-item
          v-show="purchasablesMenuVisible"
          :color="$route.name === 'Purchasables' ? '#406080' : ''"
          @click="changeRoute('Purchasables')"
        >
          <v-list-item-title>
            <div style="width: 32px; display: inline-block">
              <font-awesome-icon :icon="['fal', 'bag-shopping']" size="lg" />
            </div>
            Purchasables
          </v-list-item-title>
        </v-list-item>

        <v-list-item
          v-show="blogsMenuVisible"
          :color="$route.name === 'Blogs' ? '#406080' : ''"
          @click="changeRoute('Blogs')"
        >
          <v-list-item-title>
            <div style="width: 32px; display: inline-block">
              <font-awesome-icon
                :icon="['fal', 'pen-nib']"
                size="lg"
              />
            </div>
            Blogs
          </v-list-item-title>
        </v-list-item>

        <v-list-item
          v-show="newslettersMenuVisible"
          :color="$route.name === 'Newsletters' ? '#406080' : ''"
          @click="changeRoute('Newsletters')"
        >
          <v-list-item-title>
            <div style="width: 32px; display: inline-block">
              <font-awesome-icon
                :icon="['fal', 'envelope']"
                size="lg"
              />
            </div>
            Newsletters
          </v-list-item-title>
        </v-list-item>

        <v-list-item
          v-show="pagesMenuVisible"
          :color="$route.name === 'Pages' ? '#406080' : ''"
          @click="changeRoute('Pages')"
        >
          <v-list-item-title>
            <div style="width: 32px; display: inline-block">
              <font-awesome-icon
                :icon="['fal', 'earth-europe']"
                size="lg"
              />
            </div>
            Pages
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-menu v-if="moduleMounts.length" open-on-hover location="end">
      <template #activator="{ props }">
        <v-btn icon v-bind="props">
          <font-awesome-icon :icon="['fal', 'tools']" size="lg" />
        </v-btn>
      </template>
      <v-list density="compact">
        <div v-for="mount in moduleMounts" :key="mount.submenu">
          <v-list-subheader>{{
            mount.submenu ? mount.submenu.toUpperCase() : ""
          }}</v-list-subheader>
          <v-list-item
            v-for="child in mount.children"
            :key="child.name"
            @click="changeRouteMount(child)"
          >
            <v-list-item-title>
              <div style="width: 32px; display: inline-block">
                <font-awesome-icon :icon="child.icon" size="lg" />
              </div>
              {{ child.displayText }}
            </v-list-item-title>
          </v-list-item>
        </div>
      </v-list>
    </v-menu>

    <div id="clientButtons" class="clientButtons">
      <div v-if="clients && clients.length > 1">
        <v-tooltip
          v-for="client in clients"
          :key="client._id"
          location="right"
          color="primary"
        >
          <template #activator="{ props }">
            <v-btn
              :class="[{ activeClient: client.active }, 'clientButton']"
              :color="client.color"
              icon
              v-bind="props"
              @click="switchClient(client)"
            >
              {{ client.initials }}
            </v-btn>
          </template>
          <span>{{ client.name }}</span>
        </v-tooltip>
      </div>
    </div>

    <div class="darkModeSwitch">
      Dark
      <v-switch
        v-model="darkMode"
        data-test="darkModeNavDrawerSwitch"
        density="compact"
      ></v-switch>
    </div>
  </v-navigation-drawer>
</template>

<script>
import store from "../store";
import permissions from "../modules/permissions.js";

export default {

  props: {
    modelValue: {
      type: Boolean,
      default: true
    }
  },

  data: () => ({
    homeFolder: null,
    clients: [],
    moduleMounts: [],
    userMenuVisible: false,
    tablesMenuVisible: false,
    attributeTemplatesMenuVisible: false,
    purchasablesMenuVisible: false,
    blogsMenuVisible: true,
    newslettersMenuVisible: true,
    groupsMenuVisible: false,
    jobMenuVisible: false,
    pagesMenuVisible: false,
    timerHandle: null,
  }),

  computed: {
    darkMode: {
      get() {
        return this.$store.state.darkMode;
      },
      set(value) {
        this.$store.commit("setDarkMode", value);
      },
    },
    isToggled: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      },
    },
  },

  beforeUnmount() {
    clearInterval(this.timerHandle);
  },

  created() {
    const _this = this;

    this.update();
    this.updateClients();
    this.updateMounts();

    const eventBus = this.$store.state.nkclient.eventBus;

    eventBus.$on("clientUpdate", (event) => {
      _this.update();
    });

    eventBus.$on("permissionsUpdate", (event) => {
      _this.update();
    });

    eventBus.$on("homefolderUpdate", (event) => {
      _this.update();
    });

    eventBus.$on("darkModeUpdate", (value) => {
      _this.darkMode = value;
    });

    eventBus.$on("activeClientNameUpdate", (event) => {
      _this.updateClients();
      _this.updateMounts();
      _this.update();
    });

    this.timerHandle = setInterval(function () {
      _this.updateClientButtonsHeight();
    }, 100);
  },

  methods: {
    goHome() {
      return this.$router.push({
        name: "Items",
        params: { folderId: this.homeFolder },
      });
    },

    updateClientButtonsHeight() {
      let clientButtons = document.getElementById("clientButtons");
      const rect = clientButtons.getBoundingClientRect();
      const height = window.innerHeight - rect.y - 128;

      if (height <= 0) clientButtons.style.visibility = "hidden";
      else {
        clientButtons.style.visibility = "visible";
        clientButtons.style.height = `${height}px`;
      }
    },

    hasPermission(perm, needsSuperadmin) {
      return permissions.hasPermission(perm, needsSuperadmin);
    },

    changeRoute(routeName) {
      return this.$router.push({ name: routeName });
    },

    changeRouteMount(mount) {
      this.$router.push({
        name: "ModuleView",
        params: {
          module: mount.module.toLowerCase(),
          mount: mount.name.toLowerCase(),
        },
      });
    },

    update() {
      this.homeFolder = this.$store.state.homefolder;
      this.tablesMenuVisible =
        this.$store.state.activeClientAttributeTemplatesAllowed;
      this.userMenuVisible = this.hasPermission("user_admin");
      this.attributeTemplatesMenuVisible =
        this.hasPermission("attributetemplate_admin") &&
        this.$store.state.activeClientAttributeTemplatesAllowed;
      this.groupsMenuVisible = this.hasPermission("group_admin");
      this.jobMenuVisible = this.hasPermission("job_admin");
      this.purchasablesMenuVisible =
        this.$store.state.activeClientUserPurchasesEnabled &&
        this.hasPermission("purchasable_admin");
      this.pagesMenuVisible = this.hasPermission("page_admin");
    },

    switchClient(client) {
      this.$store.commit("setActiveClient", client._id);
      this.$router.push({ name: "ItemsRoot" });
    },

    updateClients() {
      let clients = [];

      for (const client of this.$store.state.clients) {
        clients.push({
          _id: client._id,
          name: client.name,
          active: client._id === this.$store.state.activeClient,
          color: client.name.toColor(0.5),
          initials: client.name.substring(0, 2),
        });
      }

      clients.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });

      this.clients = clients;
    },

    updateMounts() {
      let activeClient = store.state.activeClient;
      const clients = store.state.clients;
      const mounts = [];

      if (!activeClient) {
        for (const client of clients) {
          if (client.primary) {
            activeClient = client._id;
            break;
          }
        }
      }

      function addSubmenu(name) {
        for (const mount of mounts) {
          if (mount.submenu === name) return mount.children;
        }
        const children = [];
        mounts.push({
          submenu: name,
          children: children,
        });
        return children;
      }

      if (clients && activeClient) {
        for (const client of clients) {
          if (client._id === activeClient) {
            for (const module of client.plugins) {
              for (const mount of module.mounts) {
                if (mount.type === "navbar") {
                  const children = addSubmenu(mount.submenu);
                  children.push({
                    module: module.name,
                    name: mount.name,
                    displayText: mount.displayText,
                    icon: mount.icon,
                    target: mount.target,
                    url: mount.url,
                    permissionRequired: mount.permissionRequired,
                    breadcrumb: mount.breadcrumb,
                  });
                }
              }
            }
          }
        }
      }

      mounts.sort(function (a, b) {
        return a.submenu.localeCompare(b.submenu);
      });

      for (const mount of mounts) {
        mount.children.sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });
      }

      this.moduleMounts = mounts;
    },
  },
};
</script>

<style>
.v-navigation-drawer__content {
  overflow: hidden;
}

.clientButtons {
  overflow-y: auto;
  overflow-x: hidden;
  height: 200px;
}

.navDrawer {
  text-align: center;
}

.navDrawer .v-btn {
  width: 32px !important;
  height: 32px !important;
  margin-top: 8px !important;
  margin-left: 8px !important;
  margin-right: 8px !important;
}

.navDrawer .clientButton {
  font-size: 14px;
  font-weight: bold;
  color: black;
}

.navDrawer .activeClient {
  box-shadow: 0 0 1px 3px white;
}

.navDrawer .darkModeSwitch {
  width: 40px;
  margin-top: 20px;
  margin-left: 8px;
  margin-right: 8px;
  color: white;
}

.navDrawer .darkModeSwitch .v-input {
  padding: 0 !important;
  margin: 0 !important;
}

.navDrawer .darkModeSwitch .v-input--selection-controls__ripple {
  display: none !important;
}
</style>

<template>
  <div @contextmenu.prevent>
    <v-app id="inspire" :class="$vuetify.theme.dark ? 'dark' : 'light'">
      <UpdateDialog></UpdateDialog>

      <v-snackbar
        v-model="showError"
        :timeout="4000"
        color="error"
        top>
        {{ error }}
      </v-snackbar>

      <v-snackbar
        v-model="showMessage"
        :timeout="4000"
        color="success"
        top>
        {{ message }}
      </v-snackbar>

      <div class="app-container" v-if="showRouterView">
        <v-content>
          <router-view/>
        </v-content>
      </div>
      <div class="app-container" v-if="showLoginPanel">
        <LoginPanel></LoginPanel>
      </div>
    </v-app>
  </div>
</template>

<script>

import { LoginPanel, UpdateDialog, eventBus } from '@mindcraftgmbh/nukleus-vueui'

export default {
  name: 'App',
  components: {
    LoginPanel,
    UpdateDialog
  },
  data() {
    return {
      settingsLoaded: false
    }
  },
  computed: {
    showRouterView: {
      get() {
        const isAuthenticated = this.$store.state.authenticated;
        return isAuthenticated && this.settingsLoaded;
      }
    },
    showLoginPanel: {
      get() {
        const isAuthenticated = this.$store.state.authenticated;
        return !isAuthenticated && this.settingsLoaded;
      }
    },
    showError: {
      get: function() {
        return this.error != null && this.error.length > 0;
      },
      set: function(value) {
        if (value === false) {
          this.$store.state.error = null;
        }
      }
    },
    error: {
      get: function() {
        return this.$store.state.error;
      }
    },
    showMessage: {
      get: function() {
        return this.message != null && this.message.length > 0;
      },
      set: function(value) {
        if (value === false) {
          this.$store.state.message = null;
        }
      }
    },
    message: {
      get: function() {
        return this.$store.state.message;
      }
    },
  },
  methods: {
    // This function sets up communication between this module and the nukleus webapp,
    // for example to get the access token. This snippet is copied from store.js in vueui 2:
    // https://git.mndcr.com/nukleus/vueui/-/blob/chris_vue3/src/js-modules/store.js#L202.
    initModuleCommunication(context) {
      const eventBus = context.state.nkclient.eventBus;

      let parentOrigin = null;

      // Pass on events coming from the local event bus to the parent application
      // -------------------------------------------------------------------
      eventBus.$on("close", function() {
        window.parent.postMessage({ type: 'close' }, parentOrigin);
      });
      eventBus.$on("routerPush", function(dest) {
        window.parent.postMessage({ type: 'routerPush', data: dest }, parentOrigin);
      });
      eventBus.$on("routerGoBackOrPush", function(dest) {
        window.parent.postMessage({ type: 'routerGoBackOrPush', data: dest }, parentOrigin);
      });

      // Listen for events from the parent application
      // -------------------------------------------------------------------
      window.addEventListener('message', event => {
        const msg = event.data;

        switch(msg.type) {
          case 'parentOrigin': {
            parentOrigin = msg.data;
            break;
          }

          case "jailMode": {
            const itemRepo = context.state.nkclient.getItemRepo();
            itemRepo.jail.active = msg.data;
            eventBus.$emit('jailMode', msg.data);
            break;
          }

          case 'jailMountFolders': {
            const itemRepo = context.state.nkclient.getItemRepo();
            itemRepo.jail.mountedFolders = msg.data;
            eventBus.$emit('jailMountFolders', msg.data);
            break;
          }

          case 'helpUrl':
            eventBus.$emit('helpUrl', msg.data);
            break;

          case 'accessToken':
            context.commit("setAuthenticated", {
              authenticated: true,
              token: msg.data
            });
            break;
        }

      });
    },
  },
  created() {
    const store = this.$store;
    const _this = this;

    this.initModuleCommunication(store);

    eventBus.$on('darkModeUpdate', (value) => {
      _this.$vuetify.theme.dark = value;
    });

    window.registerEventBus = function(mainEventBus) {
      console.log("Got eventbus from main application.");

      eventBus.$on("closeModule", function() {
        mainEventBus.$emit('closeModule');
      });
      eventBus.$on("routerPush", function(dest) {
        mainEventBus.$emit('routerPush', dest);
      });
      mainEventBus.$on('darkModeUpdate', (value) => {
        eventBus.$emit('darkModeUpdate', value);
      });
    };

    store.dispatch("loadSettings").then(function() {
      _this.settingsLoaded = true;
      if (!store.state.authenticated) {
        console.log("Authentication necessary. No token stored!")
      } else {
        console.log("Token loaded. No authentication needed.");
      }
    });
  }
}
</script>

<style>

</style>

<template>
  <div class="moduleFrameContainer">
    <iframe
      v-show="url != null"
      ref="moduleFrame"
      data-test="moduleFrame"
      :class="cssClass"
      :src="url"
      @load="onModuleLoaded"
    >
    </iframe>
    <v-overlay
      :absolute="true"
      :model-value="loading"
      style="height: calc(100vh - 100px); color: white"
      class="align-center justify-center"
    >
      <v-progress-circular indeterminate></v-progress-circular>&nbsp;Loading
      module...
    </v-overlay>
  </div>
</template>
<script>

import { watch } from 'vue'
import store from "../store";

const DEVMODE_PORTS = {
  "studio": 8101,
  "admin": 8102,
  "workflows": 8103,
  "mailing": 8104,
  "payment": 8105,
  "stats": 8106
}

export default {
  data: () => ({
    moduleName: null,
    mountName: null,
    moduleHost: null,
    id: null,
    url: null,
    cssClass: null,
    timer: null,
    loading: false,
    lastModuleName: null,
  }),

  mounted() {
    const _this = this;

    this.updateParams();

    const eventBus = this.$store.state.nkclient.eventBus;

    this._onActiveClientNameUpdate = function() {
      _this.updateParams();
    }

    this._onCloseModule = function() {
      _this.$router.go(-1);
    }

    this._onRouterPush = function(dest) {
      _this.$router.push(dest);
    }

    this._onRouterGoBackOrPush = function(dest) {
      const lastPath = _this.$router.options.history.state.back;
      if (lastPath)
        _this.$router.back();
      else
        _this.$router.replace(dest);
    }

    eventBus.$on("activeClientNameUpdate", this._onActiveClientNameUpdate);

    eventBus.$once("closeModule", this._onCloseModule);
    eventBus.$once("routerPush", this._onRouterPush);
    eventBus.$once("routerGoBackOrPush", this._onRouterGoBackOrPush);
  },

  beforeUnmount() {
    this.clearTimer();

    const eventBus = this.$store.state.nkclient.eventBus;

    eventBus.$off("activeClientNameUpdate", this._onActiveClientNameUpdate);

    eventBus.$off("closeModule", this._onCloseModule);
    eventBus.$off("routerPush", this._onRouterPush);
    eventBus.$off("routerGoBackOrPush", this._onRouterGoBackOrPush);
  },

  created() {
    watch(() => [this.$route], () => {
      this.updateParams();
    });
  },

  methods: {
    onModuleLoaded() {

      this.loading = false;

      const moduleFrame = this.$refs.moduleFrame;
      const _this = this;

      if (moduleFrame) {
        const moduleWindow = moduleFrame.contentWindow;

        const accessToken = this.$store.state.nkclient.getAccessToken();
        moduleWindow.postMessage({ type: 'parentOrigin', data: window.location.origin }, this.moduleHost);
        moduleWindow.postMessage({ type: "accessToken", data: accessToken}, this.moduleHost);

        window.addEventListener('message', function (event) {
          const msg = event.data;
          switch (msg.type) {
            case 'close': {
              _this.$store.state.nkclient.eventBus.$emit('closeModule');
              break;
            }

            case 'routerPush': {
              _this.$store.state.nkclient.eventBus.$emit('routerPush', msg.data);
              break;
            }

            case 'routerGoBackOrPush': {
              _this.$store.state.nkclient.eventBus.$emit('routerGoBackOrPush', msg.data);
              break;
            }
          }
        })
      }
    },

    clearTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },
    monitorPageSize(iframe) {
      this.clearTimer();

      if (!iframe) {
        return;
      }

      this.timer = setInterval(function () {
        const screenHeight = window.innerHeight - 69;
        iframe.height = screenHeight;
      }, 100);
    },

    setUrl(url) {
      if (this.url !== url) {
        console.log("Loading module at: " + url);

        this.url = url;

        if (this.lastModuleName !== this.moduleName) {
          this.lastModuleName = this.moduleName;
          this.loading = true;
        }
      } else {
        console.log("Module url already loaded.");
      }
    },

    updateParams() {
      this.moduleName = this.$route.params.module;
      this.mountName = this.$route.params.mount;
      this.id = this.$route.params.id;

      console.log("Switched route to: ", this.moduleName, this.mountName);

      let activeClient = store.state.activeClient;
      const clients = store.state.clients;

      if (!activeClient) {
        for (const client of clients) {
          if (client.primary) {
            activeClient = client._id;
            break;
          }
        }
      }

      if (clients && activeClient) {
        for (const client of clients) {
          if (client._id === activeClient) {
            for (const module of client.plugins) {
              if (module.name.toLowerCase() === this.moduleName) {
                for (const mount of module.mounts) {
                  if (mount.name.toLowerCase() === this.mountName) {
                    let url = mount.url.replace("{itemId}", this.id);

                    if (url.includes("#/")) {
                      // remove any hashes since they're not needed anymore. This can be removed once mount URLs are changed accordingly
                      url = url.replace('#/', '')
                    }

                    // If we're on localhost, things need to work a bit different. Detect that and if so, transform the URLs to the form
                    // which is necessary on a development machine (use ports instead of subdirectories)
                    if (window.location.href.startsWith("http://localhost")) {
                      console.log("We're on a development machine. Transform module URL!");

                      const devPort = DEVMODE_PORTS[this.moduleName];
                      this.moduleHost = `http://localhost:${devPort}`;

                      const path = url.substring(url.indexOf('/', 1));
                      url = `${this.moduleHost}${path}`;
                    }

                    switch (mount.target) {
                      case "fullframe":
                        this.cssClass = "moduleFullFrame";
                        break;
                      case "page": {
                        this.cssClass = "modulePage";
                        this.monitorPageSize(this.$refs.moduleFrame);
                        break;
                      }
                    }

                    this.setUrl(url);
                    return;
                  }
                }
              }
            }
          }
        }
      } else {
        console.error("clients or activeClient is null");
      }
    },
  },
};
</script>
<style>
.moduleFrameContainer {
  overflow-y: hidden;
  height: calc(100vh - 64px);
  background-color: #303030;
}

.moduleFullFrame {
  padding: 0 !important;
  width: 100%;
  height: 100%;
  border: 0;
}

.modulePage {
  padding: 0 !important;
  width: 100%;
  border: 0;
  overflow: hidden;
}
</style>

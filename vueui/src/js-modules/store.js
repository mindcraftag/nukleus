'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import Vuex from 'vuex'
import Storage from './storage'
import { NkClient } from '@mindcraftgmbh/nukleus-client-api'

// ------------------------------------------------------------------------------
//  STATE
// ------------------------------------------------------------------------------
const _state = {
  // Authentication
  // ----------------------------------------
  authenticated: false,
  token: '',
  me: null,
  homefolder: null,
  loaded: false,

  // Messages displayed below app bar
  // ----------------------------------------
  error: '',
  message: '',

  // Listened folders on update websocket
  // ----------------------------------------
  listenedFolders: [],

  // List of all the users clients and the active one
  // activeClient is null -> primary client is used
  // ----------------------------------------
  clients: [],
  activeClient: null,
  activeClientName: '',
  activeClientPublicDownloadAllowed: false,
  activeClientBrandingAllowed: false,
  activeClientConversationMode: 0,
  activeClientAttributeTemplatesAllowed: false,
  activeClientPaymentIsSetup: false,
  activeClientUserPurchasesEnabled: false,
  activeClientPaymentCard: null,
  activeClientUserStorageQuotaEnabled: false,
  activeClientGroupStorageQuotaEnabled: false,
  activeClientUserTrafficQuotaEnabled: false,
  activeClientGroupTrafficQuotaEnabled: false,

  // Styling
  // ----------------------------------------
  darkMode: false,
  codeEditorTheme: "twilight",

  // Currently running job
  // ----------------------------------------
  job: {
    state: null,
    progress: 0,
    timeout: null,
  },

  // Cache for loaded item data and the currently
  // active item in editor/studio/etc.
  // ----------------------------------------
  nkclient: null,
  websocketWasDisconnected: false
}

// ------------------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------------------

const _mutations = {
  setCodeEditorTheme(state, payload) {
    state.codeEditorTheme = payload;
    state.nkclient.eventBus.$emit('nk:theme:code:changed', payload);
  },
  setAuthenticated(state, payload) {
    state.authenticated = payload.authenticated
    state.token = payload.token

    // This causes issues with having no client for periods of time and that causes requests without or with wrong
    // client, resulting in the wrong data returned. Commented out for now.
    //state.activeClient = null
    //state.activeClientName = ''

    state.nkclient.setAccessToken(payload.token);

    // Same here as above. Keep client set if it is set
    //state.nkclient.setRequestClientId(null)

    Storage.setAuthenticationToken(state.token).catch(
      (error) => (state.error = error)
    )
    //Storage.setActiveClientId(null).catch((error) => (state.error = error))

    this.dispatch('updateMyAccount')
  },
  setActiveClient(state, client) {
    if (state.activeClient !== client) {
      state.activeClient = client

      state.nkclient.setRequestClientId(client)

      Storage.setActiveClientId(state.activeClient).catch(
        (error) => (state.error = error)
      )
      this.dispatch('updateMyAccount')
    }
  },
  setActiveClientName(state, name) {
    state.activeClientName = name
    state.nkclient.eventBus.$emit('activeClientNameUpdate')
  },
  setDarkMode(state, darkMode) {
    if (state.darkMode !== darkMode) {
      state.darkMode = darkMode
      Storage.setDarkMode(darkMode).catch((error) => (state.error = error))
      state.nkclient.eventBus.$emit('darkModeUpdate', darkMode)
    }
  },
  setMe(state, payload) {
    state.me = payload.me
  },
  setHomeFolder(state, payload) {
    state.homefolder = payload
  },
  setError(state, error) {
    state.error = error
  },
  setMessage(state, message) {
    state.message = message
  },
  setListenedFolders(state, folders) {
    state.listenedFolders = folders
    this.dispatch('sendListenedFolders')
  }
}

// ------------------------------------------------------------------------------
//  ACTIONS
// ------------------------------------------------------------------------------

const _actions = {

  init(context) {
    const _this = this;
    const state = context.state;

    context.state.nkclient = new NkClient({ wsAutoConnect: true });

    context.state.nkclient.$on('nk:client:websocketOpen', function() {
      if (_this.state.websocketWasDisconnected)
        _this.commit("setMessage", "Update websocket is open again");
    });

    context.state.nkclient.$on('nk:client:websocketClosed', function() {
      _this.commit("setMessage", "Update websocket is closed");
      _this.state.websocketWasDisconnected = true;
    });

    context.state.nkclient.$on('nk:client:websocketAuthenticated', function() {
      _this.dispatch("sendListenedFolders");
    });

    context.state.nkclient.eventBus.$on('nk:client:elementUpdate', function(data) {
      if (data.type === 'User')
        _this.dispatch("updateMyAccount");
      else if (data.type === 'Job') {
        if (data.operation === "insert") {
          state.message = "Job created";
        } else if (data.operation === "update") {
          switch (data.job.state) {
            case 0:
              break;
            case 1:
              //state.message = "Job is running. Progress: " + d.job.progress;
              state.job.progress = data.job.progress;
              state.job.state = "Running";
              if (state.job.timeout) {
                clearTimeout(state.job.timeout);
                state.job.timeout = null;
              }
              break;
            case 2:
              //state.error = "Job failed!";
              state.job.progress = 100;
              state.job.state = "Failed";
              state.job.timeout = setTimeout(function() {
                state.job.state = null;
              }, 5000);
              break;
            case 3:
              //state.message = "Job is done.";
              state.job.progress = 100;
              state.job.state = "Done";
              state.job.timeout = setTimeout(function() {
                state.job.state = null;
              }, 5000);
              break;
          }
        }
      }
    });
  },

  setApiUrl(context, { hostUrl }) {
    context.state.nkclient.updateBaseUrl(hostUrl);
  },

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
          this.commit("setAuthenticated", {
            authenticated: true,
            token: msg.data
          });
          break;
      }

    });
  },

  sendListenedFolders(context) {
    context.state.nkclient.websocketSend(JSON.stringify({
      type: "switchFolders",
      folders: context.state.listenedFolders,
      client: context.state.activeClient
    }));
  },

  async loadSettings(context) {
    if (!context.state.loaded) {
      try {
        console.log('Loading settings...')

        // Restore Authentication token
        // ---------------------------------------------------------
        const token = await Storage.getAuthenticationToken()
        if (token) {
          context.state.token = token
          context.state.nkclient.setAccessToken(token)
        }

        // Restore dark mode
        // ---------------------------------------------------------
        let darkMode = await Storage.getDarkMode()
        if (darkMode === undefined || darkMode === null) darkMode = false
        context.state.darkMode = darkMode
        context.state.nkclient.eventBus.$emit('darkModeUpdate', darkMode)

        // Load additional settings
        // ---------------------------------------------------------
        const p = this.dispatch('loadAdditionalSettings')
        if (p) await p

        // Restore active client
        // ---------------------------------------------------------
        context.state.activeClient = await Storage.getActiveClientId()
        if (context.state.activeClient)
          context.state.nkclient.setRequestClientId(context.state.activeClient)

        if (token) {
          context.state.authenticated = true
          this.dispatch('updateMyAccount')
        }

        console.log('Settings loaded.')
      } catch (err) {
        context.state.error = err
      }
    }
    context.state.loaded = true
  },

  async updateMyAccount(context) {
    try {
      if (context.state.authenticated && context.state.token) {
        const me = await context.state.nkclient.me()

        if (!context.state.activeClient) {
          for (const membership of me.memberships) {
            if (membership.primary) {
              me.permissions = membership.permissions
              me.groups = membership.groups
              me.admin = membership.admin
              context.state.activeClient = membership.client
              context.state.nkclient.setRequestClientId(membership.client)
              break
            }
          }
        } else {
          let foundMembership = false
          for (const membership of me.memberships) {
            if (membership.client === context.state.activeClient) {
              me.permissions = membership.permissions
              me.groups = membership.groups
              me.admin = membership.admin
              foundMembership = true
              break
            }
          }

          if (!foundMembership && me.superadmin) {
            me.permissions = []
            me.groups = []
            me.admin = true
          }
        }

        let clientUpdated = false
        if (context.state.me) {
          if (me.client !== context.state.me.client) {
            clientUpdated = true
          }
        }

        const eventBus = context.state.nkclient.eventBus;

        context.state.me = me
        eventBus.$emit('permissionsUpdate')
        if (clientUpdated) {
          eventBus.$emit('clientUpdate')
        }

        context.state.nkclient
          .getHomeFolder()
          .then(function (id) {
            context.state.homefolder = id
            eventBus.$emit('homefolderUpdate')
          })
          .catch(function (err) {
            console.error(err)
          })

        this.dispatch('updateClients')
      } else {
        context.state.me = null
      }
    } catch (err) {
      console.error(err)
    }
  },

  async updateClients(context) {
    try {
      // update list of clients
      const clients = await context.state.nkclient.myClients()
      clients.sort(function (a, b) {
        return a.name < b.name ? -1 : 1
      })
      context.state.clients = clients

      // Check which client we currently have active and set the name
      for (const client of context.state.clients) {
        if (client._id === context.state.activeClient) {
          context.state.activeClientName = client.name
          context.state.activeClientPublicDownloadAllowed =
            client.publicDownloadAllowed
          context.state.activeClientAttributeTemplatesAllowed =
            client.attributeTemplatesAllowed
          context.state.activeClientBrandingAllowed = client.brandingAllowed
          context.state.activeClientConversationMode = client.conversationMode
          context.state.activeClientPaymentIsSetup = client.paymentIsSetup
          context.state.activeClientUserPurchasesEnabled =
            client.userPurchasesEnabled
          context.state.activeClientPaymentCard = client.paymentCard
          context.state.activeClientUserStorageQuotaEnabled =
            client.userStorageQuotaEnabled
          context.state.activeClientGroupStorageQuotaEnabled =
            client.groupStorageQuotaEnabled
          context.state.activeClientUserTrafficQuotaEnabled =
            client.userTrafficQuotaEnabled
          context.state.activeClientGroupTrafficQuotaEnabled =
            client.groupTrafficQuotaEnabled
          context.state.nkclient.eventBus.$emit('activeClientNameUpdate')
          return
        }
      }

      // We are not member of this client. Fetch the name from API
      if (context.state.activeClient) {
        const client = await context.state.nkclient.getClient(
          context.state.activeClient
        )
        context.state.activeClientName = client.name
        context.state.activeClientPublicDownloadAllowed =
          client.publicDownloadAllowed
        context.state.activeClientAttributeTemplatesAllowed =
          client.attributeTemplatesAllowed
        context.state.activeClientBrandingAllowed = client.brandingAllowed
        context.state.activeClientConversationMode = client.conversationMode
        context.state.activeClientPaymentIsSetup = false
        context.state.activeClientUserPurchasesEnabled =
          client.userPurchasesEnabled
        context.state.activeClientPaymentCard = null
        context.state.activeClientUserStorageQuotaEnabled =
          !!client.defaultUserStorageQuotaGb
        context.state.activeClientGroupStorageQuotaEnabled =
          !!client.defaultGroupStorageQuotaGb
        context.state.activeClientUserTrafficQuotaEnabled =
          !!client.defaultUserTrafficQuotaGb
        context.state.activeClientGroupTrafficQuotaEnabled =
          !!client.defaultGroupTrafficQuotaGb
        context.state.nkclient.eventBus.$emit('activeClientNameUpdate')
      }
    } catch (err) {
      console.error(err)
    }
  },
}

export default {
  create: function (state, mutations, actions) {
    state = state || {}
    mutations = mutations || {}
    actions = actions || {}

    const store = new Vuex.Store({
      state: { ..._state, ...state },
      mutations: { ..._mutations, ...mutations },
      actions: { ..._actions, ...actions },
    })

    store.dispatch('init')

    return store;
  },
}

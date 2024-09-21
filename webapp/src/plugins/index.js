/**
 * plugins/index.js
 *
 * Automatically included in `./src/main.js`
 */

// Plugins
import vuetify from "./vuetify";
import router from "../router";
import fontawesome from "./fontawesome";
import store from "../store";

import { vueui } from '@mindcraftgmbh/nukleus-vueui'

import "@mindcraftgmbh/nukleus-vueui/style";

// components
import Toolbar from "../components/Toolbar.vue";
import Navigation from "../components/NavigationDrawer.vue";
import Breadcrumbs from "../components/Breadcrumbs.vue";

export function registerPlugins(app) {
  app
    .use(vueui)
    .use(vuetify)
    .use(router)
    .use(store)
    .component("font-awesome-icon", fontawesome)
    .component("toolbar", Toolbar)
    .component("navigation", Navigation)
    .component("breadcrumbs", Breadcrumbs);
}

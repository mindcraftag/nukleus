'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import '../css/vueui.css'

export * from './js-modules'
export * from './lib-components'
export * from '@mindcraftgmbh/nukleus-client-api'

import { Fields } from './lib-components'

const vueui = {

    installed: false,

    install: function(Vue) {
      if (this.installed)
        return;

      this.installed = true;
      Vue.component("Fields", Fields);
    }
}

export { vueui }

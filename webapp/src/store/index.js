"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import { Storage, Store } from "@mindcraftgmbh/nukleus-vueui";

const store = Store.create(
  {
    listDisplayMode: 0,
  },
  {
    setListDisplayMode(state, payload) {
      state.listDisplayMode = payload;
      Storage.setValue("listDisplayMode", payload).catch(
        (error) => (state.error = error),
      );
    },
  },
  {
    async loadAdditionalSettings(context) {
      context.state.listDisplayMode = await Storage.getValue("listDisplayMode");
    },
  },
);

export default store;

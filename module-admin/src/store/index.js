"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import Vue from 'vue';
import { Storage, Store } from "@mindcraftgmbh/nukleus-vueui";

const store = Store.create(Vue,{

}, {

}, {
  async loadAdditionalSettings(context) {

  }
});

export default store;

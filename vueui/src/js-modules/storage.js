'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import localforage from 'localforage'

localforage.config({
  name: 'nukleus',
})

export default {
  async getValue(key, defaultValue) {
    const value = await localforage.getItem(key);
    if (value === undefined || value === null)
      return defaultValue;

    return value;
  },

  async setValue(key, value) {
    return new Promise((resolve, reject) => {
      localforage.setItem(key, value, function (err) {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  },

  async getAuthenticationToken() {
    return this.getValue('token')
  },

  async setAuthenticationToken(token) {
    return this.setValue('token', token)
  },

  async getActiveClientId() {
    return this.getValue('activeClient')
  },

  async setActiveClientId(id) {
    return this.setValue('activeClient', id)
  },

  async getDarkMode() {
    return this.getValue('darkMode')
  },

  async setDarkMode(enabled) {
    return this.setValue('darkMode', enabled)
  },

  async getStudioDockingState() {
    return this.getValue('studioDockingState')
  },

  async setStudioDockingState(state) {
    return this.setValue('studioDockingState', state)
  },
}

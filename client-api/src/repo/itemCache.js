"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

export default class NkItemCache {

  constructor(apiGateway) {
    this.itemCache = new Map();
    this.apiGateway = apiGateway;
  }

  clear() {
    this.itemCache.clear();
  }

  async getItem(id) {
    if (this.itemCache.has(id)) {
      return this.itemCache.get(id);
    }
    const item = await this.apiGateway.call('ItemCache::getItem', 'getItem', id);
    this.itemCache.set(id, item);
    return item;
  }

}
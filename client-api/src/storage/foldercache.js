"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import NkStorage, { NkStorageTypeFileSystem } from "./storage";

export default class NkFolderCache extends NkStorage {

  constructor(nkclient) {
    super("nukleus", "folders", NkStorageTypeFileSystem);

    if (!nkclient)
      throw "A nukleus client needs to be passed.";

    this.nkclient = nkclient;
    this.ready = false;

    // Instead of limiting the size in bytes, which is difficult (since we would have to scan through the entire cache
    // and not neccessary (since browsers allow very large storage quotas), we limit the number of items instead.
    this.maxNumItems = 10000;

    const _this = this;
    this.init().then(function () {
      _this.ready = true;
      _this.checkStorage();
    });
  }

  // Check the used storage and delete items if neccessary.
  async checkStorage() {
    const keys = await this._keys();
    let difference = keys.length - this.maxNumItems;

    if (difference > 0) {
      // Increase the difference to half of the available storage space, so we don't have to remove items every time we add a new one.
      difference = Math.floor(this.maxNumItems / 2);

      const promises = [];
      for (let i = 0; i < difference; i++) {
        promises.push(this._remove(keys[i]));
      }

      await Promise.all(promises);
    }
  }

  async getFolderListing(id) {
    if (!this.ready) return null;

    return this._get(id, "application/json");
  }

  async getItemListing(folderID) {
    if (!this.ready) return null;

    const itemListing = await this._get("items_" + folderID, "application/json");
    if (!itemListing) return null;

    const folder = await this.getFolderListing(folderID);

    // If we cached the item listing after the folder was last updated, we can be sure that the item listing is still up-to-date.
    if (folder && folder.parent && new Date(itemListing.cachedAt).getTime() > new Date(folder.parent.updatedAt).getTime()) {
      return itemListing.data;
    } else {
      return null;
    }
  }

  async getFolderACLs(id, timeout) {
    if (!this.ready) return null;

    const acl = await this._get("acl_" + id, "application/json");

    // If the cached ACL is older than the timeout, return null.
    if (acl) {
      if (Date.now() - acl.cachedAt < timeout) {
        delete acl.cachedAt;
        return acl;
      }
    }
    return null;
  }

  // Update the cachedAt timestamp of a folder.
  async refreshCacheForFolder(folderID) {
    const data = await this.getFolderListing(folderID);
    await this.addFolderListing(folderID, data);
  }

  async addFolderListing(folderID, listing) {
    if (!this.ready) return;

    await this._set(folderID, {
      ...listing,
      cachedAt: new Date()
    });

    await this.checkStorage();
  }

  async addItemListing(folderID, itemListing) {
    if (!this.ready) return;

    await this._set("items_" + folderID, {
      data: itemListing,
      cachedAt: new Date()
    });

    await this.checkStorage();
  }

  async addACL(folderID, acls) {
    if (!this.ready) return;

    await this._set("acl_" + folderID, {
      ...acls,
      cachedAt: new Date()
    });

    await this.checkStorage();
  }
}

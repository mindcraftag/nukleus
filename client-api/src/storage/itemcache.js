"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import eventBus from '../eventbus';
import moment from 'moment';
import NkStorage, { NkStorageTypeFileSystem } from "./storage";
import lodash from 'lodash';

export default class NkItemCache extends NkStorage {

  constructor(usePublicApi, usePersistentStorage, nkclient, persistentStorageSizeMb) {
    super("nukleus", "items", NkStorageTypeFileSystem);

    if (!nkclient)
      throw "A nukleus client needs to be passed.";

    const BYTES_PER_MIB = 1024 * 1024;

    this.nkclient = nkclient;
    this.cache = new Map();
    this.urlToIdMap = new Map();
    this.logging = false;
    this.usePublicApi = !!usePublicApi;
    this.ready = false;
    this.quota = (persistentStorageSizeMb || 1024) * BYTES_PER_MIB; // 1GB default storage
    this.size = 0;
    this.usePersistentStorage = !!usePersistentStorage;

    function internalSaveIndex() {
      const data = [];

      for (const object of this.cache.values()) {
        data.push({
          id: object.id,
          time: object.time.valueOf(),
          size: object.size,
          hash: object.hash,
          itemType: object.itemType,
          mimeType: object.mimeType,
          itemName: object.itemName
        });
      }

      this._set("index", data).then(function() {
        console.log("Cache index saved.");
      }).catch(function(err) {
        console.error("Error saving cache index: " + err);
      });
    }

    this.saveIndex = lodash.debounce(internalSaveIndex, 1000);

    const _this = this;
    this.init().then(function() {
      _this.initFromStorage();
    });
  }

  getQuota() {
    return this.quota;
  }

  setQuota(value) {
    this.quota = value;
    this.checkQuota();
  }

  getCount() {
    return this.cache.size;
  }

  getSize() {
    return this.size;
  }

  async initFromStorage() {
    if (this.usePersistentStorage) {
      let timeBegin = new Date();

      const indexData = await this._get("index", "application/json");
      if (!indexData || !Array.isArray(indexData)) {
        // There is no index file. This probably means the cache was never used or has old format. To be safe, clear it!
        await this._clear();
        this.saveIndex();
      } else {
        for (const entry of indexData) {
          entry.time = moment(entry.time);
          this.cache.set(entry.id, entry);
          this.size += entry.size;
        }
      }

      this.checkQuota();

      let timeEnd = new Date();
      let timeElapsed = timeEnd - timeBegin;
      console.log(`Cache is ready. Time: ${timeElapsed}ms`);
    }

    this.ready = true;
    eventBus.$emit('nk:itemCache:cacheReady');
    eventBus.$emit('nk:itemCache:cacheChange');
  }

  async addToStorage(object, blob) {
    if (this.usePersistentStorage) {
      const storeObject = {
        id: object.id,
        time: moment(object.time.toDate()),
        size: object.size,
        hash: object.hash,
        itemType: object.itemType,
        mimeType: object.mimeType,
        itemName: object.itemName
      };

      await this._set(`blob_${object.id}`, blob);
      this.cache.set(object.id, storeObject);
      this.saveIndex();
    }

    this.size += object.size;
  }

  waitUntilReady() {
    const _this = this;
    return new Promise((resolve, reject) => {
      try {
        if (_this.ready)
          resolve();
        else {
          eventBus.$on('nk:itemCache:cacheReady', () => {
            resolve();
          });
        }
      }
      catch(err) {
        reject(err);
      }
    });
  }

  findObject(id) {
    return this.cache.get(id);
  }

  getEntries() {
    return this.cache.values();
  }

  clear() {
    for (const object of this.cache.values()) {
      if (object.objectUrl) {
        URL.revokeObjectURL(object.objectUrl);
      }
    }

    this.cache.clear();
    eventBus.$emit('nk:itemCache:cacheChange');

    if (this.usePersistentStorage) {
      this._clear().then(function () {
        console.log("Cache storage cleared.")
      }).catch(function (error) {
        console.error(error);
      });
    }
  }

  clearMemory() {
    for (let object of this.cache.values()) {
      if (object.objectUrl) {
        URL.revokeObjectURL(object.objectUrl);
        delete object.objectUrl;
      }
    }
    eventBus.$emit('nk:itemCache:cacheChange');
  }

  checkQuota(increase) {
    increase = parseInt(increase);
    if (isNaN(increase))
      increase = 0;

    let newSize = this.size + increase;
    if (newSize > this.quota) {
      // Sort all cache entries by size
      // ------------------------------------------
      const sortedEntries = [...this.cache.entries()].sort(function(a, b) {
        return a[1].time.valueOf() - b[1].time.valueOf();
      });

      // Delete them one by one until we're under the quota
      // ------------------------------------------
      let i=0;
      while(newSize > this.quota && i < sortedEntries.length) {
        const entry = sortedEntries[i][1];

        // never remove alive objects from cache! so check objectUrl for existence
        if (!entry.objectUrl) {
          newSize -= entry.size;
          this.removeObjectFromCache(entry.id);
        }

        i++;
      }
    }
  }

  removeObjectFromCache(id) {
    const object = this.cache.get(id);
    if (object.objectUrl) {
      URL.revokeObjectURL(object.objectUrl);
    }
    this.cache.delete(id);
    this.size -= object.size;

    if (this.usePersistentStorage) {
      this._remove(`blob_${object.id}`).then(function () {
        console.log(`Removed blob for ${id} from cache`);
      }).catch(function (error) {
        console.error(`Error removing blob for ${id} from cache: ${error}`);
      });

      this.saveIndex();
    }
  }

  getIdFromUrl(url) {
    if (this.urlToIdMap.has(url))
      return this.urlToIdMap.get(url);
    else
      return null;
  }

  getById(id) {
    const object = this.findObject(id);
    if (object) {
      if (this.logging)
        console.log("Retrieving from cache: " + id);

      object.time = moment();
      return object;
    }

    if (this.logging)
      console.error("Object not in cache: " + id);
    return null;
  }

  getObjectUrl(url) {
    const id = this.getIdFromUrl(url);
    if (!id) {
      console.error("Could not find URL in cache: " + url);
      return "";
    }

    const object = this.getById(id);
    if (!object) {
      console.error("Could not find Id in cache: " + id);
      return "";
    }

    return object.objectUrl;
  }

  async getBufferById(id) {
    const blob = await this.getBlobById(id);
    if (blob) {
      return await new Response(blob).arrayBuffer();
    }
    return null;
  }

  async getBlobById(id) {
    const item = this.getById(id);
    if (item) {
      return await fetch(item.objectUrl).then(r => r.blob());
    }
    return null;
  }

  async loadFromStorage(object) {
    if (object.objectUrl)
      return true;

    let blob = null;
    if (this.usePersistentStorage) {
      blob = await this._get(`blob_${object.id}`);
      if (!blob)
        return false;
    } else {
      return false;
    }

    object.objectUrl = URL.createObjectURL(blob);
    object.time = moment();
    this.saveIndex();
    eventBus.$emit('nk:itemCache:cacheChange');
    return true;
  }

  getCacheKey(id, lodLevel) {
    if (!lodLevel || lodLevel.type === "item")
      return id;
    else
      return id + "_lod" + lodLevel.index;
  }

  _getLodLevelUrl(itemId, lodLevel) {
    let url;
    if (!lodLevel || lodLevel.type === "item")
      url = this.nkclient.getDownloadUrl(itemId);
    else
      url = this.nkclient.getAttachmentDownloadUrl(itemId, "lod", lodLevel.index);

    return url;
  }

  async loadItem(id, lodLevel, loadingProgressFunc) {
    let trials = 0;

    while(true) {
      try {
        let result;

        if (this.usePublicApi) {
          if (!lodLevel || lodLevel.type === "item")
            result = await this.nkclient.publicDownloadItem(id, loadingProgressFunc);
          else
            result = await this.nkclient.downloadPublicAttachment(id, "lod", lodLevel.index, loadingProgressFunc);
        } else {
          if (!lodLevel || lodLevel.type === "item")
            result = await this.nkclient.downloadItem(id, loadingProgressFunc);
          else
            result = await this.nkclient.downloadAttachment(id, "lod", lodLevel.index, loadingProgressFunc);
        }

        return result;
      } catch (err) {
        console.log(err);
        trials++;
        if (trials < 3) {
          console.debug(`Failed attempts to download item ${id}: ${trials}. Trying again...`);
        } else {
          eventBus.$emit('nk:client:fatalError', `Failed to download item ${id}`);
          return null;
        }
      }
    }
  }

  async addItemToCache(id, lodLevel, hash, loadingProgressFunc) {
    try {
      const cacheKey = this.getCacheKey(id, lodLevel);
      const object = this.findObject(cacheKey);
      if (object) {

        // in case we have no hash and can use protected API, query the hash
        if (!hash && this.nkclient.getItemHash && !this.usePublicApi) {
          hash = await this.nkclient.getItemHash(id);
        }

        // check if the item has changed if we have a hash
        if (hash && object.hash === hash) {
          if (this.logging) {
            console.log("Item already in cache: " + id);
          }

          // we have the exact item in storage. load it from there
          if (await this.loadFromStorage(object)) {
            if (!object.url) {
              object.url = this._getLodLevelUrl(id, lodLevel);
            }
            this.urlToIdMap.set(object.url, cacheKey);
            return object;
          }
        }
      }

      if (loadingProgressFunc)
        loadingProgressFunc(0);

      let result = await this.loadItem(id, lodLevel, loadingProgressFunc);
      if (!result) {
        console.error("Was not able to load object into cache: " + cacheKey);
        return null;
      }

      if (loadingProgressFunc)
        loadingProgressFunc(100);

      const url = this._getLodLevelUrl(id, lodLevel);

      const objectUrl = URL.createObjectURL(result.blob);
      const newObject = {
        id: cacheKey,
        url: url,
        time: moment(),
        objectUrl: objectUrl,
        size: result.blob.size,
        hash: result.hash,
        itemType: result.itemType,
        mimeType: result.mimeType,
        itemName: result.itemName
      };

      this.checkQuota(newObject.size);
      await this.addToStorage(newObject, result.blob);

      this.cache.set(cacheKey, newObject);
      this.urlToIdMap.set(url, cacheKey);
      this.saveIndex();
      eventBus.$emit('nk:itemCache:cacheChange');
      if (this.logging) {
        console.log("Added item to cache: ", newObject);
      }
      return newObject;
    }
    catch(err) {
      console.error(err);
      return null;
    }
  }

  getObjectCount() {
    let count = 0;
    for (const id in this.cache) {
      if (this.cache.hasOwnProperty(id)) {
        count++;
      }
    }
    return count;
  }

  getObjectSize() {
    let size = 0;
    for (const item in this.cache.values()) {
      size += item.size;
    }
    return size;
  }
}


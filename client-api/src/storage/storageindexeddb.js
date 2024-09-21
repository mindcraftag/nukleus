"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import localforage from 'localforage'

export default class NkStorageIndexedDb {

    constructor(databaseName, collectionName, size) {
        localforage.config({
            driver: localforage.INDEXEDDB
        });

        this.databaseName = name || "nukleus-cache";
        this.collectionName = collectionName || 'data';
        this.size = size; // not used!
        this.store = localforage.createInstance({
            name: this.databaseName,
            storeName: this.collectionName
        });
    }

    async init() {
        // nothing to do here.
    }

    async _keys() {
        return this.store.keys();
    }

    async _set(key, data) {
        return this.store.setItem(key, data);
    }

    async _clear() {
        return this.store.clear();
    }

    async _get(key, mimeType) {
        return this.store.getItem(key);
    }

    async _remove(key) {
        return this.store.removeItem(key);
    }
}


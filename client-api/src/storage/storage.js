"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import NkStorageIndexedDb from './storageindexeddb'
import NkStorageFileSystem from './storagefilesystem';

const NkStorageTypeIndexedDb = 0;
const NkStorageTypeFileSystem = 1;

export {
    NkStorageTypeIndexedDb,
    NkStorageTypeFileSystem
}

export default class NkStorage {

    constructor(databaseName, collectionName, type, sizeMb) {
        this.databaseName = databaseName || "nukleus";
        this.collectionName = collectionName || 'data';
        this.size = 1024 * 1024 * (sizeMb || 1);

        this.type = type || NkStorageTypeIndexedDb;
        switch (this.type) {
            case NkStorageTypeIndexedDb:
                this.impl = new NkStorageIndexedDb(this.databaseName, this.collectionName, this.size);
                break;

            case NkStorageTypeFileSystem:
                this.impl = new NkStorageFileSystem(this.databaseName, this.collectionName, this.size);
                break;

            default:
                throw "Invalid storage type: " + type;
        }
    }

    async init() {
        return this.impl.init();
    }

    async _keys() {
        return this.impl._keys();
    }

    fixKey(key) {
        // the keys might include the / character for items from packages, but this would imply a subfolder in the filesystem
        return key.replaceAll("/", "_");
    }

    async _set(key, data) {
        return this.impl._set(this.fixKey(key), data);
    }

    async _clear() {
        return this.impl._clear();
    }

    async _get(key, mimeType) {
        return this.impl._get(this.fixKey(key), mimeType);
    }

    async _remove(key) {
        return this.impl._remove(this.fixKey(key));
    }
}


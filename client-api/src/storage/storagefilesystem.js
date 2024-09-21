"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const DEBUG_MODE = false;

export default class NkStorageFileSystem {

    constructor(databaseName, collectionName, size) {
        this.databaseName = databaseName;
        this.collectionName = collectionName;
        this.size = size;
    }

    async init() {
        if (typeof window === 'object' && ('requestFileSystem' in window || 'webkitRequestFileSystem' in window)) {
            const requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
            this.storage = await new Promise((resolve, reject) => {
                requestFileSystem(
                    window.PERSISTENT,
                    this.size,
                    fs => resolve(fs),
                    error => reject(error)
                );
            });

            const dbFolder = await this._createDirectory(this.storage.root, this.databaseName);
            const collectionFolder = await this._createDirectory(dbFolder, this.collectionName);

            this.root = collectionFolder;

            this._log("keys", null, null, await this._keys());

            return true;
        } else {
            return false;
        }
    }

    _log(action, key, size, content) {
        if (!DEBUG_MODE)
            return;

        if (key && size)
            console.log(`FileSystemStorage[${this.databaseName},${this.collectionName}]: ${action} '${key}' with size ${size}`, content);
        else if (key)
            console.log(`FileSystemStorage[${this.databaseName},${this.collectionName}]: ${action} '${key}'`, content);
        else
            console.log(`FileSystemStorage[${this.databaseName},${this.collectionName}]: ${action}`, content);
    }

    async _createDirectory(parent, name) {
        return new Promise((resolve, reject) => {
            parent.getDirectory(
                name,
                { create: true },
                (directoryEntry) => {
                    resolve(directoryEntry);
                },
                reject,
            );
        });
    }

    async _getFile(key, op, mimeType) {
        if (!this.root)
            return null;

        const _this = this;
        return new Promise((resolve, reject) => {
            _this.root.getFile(
                key,
                {create: op === "write"},
                fileEntry => {
                    switch(op) {
                        case "write":
                            fileEntry.createWriter(fileWriter => { resolve(fileWriter); });
                            break;

                        case "read":
                            fileEntry.file(file => {
                                switch(mimeType) {
                                    case "text/plain":
                                    case "application/json":
                                        const reader = new FileReader();
                                        reader.onload = event => {
                                            if (mimeType === 'application/json') {
                                                try {
                                                    const obj = JSON.parse(event.target.result);
                                                    resolve(obj);
                                                }
                                                catch(err) {
                                                    console.error("Could not parse JSON: ", err);
                                                    resolve(null);
                                                }
                                            } else {
                                                resolve(event.target.result);
                                            }
                                        };
                                        reader.onerror = () => {
                                            resolve(null);
                                        };
                                        reader.readAsText(file);
                                        break;

                                    default:
                                        const blob = file.slice(0, file.size, mimeType || "application/octet-stream");
                                        resolve(blob);
                                        break;
                                }
                            });
                            break;

                        case "get":
                        default:
                            resolve(fileEntry);
                            break;
                    }
                },
                error => {
                    if (op === 'write')
                        reject(error);
                    else
                        resolve(null)
                }
            );
        });
    }

    async _forEachFile(func) {
        if (!this.root)
            return;

        return new Promise((resolve, reject) => {
            const keys = [];
            const dirReader = this.root.createReader();
            dirReader.readEntries(entries => {
                entries.forEach(entry => {
                    try {
                        func(this.root, entry);
                    }
                    catch(err) {
                        reject(err);
                    }
                });
                resolve(keys);
            });
        });
    }

    async _keys() {
        if (!this.root)
            return [];

        const keys = [];
        await this._forEachFile((dir, entry) => {
            if (entry.isFile) {
                keys.push(entry.name);
            }
        });
        return keys;
    }

    async _set(key, data) {
        if (!this.root)
            return;

        // remove the old file first if it exists. If we don't do this, it can happen that
        // if the file content to be written is shorter than the old one, the end of the old one is
        // kept untouched and the file is corrupted!
        await this._remove(key);

        const writer = await this._getFile(key, "write");
        if (data instanceof Blob) {
            this._log("writing", key, data.size, data);
            writer.write(data);
        } else if (typeof data === 'object') {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            this._log("writing", key, data.size, data);
            writer.write(blob);
        } else {
            const blob = new Blob([data], { type: 'text/plain' });
            this._log("writing", key, data.size, data);
            writer.write(blob);
        }
    }

    async _clear() {
        if (!this.root)
            return;

        const promises = [];
        await this._forEachFile((dir, entry) => {
            promises.push(new Promise(resolve => {
                entry.remove(() => {
                    resolve();
                });
            }));
        });

        this._log("clearing");
        return Promise.all(promises);
    }

    async _get(key, mimeType) {
        if (!this.storage)
            return null;

        const data = await this._getFile(key, "read", mimeType);
        this._log("reading", key, undefined, data);
        return data;
    }

    async _remove(key) {
        if (!this.storage)
            return;

        this._log("removing", key);
        const file = await this._getFile(key, "get");
        if (file) {
            return new Promise((resolve, reject) => {
                file.remove(resolve, reject);
            });
        }
    }
}


"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const plugins           = require("../plugins.js");
const logger            = require("../tools/logger");
const storageService    = require("./storageService");

let validStorages = [];
let defaultStorage = null;
let serverLocation = null;

exports.init = async function(location) {
    logger.info("Initializing file storage");

    serverLocation = location;
    let storages = await storageService.getStorages();

    for (let storage of storages) {
        logger.info(` - adding storage '${storage.name}' of type '${storage.type}' in location '${storage.location.country} / ${storage.location.region}'`);
        const plugin = plugins.getStoragePluginByName(storage.type);
        if (!plugin) {
            logger.error(` - storage plugin type '${storage.type}' not found!`);
        } else {
            storage.plugin = plugin.instantiate(storage.config);
            storageService.calculateStorageLocationPoints(serverLocation, storage);
            logger.debug(` - storage '${storage.name}' initialized with ${storage.locationPoints} location points.`);
            validStorages.push(storage);

            if (!defaultStorage) {
                defaultStorage = storage;
            } else {
                if (storage.locationPoints > defaultStorage.locationPoints)
                    defaultStorage = storage;
            }
        }
    }

    if (!validStorages.length)
        throw "No storage found! Please configure a storage in mongoDB";

    logger.info(` - default storage is '${defaultStorage.name}'.`);
};

exports.isFavoredStorage = function(storage) {
    return storage._id.equals(defaultStorage._id);
}

exports.getFavoredStorage = function(storages) {
    for (const storage of storages) {
        if (exports.isFavoredStorage(storage)) {
            return storage;
        }
    }

    return storages[0];
}

function getStorage(storageId) {
    if (!storageId) {
        throw "Invalid storage ID";
    }
    const sid = storageId.toString();
    //console.log(sid);
    for (const storage of validStorages) {
        const sid2 = storage._id.toString();
        //console.log(sid2);
        if (sid === sid2) {
            return storage;
        }
    }
    return null;
}

exports.upload = async function(name, bufferOrStream, storageId) {
    const storage = getStorage(storageId);
    if (storage) {
        return storage.plugin.storeData(name, bufferOrStream);
    }
    else {
        throw "Invalid storage ID: " + storageId;
    }
};

exports.delete = async function(name, storageId) {
    const storage = getStorage(storageId);
    if (storage) {
        return storage.plugin.deleteData(name);
    }
    else {
        throw "Invalid storage ID: " + storageId;
    }
};

exports.download = async function(name, storages, start, end) {
    if (!defaultStorage || !defaultStorage.plugin)
        throw "No storage plugin loaded!";

    if (!storages.length) {
        throw "Item has no storages";
    }

    // Check if the specified storage is included in the array.
    // We don't use the Array.includes function, because we can't use it on an array of ObjectIDs.
    const storageIncluded = (array, storage) => {
        return array.some(elem => elem.equals(storage._id));
    }

    let chosenStorage;
    if (!storageIncluded(storages, defaultStorage)) {
        for (const storageCandidate of validStorages) {
            if (storageIncluded(storages, storageCandidate)) {
                chosenStorage = storageCandidate;
                break;
            }
        }
    } else {
        chosenStorage = defaultStorage;
    }

    if (!chosenStorage) {
        throw "No storage for this item found";
    }

    return chosenStorage.plugin.retrieveData(name, start, end);
};

exports.copy = async function(sourceName, destName, storageId) {
    for (const storage of validStorages) {
        if (storage._id.equals(storageId))
            return storage.plugin.copyData(sourceName, destName);
    }
    throw "Invalid storage ID: " + storageId;
};

exports.enumerate = async function(storageId) {
    for (const storage of validStorages) {
        if (storage._id.equals(storageId))
            return storage.plugin.enumerate();
    }
    throw "Invalid storage ID: " + storageId;
};

exports.getStorages = function() {
    return validStorages;
};

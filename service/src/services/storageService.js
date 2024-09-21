"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose = require('@mindcraftgmbh/nukleus-model').mongoose;
const security = require('../tools/security');

exports.getStorages = async function() {
    const Storage = mongoose.model('Storage');
    const storages = await Storage.find({}).exec();
    return storages;
}

exports.getStoragesInfo = async function() {
    const Storage = mongoose.model('Storage');
    const storages = await Storage.find({}).select("name type location").exec();
    return storages;
}

exports.calculateStorageLocationPoints = function(location, storage) {
    let points = 0;
    points += storage.location.country === location.country ? 2 : 0;
    points += storage.location.region === location.region ? 1 : 0;
    storage.locationPoints = points;
}

exports.getStorageHash = function(storages) {
    const storageStrings = [];
    for (const storage of storages) {
        storageStrings.push(storage.toString());
    }
    storageStrings.sort();
    return security.sha256(storageStrings.join());
}
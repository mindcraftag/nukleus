"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const {ValidationError} = require("../exception");
const mongoose = require('@mindcraftgmbh/nukleus-model').mongoose;

exports.getMyCollections = async function(ownerId, ownerType, clientId) {

    const query = {
        client: clientId,
        deletedAt: { $exists: false }
    };

    switch(ownerType) {
        case "user":
            query.ownerUser = ownerId;
            break;
        case "group":
            query.ownerGroup = ownerId;
            break;
        default:
            throw new ValidationError("Owner type not valid. Must be user or group");
    }

    const Collection = mongoose.model('Collection');
    const collections = await Collection.find(query).select("_id name public");

    return collections;
}

exports.createCollection = async function(ownerId, ownerType, clientId, name) {

}

exports.getCollection = async function(id, userId, clientId) {

}

exports.addItemToCollection = async function(collectionId, ownerId, ownerType,  clientId, itemId) {

}

exports.removeItemFromCollection = async function(collectionId, ownerId, ownerType, clientId, itemId) {

}

exports.deleteCollection = async function(collectionId, ownerId, ownerType, clientId) {

}


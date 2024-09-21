"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose          = require('@mindcraftgmbh/nukleus-model').mongoose;
const security          = require('../tools/security');
const ValidationError   = require('../exception').ValidationError;
const limits            = require('../limits');

exports.createAccessToken = async function(name, type, clientId, userId) {

    const AccessToken = mongoose.model('AccessToken');
    if (await AccessToken.existsByName(name, clientId, userId)) {
        throw new ValidationError("Name already exists.");
    }

    const count = await AccessToken.find({ client: clientId, user: userId }).count();
    if (count >= limits.MAX_ACCESS_TOKENS_PER_USER) {
        throw new ValidationError(`Maximum amount of tokens exceeded. Allowed are ${limits.MAX_ACCESS_TOKENS_PER_USER}`);
    }

    const accessToken = new AccessToken();
    accessToken.name = name;
    accessToken.token = await security.createRandomPassword(32);
    accessToken.type = type;
    accessToken.client = clientId;
    accessToken.user = userId;
    accessToken.enabled = true;

    await accessToken.save();

    return accessToken;
}

exports.getAccessTokens = async function(type, userId) {
    const AccessToken = mongoose.model('AccessToken');
    const accessTokens = await AccessToken.find({ type: type, user: userId }).exec();
    return accessTokens;
}

exports.getAccessToken = async function(tokenId, type, userId) {
    const AccessToken = mongoose.model('AccessToken');
    const accessToken = await AccessToken.findOne({ _id: tokenId, type: type, user: userId }).exec();
    if (!accessToken) {
        throw new ValidationError("Access token not found!");
    }
    return accessToken;
}

exports.validateAccessToken = async function(token, type) {
    const AccessToken = mongoose.model('AccessToken');
    const accessToken = await AccessToken.findOne({ token: token, type: type }).exec();
    if  (accessToken && accessToken.enabled) {
        return {
            valid: true,
            clientId: accessToken.client,
            userId: accessToken.user,
            tokenId: accessToken._id
        };
    } else {
        return {
            valid: false
        };
    }
}

exports.enableAccessToken = async function(tokenId, type, userId) {
    let accessToken = await exports.getAccessToken(tokenId, type, userId);

    if (accessToken.enabled) {
        throw new ValidationError("Access token is already enabled.");
    }

    accessToken.enabled = true;
    await accessToken.save();
}

exports.disableAccessToken = async function(tokenId, type, userId) {
    let accessToken = await exports.getAccessToken(tokenId, type, userId);

    if (!accessToken.enabled) {
        throw new ValidationError("Access token is already disabled.");
    }

    accessToken.enabled = false;
    await accessToken.save();
}

exports.deleteAccessToken = async function(tokenId, type, userId) {
    await exports.getAccessToken(tokenId, type, userId);
    const AccessToken = mongoose.model('AccessToken');
    await AccessToken.deleteOne({ _id: tokenId, type: type, user: userId }).exec();
}

// Create an access token restricted to a single client.
exports.getAccessTokenInClient = async function(tokenId, type, clientId) {
    const AccessToken = mongoose.model('AccessToken');
    const accessToken = await AccessToken.findOne({ _id: tokenId, type: type, client: clientId }).exec();
    if (!accessToken) {
        throw new ValidationError("Access token not found!");
    }
    return accessToken;
}

// Delete an access token from a client.
exports.deleteAccessTokenInClient = async function(tokenId, type, clientId) {
    await exports.getAccessTokenInClient(tokenId, type, clientId);
    const AccessToken = mongoose.model('AccessToken');
    await AccessToken.deleteOne({ _id: tokenId, type: type, client: clientId }).exec();
}

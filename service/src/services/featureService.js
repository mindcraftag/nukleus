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
const clientService = require('./clientService');
const userService = require('./userService');
const groupService = require("./groupService");

exports.getFeatures = async function() {
    const Feature = mongoose.model('Feature');
    return Feature.find().exec();
}

exports.getUserFeatures = async function(user, groupId) {
    let features;
    if (user.isAdmin()) {
        features = await clientService.getEnabledFeatures(user.client);
    } else {
        const userFeatures = await userService.getUserFeatures(user, groupId);
        features = await clientService.getEnabledFeatures(user.client, true, userFeatures);
    }
    return features;
}

exports.getUserFeatureNames = async function(user, groupId) {
    const features = await exports.getUserFeatures(user, groupId);
    return features.map(x => x.name);
}

exports.getUserFeaturesByUserAndClientId = async function(userId, clientId, groupId) {

    const { user, membership } = await userService.getUser(userId, clientId);
    user.activeMembership = membership;

    let features;
    if (user.isAdmin()) {
        features = await clientService.getEnabledFeatures(membership.client);
    } else {
        const userFeatures = await userService.getUserFeatures(user, groupId);
        features = await clientService.getEnabledFeatures(membership.client, true, userFeatures);
    }
    return features;
}

exports.getUserFeatureNamesByUserAndClientId = async function(userId, clientId, groupId) {
    const features = await exports.getUserFeaturesByUserAndClientId(userId, clientId, groupId);
    return features.map(x => x.name);
}

exports.getGroupFeaturesByGroupId = async function(groupId) {
    const Group = mongoose.model('Group');
    const group = await Group.findOne({
        _id: groupId,
        deletedAt: { $exists: false }
    }).select("allowedFeatures client").exec();

    if (!group) {
        return [];
    }

    const features = await clientService.getEnabledFeatures(group.client, true, group.allowedFeatures);
    return features;
}

exports.getGroupFeatureNamesByGroupId = async function(groupId) {
    const features = await exports.getGroupFeaturesByGroupId(groupId);
    return features.map(x => x.name);
}

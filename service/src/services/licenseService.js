"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose              = require('@mindcraftgmbh/nukleus-model').mongoose;
const ValidationError       = require('../exception').ValidationError;
const PermissionDeniedError = require('../exception').PermissionDeniedError;

/**
 * Check for existance of license
 * @param id
 * @param clientId
 * @returns {Promise<boolean>}
 */
exports.existsLicense = async function(id, clientId) {
    const License = mongoose.model('License');
    const license = await License.findOne({ _id: id, client: clientId, deletedAt: { $exists: false } }).select("_id").exec();
    return !!license;
}

/**
 * Accepts an array of license IDs and checks them against the given client. Returns a new array with only the existing IDs
 * @param idArray
 * @param clientId
 * @return {Promise<Types.ObjectId[]>}
 */
exports.filterLicenses = async function(idArray, clientId) {
    const License = mongoose.model('License');
    const licenses = await License.find({ _id: idArray, client: clientId, deletedAt: { $exists: false } }).select("_id").exec();
    return licenses.map(x => x._id);
}

/**
 * Get all licenses for a client.
 * @param clientId
 * @param withTexts texts should also be retrieved
 * @returns {Promise<*>}
 */
exports.getLicenses = async function(clientId, withTexts) {
    const License = mongoose.model('License');
    const query = License.find({ client: clientId, deletedAt: { $exists: false } });

    if (!withTexts)
        query.select("-text");

    const licenses = await query.exec();
    return licenses;
}

/**
 * Get all licenses for a client and check if they're public. If not, will throw a ValidationError
 * @param clientId
 * @param withTexts texts should also be retrieved
 * @returns {Promise<*>}
 */
exports.getPublicLicenses = async function(clientId, withTexts) {
    const Client = mongoose.model('Client');
    const client = await Client.findOne({ _id: clientId, deletedAt: { $exists: false }}).select("publicLicenses").exec();

    if (!client || !client.publicLicenses) {
        throw new PermissionDeniedError();
    }

    const License = mongoose.model('License');
    const query = License.find({ client: clientId, deletedAt: { $exists: false } });

    if (!withTexts)
        query.select("-text");

    const licenses = await query.exec();
    return licenses;
}

/**
 * Get specific license
 * @param id
 * @param clientId
 * @returns {Promise<*>}
 */
exports.getLicense = async function(id, clientId) {
    const License = mongoose.model('License');
    const license = await License.findOne({ _id: id, client: clientId, deletedAt: { $exists: false } }).exec();
    if (!license) {
        throw new ValidationError("Could not find license.");
    }

    return license;
}

/**
 * Get specific license. License for that client need to be public, otherwise a ValidationError is thrown
 * @param id
 * @returns {Promise<*>}
 */
exports.getPublicLicense = async function(id) {
    const License = mongoose.model('License');
    const license = await License.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!license) {
        throw new ValidationError("Could not find license.");
    }

    const Client = mongoose.model('Client');
    const client = await Client.findOne({ _id: license.client, deletedAt: { $exists: false }}).select("publicLicenses").exec();

    if (!client || !client.publicLicenses) {
        throw new PermissionDeniedError();
    }

    return license;
}

/**
 * Create a new license. Will return its object id
 * @param name
 * @param text
 * @param shorttext
 * @param link
 * @param clientId
 * @returns {Promise<*>}
 */
exports.createLicense = async function(name, text, shorttext, link, clientId) {
    const License = mongoose.model('License');
    const license = new License({
        name: name,
        text: text,
        shorttext: shorttext,
        link: link,
        client: clientId
    });
    await license.save();
    return license._id;
}

/**
 * Update a license
 * @param id
 * @param name
 * @param text
 * @param clientId
 * @returns {Promise<void>}
 */
exports.updateLicense = async function(id, name, text, shorttext, link, clientId) {
    const License = mongoose.model('License');
    await License.updateOne({ _id: id, client: clientId, deletedAt: { $exists: false } }, {
        name: name,
        text: text,
        shorttext: shorttext,
        link: link
    });
}

/**
 * Delete a license
 * @param id
 * @param clientId
 * @returns {Promise<void>}
 */
exports.deleteLicense = async function(id, clientId) {
    const License = mongoose.model('License');
    await License.updateOne({ _id: id, client: clientId, deletedAt: { $exists: false } }, { deletedAt: new Date() });
}


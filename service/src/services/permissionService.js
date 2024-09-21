"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const model                 = require('@mindcraftgmbh/nukleus-model');
const mongoose              = model.mongoose;
const { ValidationError }   = require('../exception');

/**
 * Retrieves a list of all permissions
 * @returns {Promise<*>}
 */
exports.getPermissionsList = async function() {
    const Permission = mongoose.model('Permission');
    const permissions = await Permission.find().exec();
    return permissions;
}

/**
 * Retrieves a map with permission name mapped to permission
 * @returns {Promise<Map<any, any>>}
 */
exports.getPermissionsMap = async function() {
    const list = await exports.getPermissionsList();
    const map = new Map();
    for (const p of list) {
        map.set(p.name, p);
    }
    return map;
}

/**
 * Checks whether the list of permissions is valid and exists.
 * If userMayAssign is not null, this user will be used to check if the permissions
 * may be assigned by this user.
 * @param permissions
 * @param userMayAssign
 * @param oldPermissions the set of permissions, the user had before to check what is actually added
 */
exports.verifyPermissions = async function(permissions, userMayAssign, oldPermissions) {

    if (!Array.isArray(permissions)) {
        return;
    }

    const pmap = await exports.getPermissionsMap();

    for (const p of permissions) {
        if (typeof p !== "string")
            throw new ValidationError("Permissions needs to be an array of strings");

        if (!pmap.has(p))
            throw new ValidationError(`Permission does not exist: ${p}`);

        if (oldPermissions && oldPermissions.includes(p)) {
            // user had this permission previously, so no problem
            continue;
        }

        if (userMayAssign && !userMayAssign.hasPermissions([p]))
            throw new ValidationError(`Cannot assign ${p} permission without having it`);
    }
}

/**
 * Adds any missing permissions
 * @param permissions
 * @returns {Promise<void>}
 */
exports.addPermissions = async function(permissions) {
    const Permission = mongoose.model('Permission');

    for (const permission of permissions) {
        let p = await Permission.find({ name: permission.name }).exec();
        if (!p) {
            p = new Permission({
                name: permission.name,
                description: permission.description
            });

            await p.save();
        }
    }
}

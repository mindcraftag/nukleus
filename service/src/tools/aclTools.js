"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose      = require('@mindcraftgmbh/nukleus-model').mongoose;
const model         = require('@mindcraftgmbh/nukleus-model');
const userService   = require('../services/userService');
const groupService  = require('../services/groupService');

const CAN_ENTRIES = ["read", "write", "publish"];
const PRIORITY = {
    USER: 0,
    GROUP: 1,
    EVERYONE: 2,
    NONE: 3
};

exports.filterCanEntries = function(entries) {
    const result = [];

    if (!Array.isArray(entries))
        throw "ACL can entries are not an array!";

    for (const entry of entries) {
        if (CAN_ENTRIES.includes(entry)) {
            result.push(entry);
        } else {
            throw "ACL can entries have invalid value: " + entry;
        }
    }

    return result;
}

/**
 * Merge one ACL into another.
 * @param baseAcl
 * @param mergeAcl
 * @returns {*}
 */
exports.mergeAcl = function(baseAcl, mergeAcl) {

    let resultAcl = [];

    // check if we have anything to merge, if not just return a clone of the baseAcl
    // -----------------------------------------------------------------------------
    if (!Array.isArray(mergeAcl)) {
        if (!baseAcl)
            return null;

        for (const acl of baseAcl)
            pushResult(acl, 0);

        return resultAcl;
    }

    // Count non-fallback ACL entries. If we have any, we strip all fallback entries
    // -----------------------------------------------------------------------------
    let nonFallbackEntries = 0;
    if (Array.isArray(baseAcl)) {
        for (const bacl of baseAcl) {
            if (bacl.source !== "Fallback")
                nonFallbackEntries++;
        }
    }
    if (Array.isArray(mergeAcl)) {
        for (const macl of mergeAcl) {
            if (macl.source !== "Fallback")
                nonFallbackEntries++;
        }
    }

    // Helper function to push result ACL
    // -----------------------------------------------------------------------------
    function pushResult(acl, defaultLevel) {
        if (typeof acl.toObject === 'function') {
            acl = acl.toObject();
            delete acl._id;
        }

        acl.level = acl.level === undefined ? defaultLevel : acl.level+1;

        resultAcl.push(acl);
    }

    // Copy baseAcl entries
    // -----------------------------------------------------------------------------
    let haveEveryoneEntry = false;
    let defaultLevel = 0;

    if (Array.isArray(baseAcl)) {
        for (const bacl of baseAcl) {
            if (bacl.source !== "Fallback" || nonFallbackEntries === 0)
                pushResult(bacl, defaultLevel);

            // check if we have an "everyone" entry. if that is the case, we do not need to merge any ACLs because
            // this one will override anything coming after it anyway.
            if (!bacl.user && !bacl.group)
                haveEveryoneEntry = true;
        }
    }

    // Copy mergeAcl entries
    // -----------------------------------------------------------------------------
    if (Array.isArray(mergeAcl) && !haveEveryoneEntry) {

        if (resultAcl.length)
            defaultLevel++;

        for (const macl of mergeAcl) {

            // The fallback ACL is only used if there are absolutely no other ACL entries
            if (macl.source === "Fallback" && nonFallbackEntries > 0)
                continue;

            // We merge any ACL entries for which there is not already an entry
            let found = false;
            for (const racl of resultAcl) {
                if ((macl.user === racl.user && macl.group === racl.group) ||
                    (macl.user && macl.user.equals(racl.user)) ||
                    (macl.group && macl.group.equals(racl.group))) {
                    found = true;
                    break;
                }
            }
            if (!found)
                pushResult(macl, defaultLevel);
        }
    }

    return resultAcl;
}

/**
 * Get the ACL for an array of elements.
 * @param elements
 * @returns {Promise<void>}
 */
exports.getAclForAll = async function(elements) {
    for (const element of elements) {
        element.resultingAcl = await exports.getAclFor(element);
    }
}

/**
 * Get the ACL for an element. An element can be either an item or a folder.
 * @param element
 * @returns {Promise<[{can: [String | StringConstructor], user: {ref: string, type: *}, group: {ref: string, type: *}}]|[{can: [String | StringConstructor], user: {ref: string, type: *}, group: {ref: string, type: *}}]|*|[]|*[]>}
 */
exports.getAclFor = async function(element) {
    const AclCache = model.mongoose.model("AclCache");

    const clientId = element.client;
    const query = {
        element: element._id
    }

    // If we can determine the type of the element, we use that in the query for the ACL cache.
    // (items have a folder, folders have a parent)
    if (element.folder !== undefined) {
        query.type = "item";
    } else if (typeof element.parent !== "function" && element.parent !== undefined) {
        query.type = "folder";
    } else {
        throw new Error("Element has neither folder nor parent. Cannot determine if it is a folder or item!");
    }

    let cacheElement = await AclCache.findOne(query);

    // Because we always create and update the ACL entries, this should never happen.
    // But we will still try to recover from the error by recalculation the ACL cache element.
    if (!cacheElement) {
        const Item = model.mongoose.model("Item");
        const Folder = model.mongoose.model("Folder");
        const Client = model.mongoose.model("Client");

        // We need to load the element data from the DB, because we can't rely on
        // the element object having all the fields we need in the updateAclCache function.
        let elementData = element;
        if (query.type === "item") {
            elementData = await Item.findOne({
                _id: query.element
            });
        } else if (query.element !== "0") {
            elementData = await Folder.findOne({
                _id: query.element
            });
        }

        let client = await Client.findOne({
            _id: clientId
        });
        await exports.updateAclCache(elementData, client.acl, query.type);
        cacheElement = await AclCache.findOne(query);

        if (!cacheElement) {
            throw new Error(`ACL cache not found for element ${elementData._id}!`);
        }
    }

    const aclArray = [];
    for (const acl of cacheElement.acl) {
        // Turn the acl into a plain object and remove the _id field.
        const aclObject = acl.toObject();
        delete aclObject._id;

        aclArray.push(aclObject);
    }

    return aclArray;
}

/**
 * Calculate the ACL for an element. If the element itself has no ALC information, the parent is checked
 * recursively until something is found. If nothing is found, an empty array is returned.
 *
 * It uses the AclCache for parent items!
 *
 * @param element
 * @param baseAcl
 * @param aclCache optional cache Map to save queries to DB
 * @returns {Promise<[{can: [String | StringConstructor], user: {ref: string, type: *}, group: {ref: string, type: *}}]|[{can: [String | StringConstructor], user: {ref: string, type: *}, group: {ref: string, type: *}}]|*|[]|*[]>}
 */
exports.calculateAclFor = async function(element, baseAcl, aclCache) {

    if (!element.client)
        throw "Element.client is not defined! Cannot get ACL";

    // Sometimes we want to call this method on the root folder. But because it's not
    // a real folder  we need a special case for elements with _id == null.
    const elementIdStr = element._id !== null ? element._id.toString() : element._id;
    if (aclCache && aclCache.has(elementIdStr)) {
        return aclCache.get(elementIdStr);
    }

    let acl = [];

    if (element.acl && element.acl.length > 0) {
        for (const aclEntry of element.acl) {
            acl.push({
                user: aclEntry.user,
                group: aclEntry.group,
                can: aclEntry.can.clone(),
                source: element.name
            });
        }
    }

    const parent = element.folder || (typeof element.parent === 'function' ? undefined : element.parent);
    let parentAcl = [];

    if (!parent) {
        // We have not found any ACL entries. Use the base ACL of the client
        // if we have it.
        if (Array.isArray(baseAcl) && baseAcl.length > 0) {
            for (const aclEntry of baseAcl) {
                parentAcl.push({
                    user: aclEntry.user,
                    group: aclEntry.group,
                    can: aclEntry.can.clone(),
                    source: "Base"
                });
            }
        } else {
            // We have no base ACL. Use the fallback ACL of "everybody can do anything"
            parentAcl.push({
                user: null,
                group: null,
                can: ["read", "write", "publish"],
                source: 'Fallback'
            });
        }
    } else {
        const Folder = mongoose.model("Folder");
        const folder = await Folder.findOne({
            _id: parent,
            deletedAt: {$exists: false},
            client: element.client
        }).select("acl name parent client").exec();

        if (!folder)
            throw "Could not load folder! Cannot get ACL";

        parentAcl = await exports.getAclFor(folder);
    }

    acl = exports.mergeAcl(acl, parentAcl);

    if (aclCache)
        aclCache.set(elementIdStr, acl);

    return acl;
}

/**
 * Retrieve the ACL information for an item within a specified client
 * @param itemId
 * @param client
 * @returns {Promise<*|[]>}
 */
exports.getAclForItemId = async function(itemId, client) {
    const Item = mongoose.model("Item");
    const item = await Item.findOne({
        _id: itemId,
        deletedAt: { $exists: false },
        client: client
    }).select("acl folder client").exec();

    if (!item)
        throw "Item not found!";

    return exports.getAclFor(item);
}

/**
 * Retrieve the ACL information for a folder within a specified client
 * @param folderId
 * @param client
 * @param baseAcl
 * @param aclCache optional cache Map to save queries to DB
 * @returns {Promise<*|[]>}
 */
exports.getAclForFolderId = async function(folderId, client, aclCache) {
    const folderIdStr = folderId.toString();
    if (aclCache && aclCache.has(folderIdStr))
        return aclCache.get(folderIdStr);

    const Folder = mongoose.model("Folder");
    const folder = await Folder.findOne({
        _id: folderId,
        deletedAt: { $exists: false },
        client: client
    }).select("acl parent client").exec();

    if (!folder)
        throw `Folder ${folderId} not found in client ${client}!`;

    const acl = exports.getAclFor(folder);

    if (aclCache)
        aclCache.set(folderIdStr, acl);

    return acl;
}

/**
 * Verify if the user has access to the file and can perform the specified action
 * @param item
 * @param user
 * @param action can be "read", "write" or "publish"
 * @returns {boolean}
 */
exports.verifyAcl = function(acls, user, action) {

    if (user.isAdmin())
        return true;

    if (!Array.isArray(acls))
        throw "No ACL information in item";

    if (acls.length === 0)
        return true;

    let result = false;
    let priority = PRIORITY.NONE;

    // We will go through all ACL entries from top to bottom. They're ordered by hierarchy top-down so
    // the top entries are more important than the bottom ones.
    for (const acl of acls) {

        // If we find an entry specifically for our user, no need to go on searching, this one counts for us. Just return the result
        if (acl.user && acl.user.toString() === user._id.toString()) {
            return acl.can.includes(action);
        }

        // If we hit a group entry valid for one of our groups, save the result if it is positive or we have no previously saved result.
        // It does not matter if this result is negative, keep searching, we might find other positive results that grant us the permission
        else if (acl.group && user.activeGroups.includes(acl.group.toString())) {
            const r = acl.can.includes(action);
            if (r || priority === PRIORITY.NONE) {
                result = r;
                priority = PRIORITY.GROUP;
            }
        }

        // If we hit an everyone entry, check it only if we do NOT already have a higher prioritized result, which would be from a group.
        else if (!acl.user && !acl.group && priority >= PRIORITY.EVERYONE) {
            const r = acl.can.includes(action);
            if (r || priority === PRIORITY.NONE) {
                result = r;
                priority = PRIORITY.EVERYONE;
            }
        }
    }

    return result;
}

/**
 * Verify if the user has access to the file and can perform the specified action.
 * ACL information is written to item.resultingAcl
 * @param item
 * @param user
 * @param action can be "read", "write" or "publish"
 * @param recursive true, if ACLs should be checked further down. Elements further down will only be "read" checked and their resultingAcl stored
 * @returns {Promise<boolean>}
 */
exports.verifyAndGetAclFor = async function(element, user, action, recursive) {
    const resultingAcl = await exports.getAclFor(element);
    element.resultingAcl = resultingAcl;
    const result = exports.verifyAcl(resultingAcl, user, action);

    if (result && recursive && Array.isArray(element.links)) {
        for (const link of element.links) {
            if (link.item) {
                if (!await exports.verifyAndGetAclFor(link.item, user, "read", true))
                    link.item = undefined;
            }
        }
    }

    return result;
}

/**
 * Verify if the user has access to the folder and can perform the specified action
 * @param folderId
 * @param user
 * @param action
 * @returns {Promise<boolean>}
 */
exports.verifyAndGetAclForFolderId = async function(folderId, user, action) {
    if (user.isAdmin()) {
        return true;
    }

    if (!user.client)
        throw "Cannot get ACL. Folder client is not set!";

    let resultingAcl;

    if (folderId) {
        resultingAcl = await exports.getAclForFolderId(folderId, user.client);
    } else if (user.clientAcl) {
        // For compatability with the webapi, we'll use the clientAcl if it is defined.
        resultingAcl = user.clientAcl;
    } else {
        // Otherwise we need to load the client ACL from the DB.
        const Client = mongoose.model('Client');
        const client = await Client.findOne({ _id: user.client }).select("acl").exec();
        resultingAcl = client.acl;
    }

    return exports.verifyAcl(resultingAcl, user, action);
}

/**
 * Filter all elements (items or folders) so only the ones are returned
 * that the user may access using the specified action
 * @param elements
 * @param user
 * @param action
 * @returns {Promise<void>}
 */
exports.filterElements = async function(elements, user, action, injectAllowWriteAndPublish) {

    if (user.isAdmin()) {
        if (injectAllowWriteAndPublish) {
            for (let element of elements) {
                element.allowWrite = true;
                element.allowPublish = true;
            }
        }
        return elements;
    }

    const aclCache = new Map();
    const result = [];

    const promises = [];

    for (const element of elements) {

        if (!element.acl) {
            throw "ACL information missing in Element!";
        }

        promises.push(new Promise(async (resolve, reject) => {
            const parent = element.folder || (typeof element.parent === 'function' ? undefined : element.parent);
            let parentAcl = [];

            if (parent) {
                parentAcl = await exports.getAclForFolderId(parent, user.client, aclCache);
            } else {
                parentAcl = user.clientAcl;
            }

            const resultingAcl = exports.mergeAcl(element.acl, parentAcl);
            if (!resultingAcl.length) {
                if (injectAllowWriteAndPublish) {
                    element.allowWrite = true;
                    element.allowPublish = true;
                }
                result.push(element);
            } else {
                if (exports.verifyAcl(resultingAcl, user, action)) {
                    if (injectAllowWriteAndPublish) {
                        element.allowWrite = (action === "write") ? true : exports.verifyAcl(resultingAcl, user, "write");
                        element.allowPublish = (action === "publish") ? true : exports.verifyAcl(resultingAcl, user, "publish");
                    }
                    result.push(element);
                }
            }

            resolve();
        }));
    }

    await Promise.all(promises);

    return result;
}

/**
 * Get the matching acl entriy for user and group from the acls list
 * @param acls
 * @param user
 * @param group
 */
exports.getAclEntry = function(acls, user, group) {
    const userStr = user ? user.toString() : "";
    const groupStr = group ? group.toString() : "";

    for (const acl of acls) {
        if (!acl.user && !user && !acl.group && !group)
            return acl;

        if (acl.user && user && acl.user.toString() === userStr)
            return acl;

        if (acl.group && group && acl.group.toString() === groupStr)
            return acl;
    }

    return null;
}

/**
 * Change an element's acl data with new user input. Also verify if that input was legal for the user to do
 * @param element
 * @param newAcl
 * @param user
 */
exports.changeAcl = async function(element, newAcl, user) {

    let mayPublish = false;
    if (!user.isAdmin())
        mayPublish = await exports.verifyAndGetAclFor(element, user, "publish");

    // Create new ACL array
    // ------------------------------------------------------------------------------------------------
    const verifiedAcl = [];
    for (const acl of newAcl) {

        // check if this entry is redundant. only one entry per user/group combination is allowed
        if (exports.getAclEntry(verifiedAcl, acl.user, acl.group)) {
            throw "ACL list contains redundant entries. Only one entry per user/group combination is allowed!";
        }

        verifiedAcl.push({
            user: acl.user ? new mongoose.Types.ObjectId(acl.user) : null,
            group: acl.user ? null : (acl.group ? new mongoose.Types.ObjectId(acl.group) : null),
            can: exports.filterCanEntries(acl.can)
        });
    }

    // Now verify if the user has not given anyone the publish permission without having it
    // ------------------------------------------------------------------------------------------------
    if (!user.isAdmin() && !mayPublish) {
        for (const vacl of verifiedAcl) {
            if (vacl.can.includes("publish")) {
                const acl = exports.getAclEntry(element.acl, vacl.user, vacl.group);
                if (!acl || !acl.can.includes("publish"))
                    throw "You may not assign anybody publish right without having it."
            }
        }
    }

    // Write results to element
    // ------------------------------------------------------------------------------------------------
    element.acl = [];
    for (const acl of verifiedAcl) {
        element.acl.push(acl);
    }
}

/**
 * Checks if two ACL entries are for the same user/group combination
 * @param entry1
 * @param entry2
 */
exports.areEntriesForSameTargetGroup = function(entry1, entry2) {
    let userMatches = (!entry1.user && !entry2.user) ||
        (entry1.user && entry2.user && entry1.user.toString() === entry2.user.toString());

    let groupMatches = (!entry1.group && !entry2.group) ||
        (entry1.group && entry2.group && entry1.group.toString() === entry2.group.toString());

    return userMatches && groupMatches;
}

/**
 * Filters out any redundant entries from acls
 * @param element
 */
exports.filterRedundantAclEntries = function(element) {
    element.acl = element.acl.filter((entry, index, array) => {
        for (let i=0; i<index; i++) {
            if (exports.areEntriesForSameTargetGroup(entry, array[i])) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Adds a new element to ACL list, also filters the list for redundant entries.
 * If an entry for this user/group exists already, it is changed to match the newAcl.can entries
 * @param element
 * @param newAcl
 */
exports.addAcl = function(element, newAcl) {
    exports.filterRedundantAclEntries(element);

    for (const entry of element.acl) {
        if (exports.areEntriesForSameTargetGroup(entry, newAcl)) {
            entry.can = newAcl.can;
            return;
        }
    }

    element.acl.push(newAcl);
}

/**
 * Filter a list of Folder IDs by if the user may execute the desired action (read, write or publish) on or not.
 * Returned is the list of Items, the user has the permissions on
 * @param elementIds
 * @param user
 * @param clientId
 * @param action
 * @returns {Promise<*>}
 */
exports.filterFolderIds = async function(elementIds, user, clientId, action) {
    const Folder = mongoose.model('Folder');
    const folders = await Folder.find({ _id: elementIds, client: clientId, deletedAt: { $exists: false } }).select("acl parent").exec();

    const filteredFolders = await exports.filterElements(folders, user, action, false);

    return filteredFolders.map(x => x._id);
}

/**
 * Filter a list of Item IDs by if the user may execute the desired action (read, write or publish) on or not.
 * Returned is the list of Items, the user has the permissions on
 * @param elementIds
 * @param user
 * @param clientId
 * @param action
 * @returns {Promise<*>}
 */
exports.filterItemIds = async function(elementIds, user, clientId, action) {
    const Item = mongoose.model('Item');
    const items = await Item.find({ _id: elementIds, client: clientId, deletedAt: { $exists: false } }).select("acl folder").exec();

    const filteredItems = await exports.filterElements(items, user, action, false);

    return filteredItems.map(x => x._id);
}

/**
 * Checks if all user/group entries in the ACLs are existing and filters them out if not. Also checks the general format of the acl entries
 * @param aclEntries
 * @param clientId
 * @return {Promise<[]>}
 */
exports.checkAclEntriesValidity = async function(aclEntries, clientId) {
    if (!Array.isArray(aclEntries))
        return [];

    const results = [];

    for (const acl of aclEntries) {
        try {
            if (acl.user && !await userService.existsUser(acl.user, clientId))
                continue;

            if (acl.group && !await groupService.existsGroup(acl.group, clientId))
                continue;

            results.push({
                user: acl.user,
                group: acl.group,
                can: exports.filterCanEntries(acl.can)
            });
        }
        catch(err) {
            // filter out the entry in case there was an error (most probably due to invalid can entries
        }
    }

    return results;
}

/**
 * Helper function to get the ACL of a client.
 * @param {string | ObjectID | Client} clientOrId can be either the ID (string or ObjectID) or the client object itself
 */
exports.getClientAcl = async function(clientOrId) {
    const Client = mongoose.model('Client');
    const client = await Client.findOne({
        _id: clientOrId._id ? clientOrId._id : clientOrId
    });

    return client.acl;
}

/**
 * Update the ACL cache for a given element.
 * @param {Item | Folder} element the element in question, can be an item or a folder
 * @param {*} clientAcl the ACL of the client in which the element is located
 * @param {"item" | "folder"} type the type of the element
 */
exports.updateAclCache = async function(element, clientAcl, type) {
    const AclCache = model.mongoose.model('AclCache');
    const Item = model.mongoose.model('Item');
    const Folder = model.mongoose.model('Folder');

    const resultingAcl = await exports.calculateAclFor(element, clientAcl);

    await AclCache.findOneAndUpdate({
        element: element._id,
        type: type
    }, {
        element: element._id,
        type: type,
        acl: resultingAcl
    }, {
        upsert: true
    });

    // To speed up the calculation and because the calculateAclFor function uses the getAclFor functio (which in turn uses the AclCache),
    // we need to make sure that we calculate the ACLs top-down. First for the parent, then for the children, because the ACL for the parents
    // will be taken from the ACL cache.
    if (type === "folder" && element._id !== "0") {
        const subfolders = await Folder.find({
            parent: element._id,
            client: element.client,
            deletedAt: { $exists: false },
        });

        const items = await Item.find({
            folder: element._id,
            client: element.client,
            deletedAt: { $exists: false },
        });

        for (const subfolder of subfolders) {
            await exports.updateAclCache(subfolder, clientAcl, "folder");
        }

        for (const item of items) {
            await exports.updateAclCache(item, clientAcl, "item");
        }
    }
}

/**
 * Initialize the ACL cache for all clients.
 */
exports.initializeAclCache = async function () {
    const Client = model.mongoose.model('Client');
    const clients = await Client.find({});

    // Go over the root folder of every client and from there calculate the ACLs for all subfolders and items.
    for (const client of clients) {
        await exports.updateAclCache({_id: null, parent: null, client: client._id}, client.acl, "folder");
    }
}

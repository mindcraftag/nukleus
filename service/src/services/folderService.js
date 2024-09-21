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
const aclTools          = require('../tools/aclTools');
const verify            = require("../tools/verify");
const itemService       = require('./itemService');
const config            = require('../config');
const moment            = require('moment');
const {
    ValidationError,
    PermissionDeniedError,
} = require('../exception');
const { getSingleItemOfTypeOrNameInFolder } = require('./itemService');
const { ensureExactFieldsInObject } = require('../common');
const { parseItemsPerPage } = require('../tools/paging');

/**
 * Checks if the folder exists by its ID and client ID
 * @param id
 * @param clientId
 * @return {Promise<*>}
 */
exports.existsFolder = async function(id, clientId) {
    const Folder = mongoose.model('Folder');
    return Folder.existsByIdAndClient(id, clientId);
}

/**
 * Checks if the name is already taken inside a folder by another folder or item.
 * @param name name to be checked
 * @param folderId in which folder to check
 * @param client the client to use
 * @param fixNameCollisions if set to true, the function will try to find a name by appending an index that is not taken
 * @returns {Promise<{finalName: string, conflict: *}>}
 */
exports.isNameConflict = async function(name, folderId, client, fixNameCollisions) {
    const Item = mongoose.model('Item');
    const Folder = mongoose.model('Folder');

    let finalName = name;
    let count = 1;
    let conflict = false;
    do {
        conflict = await Item.existsByNameFolderAndClient(finalName, folderId, client);
        if (!conflict) {
            conflict = await Folder.existsByNameFolderAndClient(finalName, folderId, client);
        }

        if (conflict && fixNameCollisions) {
            finalName = `${name} (${count})`;
            count++;
        }
    } while(conflict && count < 1000 && fixNameCollisions);

    return { conflict, finalName };
};

/**
 * Checks if a folder exists and returns its ID
 * @param name
 * @param folderId
 * @param client
 * @return {Promise<void>}
 */
exports.getFolderId = async function(name, parentFolderId, client) {
    const Folder = mongoose.model('Folder');
    const folder = await Folder.findOne({ name: name, parent: parentFolderId, client: client, deletedAt: { $exists: false } }).select("_id").exec();
    return folder ? folder._id : null;
}

/**
 * Create a new folder. If it exists already, a validation error is thrown.
 * @param name
 * @param parentFolderId
 * @param client
 * @param location
 * @return {Promise<*>}
 */
exports.createFolder = async function(name, parentFolderId, client, location) {

    const check = await exports.isNameConflict(name, parentFolderId, client, false);
    if (check.conflict) {
        throw new ValidationError('The folder already exists.');
    }

    const Folder = mongoose.model('Folder');
    const folder = await Folder.create({ name: name, parent: parentFolderId, client: client, location: location });
    return folder;
}

/**
 * Traverse a folder hierarchy and writes their folder paths into the map, mapping folder ID to path
 * @param map the map to fill
 * @param folder the folder to set in the map
 * @param path the current path to this folder
 */
exports.traverseFoldersHierarchyToPathMap = function(map, folder, path) {
    path = path || "";

    let folderPath = path + folder.name;
    if (!folderPath.endsWith("/"))
        folderPath += "/";

    map.set(folder._id ? folder._id.toString() : "0", folderPath);

    for (const child of folder.children) {
        exports.traverseFoldersHierarchyToPathMap(map, child, folderPath);
    }
}

/**
 * Create a map that maps all folder IDs to their full paths
 * @param client the client to use
 * @param user the user that is requesting this
 * @returns {Promise<Map<any, any>>}
 */
exports.createFolderPathMap = async function(client, user) {
    const folder = await exports.createAllFoldersHierarchy(client, user);
    const map = new Map();
    exports.traverseFoldersHierarchyToPathMap(map, folder);
    return map;
}

/**
 * Create a map that maps all folderIDs to their full paths. Only the passed folder's are recursively traversed
 * and the folders of the provided item IDs.
 * @param folderIds
 * @param itemIds
 * @param client
 * @return {Promise<Map<any, any>>}
 */
exports.createFolderPathMapExact = async function(folderIds, itemIds, client) {

    const Folder = mongoose.model('Folder');

    // First get a map of all folder IDs that we need to traverse
    // ---------------------------------------------------------------
    const rootFolders = [];
    const folderIdPathMap = new Map();
    const folderIdMap = new Map();
    const foldersByParentMap = new Map();
    const foldersForItems = await itemService.getFoldersForItems(itemIds, client);

    for (const folderId of folderIds) {
        folderIdMap.set(folderId.toString(), folderId);
    }

    for (const folderId of foldersForItems) {
        folderIdMap.set(folderId.toString(), folderId);
    }

    // Define a functions that do the traversal
    // ---------------------------------------------------------------
    function pushFolderByParent(folder) {
        const parentId = folder.parent ? folder.parent.toString() : null;

        let list;
        if (foldersByParentMap.has(parentId))
            list = foldersByParentMap.get(parentId)
        else {
            list = [];
            foldersByParentMap.set(parentId, list);
        }

        list.push(folder);
    }

    async function processFolderDown(folderId) {
        const folders = await Folder.find({ parent: folderId, client: client }).select("name parent").exec();

        for (const folder of folders) {
            const folderIdStr = folder._id.toString();
            if (folderIdMap.has(folderIdStr))
                continue;

            folderIdMap.set(folderIdStr, folder);
            pushFolderByParent(folder);
            await processFolderDown(folder._id);
        }
    }

    async function processFolderUp(folderId) {
        const folder = await Folder.findOne({ _id: folderId, client: client }).select("name parent").exec();
        if (folder) {
            const folderIdStr = folderId.toString();
            if (folderIdMap.has(folderIdStr))
                return;

            folderIdMap.set(folderIdStr, folder);
            pushFolderByParent(folder);
            if (folder.parent)
                await processFolderUp(folder.parent);
            else
                rootFolders.push(folder);
        }
    }

    function traverseFolder(folder, parentPath) {
        const path = `${parentPath}${folder.name}/`;
        folderIdPathMap.set(folder._id.toString(), path);

        const childFolders = foldersByParentMap.get(folder._id.toString());
        if (childFolders) {
            for (const childFolder of childFolders) {
                traverseFolder(childFolder, path);
            }
        }
    }

    // Now iterate through our folder IDs and process them one by one
    // ---------------------------------------------------------------
    const initialFolderIds = Array.from(folderIdMap.values());
    folderIdMap.clear();

    for (const folderId of initialFolderIds) {
        await processFolderDown(folderId);
        await processFolderUp(folderId);
    }

    // now that we have all folders, traverse the folders to create the paths
    // ---------------------------------------------------------------
    for (const folder of rootFolders) {
        traverseFolder(folder, "/");
    }

    return folderIdPathMap;
}

/**
 * Create a hierarchy of all folders of a client
 * @param client the client to use
 * @param user the user that requested this
 * @param resolveUserFolderNames true, if the user folder names should be resolved
 * @returns {Promise<{children: *[], name: (*|string), _id: (*|null), resolvedName: (*|null|undefined)}>}
 */
exports.createAllFoldersHierarchy = async function(client, user, resolveUserFolderNames) {

    let query = {
        client: client,
        deletedAt: { $exists: false }
    };

    if (!user.superadmin) {
        query["$or"] = [
            { hidden: { $exists: false } },
            { hidden: null },
            { hidden: false }
        ]
    }

    const Folder = mongoose.model('Folder');
    let folders = await Folder.find(query).sort("name").exec();

    if (user) {
        folders = await aclTools.filterElements(folders, user, "read", false);
    }

    folders = folders.map(x => {
        return {
            _id: x._id,
            name: x.name,
            parent: x.parent
        }
    });

    if (resolveUserFolderNames) {
        for (const folder of folders) {
            await exports.resolveUserOrGroupFolderName(folder);
        }
    }

    return await exports.createFoldersHierarchy(folders, undefined, false);
};

/**
 * Creates a hierarchy of folders below the specified folder id
 * @param id the folder id that should be the root
 * @param client the client to use
 * @param user the user that requested this
 * @param requiredPermission the required permissions for this action to filter by
 * @param noImmutable optional parameter, if set to true, function with throw exception if a folder is immutable
 * @returns {Promise<{children: *[], name: (*|string), _id: (*|null), resolvedName: (*|null|undefined)}|null>}
 */
exports.createSubFoldersHierarchy = async function(id, client, user, requiredPermission, noImmutable) {

    let query = {
        client: client,
        deletedAt: { $exists: false }
    };

    const Folder = mongoose.model('Folder');
    let folders = await Folder.find(query).sort("name").exec();

    for (const folder of folders) {
        if (folder._id.equals(id)) {
            return await exports.createFoldersHierarchy(folders, folder, noImmutable, user, requiredPermission);
        }
    }

    return null;
};

/**
 * If the folder's name is a valid mongo ID, it will try to find a user that matches it and set the name/originalName property
 * to the user's name
 * @param folder the folder to process
 * @returns {Promise<void>}
 */
exports.resolveUserFolderName = async function(folder) {
    const User = mongoose.model("User");
    folder.originalName = null;
    if (folder.name && folder.name.length === 24) {
        try {
            const userId = verify.toObjectId(folder.name);
            const user = await User.findOne({ _id: userId }).select("name").exec();
            if (user) {
                folder.originalName = folder.name;
                folder.name = user.name;
            }
        }
        catch(err) {}
    }
}

/**
 * If the folder's name is a valid mongo ID, it will try to find a group that matches it and set name/originalName property
 * to the groups's name
 * @param folder the folder to process
 * @returns {Promise<void>}
 */
exports.resolveGroupFolderName = async function(folder) {
    const Group = mongoose.model("Group");
    folder.originalName = null;
    if (folder.name && folder.name.length === 24) {
        try {
            const groupId = verify.toObjectId(folder.name);
            const user = await Group.findOne({ _id: groupId }).select("name").exec();
            if (user) {
                folder.originalName = folder.name;
                folder.name = user.name;
            }
        }
        catch(err) {}
    }
}

/**
 * If the folder's name is a valid mongo ID, it will try to find a user or group that matches it and set the name/originalName property
 * to the user's / group's name
 * @param folder the folder to process
 * @returns {Promise<void>}
 */
exports.resolveUserOrGroupFolderName = async function(folder) {
    const User = mongoose.model("User");
    const Group = mongoose.model("Group");
    folder.originalName = null;
    if (folder.name && folder.name.length === 24) {
        try {
            const id = verify.toObjectId(folder.name);
            const user = await User.findOne({ _id: id }).select("name").exec();
            if (user) {
                folder.originalName = folder.name;
                folder.name = user.name;
            } else {
                const group = await Group.findOne({ _id: id }).select("name").exec();
                if (group) {
                    folder.originalName = folder.name;
                    folder.name = group.name;
                }
            }
        }
        catch(err) {}
    }
}

/**
 * Create a hierarchy of folders out of the list of folders passed in, starting at currentFolder
 * @param folders the array of all possible folders
 * @param currentFolder the folder to start with as root
 * @param noImmutable no immutable files must be in the hierarchy, or an error must be throws
 * @poram user if an optional user is passed, it will be used to check permissions
 * @param requiredPermission required permissions on the folders. error will be thrown if permission is not present
 * @returns {{children: *[], name: (*|string), _id: (*|null), resolvedName: (null|*|undefined)}}
 */
exports.createFoldersHierarchy = async function(folders, currentFolder, noImmutable, user, requiredPermission) {

    if (noImmutable === true && currentFolder.immutable) {
        throw new PermissionDeniedError("At least one folder is immutable!");
    }

    if (user && requiredPermission) {
        if (!await aclTools.verifyAndGetAclForFolderId(currentFolder._id, user, requiredPermission)) {
            throw new PermissionDeniedError("Missing permission on at least one folder.");
        }
    }

    const currentFolderId = currentFolder ? currentFolder._id.toString() : null;
    const node = {
        name: currentFolder ? currentFolder.name : "/",
        resolvedName: currentFolder ? currentFolder.resolvedName : undefined,
        _id: currentFolder ? currentFolder._id : null,
        children: []
    };

    for (const folder of folders) {
        const folderParentId = folder.parent ? folder.parent.toString() : null;
        if (folderParentId === currentFolderId) {
            node.children.push(await exports.createFoldersHierarchy(folders, folder, noImmutable, user, requiredPermission));
        }
    }

    return node;
};

/**
 * Recursively delete a folder.
 * @param id the folder id
 * @param client the client to use
 * @param user the user that will execute the deletion
 * @returns {Promise<void>}
 */
exports.recursiveDelete = async function(id, client, user, noImmutable) {

    // Build a hierarchy of all folders that sit below the requested folder
    // ---------------------------------------------------------------------------------
    const hierarchy = await exports.createSubFoldersHierarchy(id, client, user, "write", noImmutable);
    if (!hierarchy) {
        // folder not found. nothing to do.
        return;
    }

    // get a list of all items and folders to delete
    // ---------------------------------------------------------------------------------
    const itemIds = [];
    const folderIds = [];
    await exports.recursiveEnumerateFolder(hierarchy, folderIds, itemIds, client, user, "write");

    // delete all items that were found
    // ---------------------------------------------------------------------------------
    if (itemIds.length) {
        const Item = mongoose.model('Item');
        await Item.updateMany({
            _id: itemIds,
            client: client,
            deletedAt: { $exists: false }
        }, {
            updatedBy: user._id,
            deletedAt: new Date()
        }, {
            __user: user._id
        }).exec();
    }

    // Again get a list of all items and folders, but this time with admin permissions, to see if any items
    // in the structure are left which prohibit us from deleting folders
    // ---------------------------------------------------------------------------------
    const adminItemIds = [];
    const adminFolderIds = [];
    await exports.recursiveEnumerateFolder(hierarchy, adminFolderIds, adminItemIds, client);

    // If only a single item was found, we cannot delete the folder structure, there are items in there which
    // the user cannot see and which block folder deletion
    // ---------------------------------------------------------------------------------
    if (adminItemIds.length) {
        throw new ValidationError("Cannot delete folder structure recursively. There are still items in it that cannot be deleted.");
    }

    // Compare the found folders with the originally found folders. If they differ, do not delete the folders
    // ---------------------------------------------------------------------------------
    if (adminFolderIds.length !== folderIds.length) {
        throw new ValidationError("Cannot delete folder structure recursively. There are still folders in it that cannot be deleted.");
    }

    for (const adminFolderId of adminFolderIds) {
        if (!folderIds.includes(adminFolderId)) {
            throw new ValidationError("Cannot delete folder structure recursively. There are still folders in it that cannot be deleted.");
        }
    }

    // delete all folders now and mark parent folder to recalculate its size
    // ---------------------------------------------------------------------------------
    const Folder = mongoose.model('Folder');

    const rootFolder = await Folder.findOne({
        _id: id,
        client: client,
        deletedAt: { $exists: false }
    }).select("parent").exec();

    const result = await Folder.updateMany({
        _id: folderIds,
        client: client,
        deletedAt: { $exists: false }
    }, {
        updatedBy: user._id,
        deletedAt: new Date()
    }, {
        __user: user._id
    }).exec();

    if (rootFolder.parent) {
        await Folder.updateMany({
            _id: rootFolder.parent
        }, {
            $set: {
                recalculateContentSize: true
            }
        });
    }

    return result.modifiedCount;
};

exports.recursiveEnumerateFolder = async function(node, folderIds, itemIds, client, user, requiredPermission) {

    // put this folder's id on the list
    // -----------------------------------------------------------------------
    folderIds.push(node._id);

    // get a list of all items in this folder and put them on the list
    // -----------------------------------------------------------------------
    const Item = mongoose.model('Item');
    let items = await Item.find({
        folder: node._id,
        client: client,
        deletedAt: { $exists: false }
    }).select('_id name acl folder').exec();

    if (user && requiredPermission) {
        items = await aclTools.filterElements(items, user, requiredPermission, false);
    }

    for (const item of items) {
        itemIds.push(item._id);
    }

    // recursively call this method with all child folders
    // -----------------------------------------------------------------------
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            await exports.recursiveEnumerateFolder(child, folderIds, itemIds, client, user, requiredPermission);
        }
    }
};

/**
 * Returns a list of item ids that are contained in the folder
 * @param folderId the folder id that should be searched
 * @param result optional result array that can be passed in
 * @param client the client that should be used
 * @param returnFullDocuments if true, full documents will be returned, not only IDs
 * @param resolvedFolders optional array that will receive all the folders
 * @param resolveFirstFolder if true, the initial folderId will also be resolved
 * @returns {Promise<*[]>}
 */
exports.getFolderItemsRecursive = async function(folderId, result, client, returnFullDocuments, resolvedFolders, resolveFirstFolder) {
    if (!result)
        result = [];

    // Resolve first folder
    // -----------------------------------------------------------------------
    const Folder = mongoose.model('Folder');
    if (resolveFirstFolder && resolvedFolders) {
        const firstFolderQuery = Folder.findOne({
            _id: folderId,
            client: client,
            deletedAt: { $exists: false }
        });

        if (!returnFullDocuments)
            firstFolderQuery.select('_id');

        const firstFolder = await firstFolderQuery.exec();
        if (!firstFolder)
            throw new ValidationError("Folder not found: " + folderId);

        resolvedFolders.push(firstFolder);
    }

    // Find all items in this folder and add them to the result
    // -----------------------------------------------------------------------
    const Item = mongoose.model('Item');
    const query = Item.find({
        folder: folderId,
        client: client,
        deletedAt: { $exists: false }
    });

    if (!returnFullDocuments)
        query.select('_id');

    const items = await query.exec();

    for (const item of items) {
        if (returnFullDocuments)
            result.push(item);
        else
            result.push(item._id);
    }

    // Find all subfolders and call this function recursively
    // -----------------------------------------------------------------------
    const folderQuery = Folder.find({
        parent: folderId,
        client: client,
        deletedAt: { $exists: false }
    });

    if (!returnFullDocuments) {
        folderQuery.select('_id');
    }

    const folders = await folderQuery.exec();

    for (const folder of folders) {
        if (resolvedFolders)
            resolvedFolders.push(folder);

        await exports.getFolderItemsRecursive(folder._id, result, client, returnFullDocuments, resolvedFolders, false);
    }

    return result;
};

/**
 * Returns a list of unique item ids that are contained in the list of folders. The folders are traversed recursively
 * @param folderIds an array of folder IDs that should be searched
 * @param client the client that should be used
 * @returns {Promise<any[]>}
 */
exports.getFoldersItemsRecursive = async function(folderIds, client) {
    const itemsMap = new Map();

    for (const folderId of folderIds) {
        const itemIds = await exports.getFolderItemsRecursive(folderId, undefined, client, false, undefined, false);
        for (const itemId of itemIds) {
            itemsMap.set(itemId, true);
        }
    }

    return Array.from(itemsMap.keys());
}

/**
 * Checks if one folder is located within the other
 * @param srcFolder the container folder
 * @param destFolder the folder being looked for
 * @param client the client that should be used
 * @returns {Promise<boolean>}
 */
exports.isFolderWithinFolder = async function(srcFolder, destFolder, client) {
    if (!destFolder)
        return false;

    if (srcFolder._id.equals(destFolder._id))
        return true;

    const Folder = mongoose.model('Folder');
    const subFolders = await Folder.find({
        parent: srcFolder._id,
        client: client,
        deletedAt: { $exists: false }
    }).select('_id').exec();

    for (const subFolder of subFolders) {
        const result = await exports.isFolderWithinFolder(subFolder, destFolder, client);
        if (result === true)
            return true;
    }

    return false;
}

exports.ensurePath = async function(clientId, parentId, folderPath, createByUserId) {

    const Folder = mongoose.model('Folder');
    let folder = await Folder.findOne({ _id: parentId, client: clientId, deletedAt: { $exists: false } }).exec();

    const parts = folderPath.split('/');

    // Step through each folder and create it if it does not exist.
    for (let part of parts) {
        part = part.trim();
        if (part.length && part !== '.') {
            // If folder is null, then we are creating a folder in the root folder.
            const parentFolderID = folder ? folder._id : null

            let childFolder = await Folder.findOne({ name: part, parent: parentFolderID, client: clientId, deletedAt: { $exists: false } }).exec();
            if (!childFolder) {
                // When creating a child folder, use the location of the parent folder.
                childFolder = new Folder({
                    name: part,
                    parent: parentFolderID,
                    location: folder ? folder.location : config.systemLocation,
                    client: clientId,
                    createdBy: createByUserId,
                    updatedBy: createByUserId
                });
                await childFolder.save();

                await aclTools.updateAclCache(childFolder, await aclTools.getClientAcl(clientId), "folder");
            }

            folder = childFolder;
        }
    }

    return folder;
}

/**
 * Ensure a folder exists within a client with a specified parent and name. If it does not exist, it will
 * create it using the specified user id.
 * @param clientId the client to use
 * @param parentId the parent of the folder
 * @param folderName the name of the folder
 * @param createByUserId the user id to create the folder with if necessary
 * @param hidden should the folder be hidden
 * @param immutable should the folder be immutable
 * @param hideSize should the folders size be hidden from normal users
 * @param location the location of the folder if it has to be created
 * @returns {Promise<Types.ObjectId>} the object id of the folder
 */
exports.ensureFolder = async function(clientId, parentId, folderName, createByUserId, hidden, immutable, hideSize, location) {
    const Folder = mongoose.model('Folder');

    // We don't query the location here because it does not identify the folder.
    const folder = await Folder.findOne({
        client: clientId,
        parent: parentId,
        name: folderName,
        deletedAt: { $exists: false }
    }).exec();

    if (folder) {
        let changed = false;

        if (hidden !== undefined && hidden !== folder.hidden) {
            folder.hidden = hidden;
            changed = true;
        }

        if (immutable !== undefined && immutable !== folder.immutable) {
            folder.immutable = immutable;
            changed = true;
        }

        if (hideSize !== undefined && hideSize !== folder.hideSize) {
            folder.hideSize = hideSize;
            changed = true;
        }

        if (changed)
            await folder.save();

        return folder._id;
    }

    const newFolder = new Folder({
        client: clientId,
        parent: parentId,
        name: folderName,
        location: location,
        hidden: hidden,
        immutable: immutable,
        hideSize: hideSize,
        createdBy: createByUserId,
        updatedBy: createByUserId
    });

    await newFolder.save();

    await aclTools.updateAclCache(newFolder, await aclTools.getClientAcl(clientId), "folder");
    return newFolder._id;
}

/**
 * Get the system folder id for a client. If the optional name is specified, it will return a folder with that name
 * just below the system folder if it exists. If not found, it will return null
 * @param clientId
 * @param name
 * @returns {Promise<Types.ObjectId>}
 */
exports.getSystemFolderId = async function(clientId, name) {
    const Folder = mongoose.model('Folder');

    const systemFolder = await Folder.findOne({
        client: clientId,
        parent: null,
        name: "System",
        deletedAt: { $exists: false }
    }).select("_id").exec();

    if (!systemFolder)
        return null;

    if (!name)
        return systemFolder._id;

    const folder = await Folder.findOne({
        client: clientId,
        parent: systemFolder._id,
        name: name,
        deletedAt: { $exists: false }
    }).select("_id").exec();

    if (!folder)
        return null;

    return folder._id;
};

/**
 * Get a list of all parent folders of a folder. The result array will start with the direct parent and work itself up the hierarchy
 * @param folderId
 * @param clientId
 * @returns {Promise<*[]>}
 */
exports.getFolderParents = async function(folderId, clientId) {
    const result = [];

    const Folder = mongoose.model('Folder');
    while(folderId) {
        const folder = await Folder.findOne({ _id: folderId, client: clientId, deletedAt: { $exists: false }}).exec();
        if (!folder) {
            throw `Folder not found: ${folderId.toString()}`;
        }
        result.push(folder);
        folderId = folder.parent;
    }

    return result;
}

/**
 * Marks a folder and all its parents as updated with a new current timestamp
 * @param folderId
 * @param clientId
 * @param [timestamp] optional timestamp. defaults to current date
 * @return {Promise<void>}
 */
exports.markFolderAndAllParentsUpdated = async function(folderId, clientId, timestamp) {
    timestamp = timestamp || new Date();
    const folders = await exports.getFolderParents(folderId, clientId);
    const Folder = mongoose.model('Folder');
    await Folder.updateMany({_id: folders}, { updatedAt: timestamp }, { timestamps: false });
}

/**
 * If the specified folder is somewhere below a user's home folder, return that user id, otherwise null
 * @param folderId the folder beeing looked for
 * @param clientId the client that should be used
 * @returns {Promise<null|*>} a user id or null
 */
exports.getFolderQuotaUser = async function(folderId, clientId) {
    const folders = await exports.getFolderParents(folderId, clientId);
    if (folders.length >= 2 && folders[folders.length-1].name === "Users") {
        const userFolderName = folders[folders.length-2].name;

        try {
            return new mongoose.Types.ObjectId(userFolderName);
        }
        catch(err) {
            // folder is not a user folder
        }
    }

    return null;
}

/**
 * If the specified folder is somewhere below a group's home folder, return that group id, otherwise null
 * @param folderId the folder beeing looked for
 * @param clientId the client that should be used
 * @returns {Promise<null|*>} a group id or null
 */
exports.getFolderQuotaGroup = async function(folderId, clientId) {
    const folders = await exports.getFolderParents(folderId, clientId);
    if (folders.length >= 2 && folders[folders.length-1].name === "Groups") {
        const userFolderName = folders[folders.length-2].name;

        try {
            return new mongoose.Types.ObjectId(userFolderName);
        }
        catch(err) {
            // folder is not a group folder
        }
    }

    return null;
}

/**
 *
 * @param path
 * @param clientId
 * @param user
 * @param parentId
 * @return {Promise<Types.ObjectId|null|undefined>}
 */
exports.resolveFolder = async function(path, clientId, user, parentId) {
    const parts = path.split('/');

    if (parts.length < 2) {
        return null;
    }

    // remove the first empty part
    parts.splice(0, 1);

    const Folder = mongoose.model('Folder');

    let currentFolder = await Folder.findOne({
        _id: parentId,
    });

    for (const part of parts) {
        if (part === "..") {
            currentFolder = await Folder.findOne({
                _id: currentFolder.parent,
                client: clientId,
                deletedAt: { $exists: false }
            }).exec();
        } else {
            currentFolder = await Folder.findOne({
                parent: currentFolder?._id || null,
                name: part,
                client: clientId,
                deletedAt: { $exists: false }
            }).exec();
        }

        if (!currentFolder) {
            return undefined;
        }
    }

    let folderId = currentFolder._id;
    if (folderId && user) {
        if (!await aclTools.verifyAndGetAclForFolderId(folderId, user, "read")) {
            return undefined;
        }
    }

    return folderId;
}

exports.getSubfolders = async function(parentFolderId, folderAsItemType, folderAsItemName, resolve, lastUpdatedAt, isSystemUser, user, client, isSuperadmin, itemsPerPageStr, firstObjectID) {
    const Folder = mongoose.model('Folder');
    let parentFolder = null;
    const itemsPerPage = parseItemsPerPage(itemsPerPageStr);

    if (parentFolderId) {
        const parentQuery = Folder.findOne();

        if (!isSystemUser)
            parentQuery.where("client").equals(client);

        parentQuery.where("deletedAt").exists(false);
        parentQuery.where("_id").equals(parentFolderId);
        parentFolder = await parentQuery.exec();

        if (!parentFolder || !aclTools.verifyAndGetAclFor(parentFolder, user, "read")) {
            throw new ValidationError("Folder not found");
        }

        // If the folder hasn't updated since the specified "lastUpdatedAt" timestamp, only return notModified = true.
        if (moment(parentFolder.updatedAt).isSame(lastUpdatedAt)) {
            return {
                notModified: true
            }
        }
    }

    let query = {
        parent: parentFolderId,
        deletedAt: { $exists: false }
    };

    if (!isSystemUser) {
        query["client"] = client;
    }

    if (!isSuperadmin) {
        query["$or"] = [
            { hidden: { $exists: false } },
            { hidden: null },
            { hidden: false }
        ]
    }

    if (firstObjectID) {
        query["_id"] = {
            $lte: firstObjectID
        }
    }

    const folders = await Folder.find(query).select("-graph").sort({_id: "descending"}).exec();
    const clonedFolders = JSON.parse(JSON.stringify(folders));
    const filteredFolders = await aclTools.filterElements(clonedFolders, user, "read", true);

    let nextObjectID = null;
    if (filteredFolders.length >= itemsPerPage + 1) {
        nextObjectID = filteredFolders[itemsPerPage]._id;
        filteredFolders.length = itemsPerPage;
    }

    const fields = [
        "_id", "name", "parent", "createdAt", "createdBy", "updatedAt", "updatedBy", "acl"
    ];

    const childFields = [
        "_id", "name", "parent", "createdAt", "createdBy", "updatedAt", "updatedBy", "acl", "contentSize",
        "allowWrite", "allowPublish"
    ];

    if (resolve !== undefined && parentFolder) {
        if (parentFolder.name === "Users" && !parentFolder.parent) {
            childFields.push("originalName");
            for (const folder of filteredFolders) {
                await exports.resolveUserFolderName(folder);
            }
        }
        else if (parentFolder.name === "Groups" && !parentFolder.parent) {
            childFields.push("originalName");
            for (const folder of filteredFolders) {
                await exports.resolveGroupFolderName(folder);
            }
        }
    }

    // Check if we need to resolve folders as items in case there is an item of a defined
    // type or name within that folder. For example if a folder contains a Scene or an item with name "Main", the folder itself
    // will be returned together with this contained item. If multiple of those items are contained,
    // the first one will be attached
    if (folderAsItemType || folderAsItemName) {
        childFields.push('item');
        const promises = filteredFolders.map(async (folder) => {
            folder.item = await getSingleItemOfTypeOrNameInFolder(folder._id, folderAsItemType, folderAsItemName, user);
        });

        await Promise.all(promises);
    }

    const mappedFolders = filteredFolders.map(function(obj) {
        const folder = ensureExactFieldsInObject(obj, childFields);
        // If the folder has the "hideSize" flag set and the user is not an admin, then we need to remove the contentSize field.
        if (obj.hideSize && !user.isAdmin()) {
            folder.contentSize = undefined;
        }
        return folder;
    });

    // We only return the contentSize if the user is an admin or if the parentFolder does not have the hideSize flag set.
    if (!(parentFolder && parentFolder.hideSize) || user.isAdmin()) {
        fields.push("contentSize");
    }

    return {
        parent: parentFolder ? ensureExactFieldsInObject(parentFolder, fields) : null,
        children: mappedFolders,
        nextObjectID: nextObjectID
    }
}

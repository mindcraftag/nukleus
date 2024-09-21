"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc = require('@mindcraftgmbh/nukleus-service');
const RejectionError = nsvc.jobAgent.RejectionError;
const mongoose = nsvc.model.mongoose;
const assert = require('node:assert/strict');

module.exports = {

    type: "Job",
    name: "Clone Folder",
    "parameters": [
        { "name": "Destination Folder", "type": "Folder" },
        // If set, the cloned folder will have this name. If not set, the name of the source folder will be used.
        { "name": "Folder Name", "type": "String" },
        // If true, external items will be ignored and not cloned.
        // If false, an error will be thrown if an external item is found.
        { "name": "Ignore External", "type": "Boolean" },
    ],
    manualStart: true,
    elementMode: "folders",
    contentTypes: [],

    process: async function (tools, log) {

        const parameters = tools.getParameters();
        const destinationFolderId = parameters["Destination Folder"] ? nsvc.verify.toObjectId(parameters["Destination Folder"]) : null;
        const newFolderName = parameters["Folder Name"];
        const ignoreExternal = !!parameters["Ignore External"];
        const clientId = nsvc.verify.toObjectId(tools.getClientId());
        const userId = nsvc.verify.toObjectId(tools.getUserId());
        const folderIds = tools.getElements();

        // Get client and its ACL
        // ----------------------------------------------------------
        const Client = mongoose.model('Client');
        const client = await Client.findOne({
            _id: clientId,
            deletedAt: { $exists: false }
        }).select('acl').exec();

        if (!client) {
            log({ severity: "error " }, "Client not found!");
            return;
        }

        // Get user
        // ----------------------------------------------------------
        const User = mongoose.model('User');
        const user = await User.findOne({
            _id: userId,
            deletedAt: { $exists: false },
            waitingForApproval: { $exists: false },
            active: true
        }).select("-password -avatar").exec();

        if (!user) {
            log({ severity: "error " }, "Executing user not found!");
            return;
        }

        if (!user.setActiveMembership(clientId)) {
            log({ severity: "error " }, "User is not member of this client!");
            return;
        }

        user.clientAcl = client.acl;

        // Verify the user may write to the destination folder
        // ----------------------------------------------------------
        if (!await nsvc.aclTools.verifyAndGetAclForFolderId(destinationFolderId, user, "write")) {
            log({ severity: "error " }, "Destination folder not found or not writable!");
            return;
        }

        if (folderIds.length === 0) {
            log({ severity: "error " }, "No folders selected!");
            return;
        }

        if (folderIds.length !== 1) {
            log({ severity: "error " }, "Select only one folder to clone!");
            return;
        }

        if (folderIds.includes(destinationFolderId)) {
            log({ severity: "error " }, "Cannot clone a folder into itself!");
            return;
        }

        // Clone folders
        // ----------------------------------------------------------
        const Folder = mongoose.model('Folder');
        const Item = mongoose.model('Item');

        // By collecting the mongoose models and various variables together, we
        // don't need to pass them around individually.
        const ctx = {
            Folder, Item,
            clientId, ignoreExternal,
            userId, user,
            folders: new Map(),
            items: new Map(),
            folderMap: new Map(),
            itemMap: new Map()
        };

        // Find all folders that are in the source folder.
        ctx.folders = await discoverFolders(folderIds[0], ctx);

        // Throw an error if any of the sub-folders of the source folder is the destination folder.
        if ([...ctx.folders.keys()].includes(destinationFolderId.toString())) {
            throw new RejectionError("Cannot clone a folder into itself!");
        }

        // Find all items that we need to clone.
        ctx.items = await discoverItems(ctx);

        // Make sure the user has read permission on all items.
        const itemIds = [...ctx.items.keys()];
        const accessibleItems = await nsvc.aclTools.filterItemIds(itemIds, user, clientId, "read");
        if (accessibleItems.length !== itemIds.length) {
            throw new RejectionError("No read permission on item!");
        }

        // Create the new folder structure.
        await cloneFolder(ctx, folderIds[0], destinationFolderId, newFolderName);

        // Create the new items.
        for (const item of ctx.items.values()) {
            await processItem(ctx, item);
        }
    }
};

/**
 * From the specified folder, discover all sub-folders recursively that are in it
 * and return them in a map.
 * @param {string | ObjectID} folderID ID of the folder from which to start searching
 * @param {*} ctx 
 * @param {Map} folderMap optional Map to store the folders in
 * @returns a map of all sub-folders. The values in the map are the folder objects.
 */
async function discoverFolders(folderID, ctx, folderMap) {
    const folder = await ctx.Folder.findOne({
        _id: folderID,
        client: ctx.clientId,
        deletedAt: { $exists: false }
    });
    assert(folder);

    const folders = folderMap ?? new Map();
    folders.set(folderID.toString(), folder);

    // Find all folders that are inside the current folder and also process them.
    const children = await ctx.Folder.find({
        parent: folderID,
        client: ctx.clientId,
        deletedAt: { $exists: false }
    }).select('_id');

    for (const childFolder of children) {
        await discoverFolders(childFolder._id, ctx, folders);
    }

    return folders;
}

/**
 * Finds all items in the ctx.folders map and their linked items.
 * @param {*} ctx 
 * @returns a map containing the found itemIDs and their items.
 * @throws an error if an external item is found and ignoreExternal is false.
 */
async function discoverItems(ctx) {
    const foundItems = new Map();

    for (const folderID of ctx.folders.keys()) {
        const items = await ctx.Item.find({
            folder: folderID,
            client: ctx.clientId,
            deletedAt: { $exists: false }
        });

        for (const item of items) {
            await checkItem(ctx, item, foundItems);
        }
    }

    return foundItems;
}

/**
 * Check if the item is external and store it in the foundItems map.
 * @param {*} ctx 
 * @param {Item} item the item to check
 * @param {Map} foundItems optional map to store the found items in
 * @returns a map containing the found itemIDs and their items.
 * @throws an error if an external item is found and ignoreExternal is false.
 */
async function checkItem(ctx, item, foundItems) {
    if (foundItems.has(item._id.toString())) {
        return;
    }

    if (item.folder === null || !ctx.folders.has(item.folder.toString())) {
        if (ctx.ignoreExternal) {
            return;
        } else {
            throw new RejectionError("External item detected: " + item._id.toString());
        }
    }

    foundItems.set(item._id.toString(), item);

    for (const link of item.links) {
        const linkedItem = await ctx.Item.findOne({
            _id: link.to,
            client: ctx.clientId,
            deletedAt: { $exists: false }
        });
        await checkItem(ctx, linkedItem, foundItems);
    }
}

/**
 * Clone a folder, its sub-folders and items recursively.
 * @param {*} ctx 
 * @param {ObjectID | string} folderID the folderID from which to start cloning
 * @param {ObjectID | string} newParentID ID of the parent folder of the folder that should be cloned
 * @param {string} preferredFolderName optional preferred name for the new folder
 * @returns the newly created folder
 */
async function cloneFolder(ctx, folderID, newParentID, preferredFolderName) {
    const folder = ctx.folders.get(folderID.toString());
    assert(folder);
    const newName = preferredFolderName ?? folder.name;

    // Make sure that a folder with the same name does not exist in the destination folder.
    const existingFolder = await ctx.Folder.findOne({
        name: newName,
        parent: newParentID,
        client: ctx.clientId,
        deletedAt: { $exists: false }
    });

    if (existingFolder) {
        throw new RejectionError(`Folder with name ${newName} already exists in destination folder!`);
    }

    const newFolder = await ctx.Folder.create({
        name: newName,
        parent: newParentID,
        client: ctx.clientId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId
    });
    ctx.folderMap.set(folderID.toString(), newFolder._id);

    // Find all folders that are in the current folder and also process them.
    const children = await ctx.Folder.find({
        parent: folderID,
        client: ctx.clientId,
        deletedAt: { $exists: false }
    }).select('_id');

    for (const childFolder of children) {
        await cloneFolder(ctx, childFolder._id, newFolder._id);
    }

    return newFolder;
}

/**
 * Clones an item into it's new folder.
 * @param {*} ctx 
 * @param {*} item the item to process
 * @returns the ID of the new item
 */
async function processItem(ctx, item) {
    if (ctx.itemMap.has(item._id.toString())) {
        return ctx.itemMap.get(item._id.toString());
    }

    const itemData = item.toObject();
    delete itemData._id;
    const clonedItem = new ctx.Item(itemData);

    // Reset fields that should not be cloned.
    clonedItem.folder = ctx.folderMap.get(item.folder.toString());
    clonedItem.filesize = undefined;
    clonedItem.filename = undefined;
    clonedItem.hash = undefined;
    clonedItem.perceptiveHash = undefined;
    clonedItem.mimeType = undefined;
    clonedItem.thumbnails = [];
    clonedItem.encryptionKey = undefined;
    clonedItem.storages = undefined;
    clonedItem.storageHash = undefined;
    clonedItem.attachments = undefined;
    clonedItem.createdAt = undefined;
    clonedItem.updatedAt = undefined;
    clonedItem.createdBy = ctx.user._id;
    clonedItem.updatedBy = ctx.user._id;

    // Save the item to get a new ID.
    await clonedItem.save();

    // Go over all links and update them to the new item IDs.
    for (const link of clonedItem.links) {
        const linkedItem = ctx.items.get(link.to.toString());

        if (!linkedItem) {
            // If the linked item is not in the list of items to clone, it means
            // that the linked item should be ignored (for example because the
            // linked item is an external item, but we allow them).
            continue;
        }
        const newID = await processItem(ctx, linkedItem);
        link.to = newID;
    }
    clonedItem.markModified("links");

    // If the item has a file, copy the file to the new item in all storages.
    if (item.filesize) {
        for (const storage of item.storages) {
            await nsvc.fileStorage.copy(item._id.toString(), clonedItem._id.toString(), storage);
        }

        clonedItem.filesize = item.filesize;
        clonedItem.filename = item.filename;
        clonedItem.hash = item.hash;
        clonedItem.perceptiveHash = item.perceptiveHash;
        clonedItem.mimeType = item.mimeType;
        clonedItem.thumbnails = item.thumbnails;
        clonedItem.encryptionKey = item.encryptionKey;
        clonedItem.storages = item.storages;
        clonedItem.storageHash = item.storageHash;
        clonedItem.__user = ctx.user._id;
    }

    ctx.itemMap.set(item._id.toString(), clonedItem._id);
    await clonedItem.save({ __user: ctx.user._id });

    return clonedItem._id;
}

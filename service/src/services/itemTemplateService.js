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
const ValidationError   = require('../exception').ValidationError;
const itemService       = require('./itemService.js');
const folderService     = require('./folderService.js');
const clientService     = require('./clientService.js');

/**
 * Check for existance of an itemTemplate
 * @param id
 * @param clientId
 * @returns {Promise<boolean>}
 */
exports.existsItemTemplate = async function(id, clientId) {
    const ItemTemplate = mongoose.model('ItemTemplate');
    const itemTemplate = await ItemTemplate.findOne({ _id: id, client: clientId }).select("_id").exec();
    return !!itemTemplate;
}

/**
 * Get all itemTemplates for a client.
 * @param clientId
 * @returns {Promise<*>}
 */
exports.getItemTemplates = async function(clientId) {
    const ItemTemplate = mongoose.model('ItemTemplate');
    return ItemTemplate.find({ client: clientId }).exec();
}

/**
 * Get specific itemTemplate
 * @param id
 * @param clientId
 * @returns {Promise<*>}
 */
exports.getItemTemplate = async function(id, clientId) {
    const ItemTemplate = mongoose.model('ItemTemplate');
    const itemTemplate = await ItemTemplate.findOne({ _id: id, client: clientId }).exec();
    if (!itemTemplate) {
        throw new ValidationError("Could not find itemTemplate.");
    }

    return itemTemplate;
}

/**
 * Create a new itemTemplate. Will return its object id
 * @param name
 * @param text
 * @param shorttext
 * @param link
 * @param clientId
 * @returns {Promise<*>}
 */
exports.createItemTemplate = async function(name, type, rootItem, folders, clientId) {

    if (!await itemService.existsItem(rootItem, clientId))
        throw new ValidationError("Root item not found");

    for (const folder of folders) {
        if (!await folderService.existsFolder(folder, clientId))
            throw new ValidationError("At least one folder not found");
    }

    if (!await clientService.isDatatypeEnabled(clientId, type))
        throw new ValidationError("Datatype not found.");

    const ItemTemplate = mongoose.model('ItemTemplate');
    const itemTemplate = new ItemTemplate({
        name: name,
        type: type,
        rootItem: rootItem,
        folders: folders,
        client: clientId
    });
    await itemTemplate.save();
    return itemTemplate._id;
}

/**
 * Update an itemTemplate
 * @param id
 * @param name
 * @param text
 * @param clientId
 * @returns {Promise<void>}
 */
exports.updateItemTemplate = async function(id, name, type, rootItem, folders, clientId) {

    if (!await itemService.existsItem(rootItem, clientId))
        throw new ValidationError("Root item not found");

    for (const folder of folders) {
        if (!await folderService.existsFolder(folder, clientId))
            throw new ValidationError("At least one folder not found");
    }

    if (!await clientService.isDatatypeEnabled(clientId, type))
        throw new ValidationError("Datatype not found.");

    const ItemTemplate = mongoose.model('ItemTemplate');
    await ItemTemplate.update({ _id: id, client: clientId }, {
        name: name,
        type: type,
        rootItem: rootItem,
        folders: folders
    });
}

/**
 * Delete an itemTemplate
 * @param id
 * @param clientId
 * @returns {Promise<void>}
 */
exports.deleteItemTemplate = async function(id, clientId) {
    const ItemTemplate = mongoose.model('ItemTemplate');
    await ItemTemplate.deleteOne({ _id: id, client: clientId });
}

/**
 * This function will take an item template and prepare it for application. It will fetch information about
 * the rootItem and all folders and contained items, also measuring their size, returning a new itemTemplate
 * object containing all this information
 * @param itemTemplate
 * @return {Promise<void>}
 */
exports.prepareItemTemplate = async function(itemTemplate) {

    let additionalItemsLength = 0;

    const folders = [];
    const items = [];

    const rootItem = await itemService.getItemByIdAndClient(itemTemplate.rootItem, itemTemplate.client);

    for (const folder of itemTemplate.folders) {
        await folderService.getFolderItemsRecursive(folder, items, itemTemplate.client, true, folders, true);

        // the first entry in the folders array is always the resolved main folder. Remove its parent
        // so the apply function later knows this to be in the created item's folder
        folders[0].parent = null;
    }

    for (const item of items) {
        additionalItemsLength += item.totalSize || 0;
    }

    return Object.assign(itemTemplate.toObject(), {
        rootItem,
        folders: folders,
        items: items,
        additionalItemsLength
    });
}

/**
 * This function takes an item template and an item and will apply the template. The folders with content will be
 * created in the same directory as the item's folder. The folders must not exist or an exception will be thrown.
 * Fields used from the item template will be all attributes, userAttributes, internalAttributes, tags, categories, mimeType,
 * all the file properties, thumbnails, properties, links. Links will be changed in case any of the linked
 * items were contained in the folders. In that case the links will be switched over to the new cloned items.
 * @param preparedItemTemplate
 * @param item
 * @param location
 * @param user
 * @return {Promise<void>}
 */
exports.applyItemTemplate = async function(preparedItemTemplate, item, location, user) {

    // copy basic fields
    // ------------------------------------------------------------------------------------------------------
    item.categories = preparedItemTemplate.rootItem.categories;
    item.tags = preparedItemTemplate.rootItem.tags;
    item.categories = preparedItemTemplate.rootItem.categories;
    item.thumbnails = preparedItemTemplate.rootItem.thumbnails;
    item.properties = preparedItemTemplate.rootItem.properties;

    // copy over attributes
    // ------------------------------------------------------------------------------------------------------
    item.attributes = preparedItemTemplate.rootItem.attributes;
    item.userAttributes = preparedItemTemplate.rootItem.userAttributes;
    item.internalAttributes = preparedItemTemplate.rootItem.internalAttributes;

    // create folders
    // ------------------------------------------------------------------------------------------------------
    const newFolders = new Map();
    for (const folder of preparedItemTemplate.folders) {

        let parentFolderId;
        if (!folder.parent)
            parentFolderId = item.folder;
        else
            parentFolderId = newFolders.get(folder.parent.toString())._id;

        const newFolder = await folderService.createFolder(folder.name, parentFolderId, item.client, location);
        newFolders.set(folder._id.toString(), newFolder);
    }

    // copy additional items
    // ------------------------------------------------------------------------------------------------------
    const newItems = new Map();
    for (const additionalItem of preparedItemTemplate.items) {
        const folder = newFolders.get(additionalItem.folder.toString());
        const newItem = await itemService.cloneItem(additionalItem._id, false, folder._id, [], user, item.client);
        newItems.set(additionalItem._id.toString(), newItem);
    }

    // relink items
    // ------------------------------------------------------------------------------------------------------
    for (const newItem of newItems.values()) {
        let changed = false;
        for (const link of newItem.links) {
            if (newItems.has(link.to.toString())) {
                link.to = newItems.get(link.to.toString())._id;
                changed = true;
            }
        }
        if (changed)
            await newItem.save();
    }

    // copy over links
    // ------------------------------------------------------------------------------------------------------
    for (const link of preparedItemTemplate.rootItem.links) {
        const newLink = newItems.get(link.to.toString());
        if (newLink) {
            link.to = newLink._id;
        }
        item.links.push(link);
    }
}

/**
 * Copies over any data from the item templates' root item to the newly created item
 * @param preparedItemTemplate
 * @param item
 * @return {Promise<void>}
 */
exports.copyRootItemData = async function(preparedItemTemplate, item) {
    return itemService.copyItemData(preparedItemTemplate.rootitem, item);
}

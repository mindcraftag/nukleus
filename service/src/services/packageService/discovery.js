const { mongoose }              = require('@mindcraftgmbh/nukleus-model');
const itemService               = require('../itemService');
const { getItemDownloadStream,
         streamToBuffer }       = require('./util');
const { RejectionError }        = require('../../jobs/jobagent');
const ValidationError           = require('../../exception').ValidationError;
const assert                    = require('node:assert/strict');


// -------------------------------------------------------------
// ----------------- Find all required items -------------------
// -------------------------------------------------------------

/**
 * Finds all items that are required to package the item.
 * @param {string} itemId id of the item to start the search from
 * @param {string[]} siblingFoldersToInclude list of folder IDs that are siblings of the item and should be included in their entirety
 * @param {User} user object of the user that is packaging the item
 * @param {string} client id of the client in which the item is
 * @param {boolean} copyExternal flag to indicate if external items should be copied, otherwise an error is thrown
 * @returns an array of item IDs that are required
 */
exports.findItems = async function(itemId, siblingFoldersToInclude, user, client, rootFolder, copyExternal) {
    // Collect all links of the items and recursively search the links of the linked items.
    // Store the IDs of the scripts we find separately.
    const nonUniqueItemIds = [];
    const nonUniqueScriptIds = [];
    const copiedExternalItems = new Map();

    await findLinks(itemId, nonUniqueItemIds, nonUniqueScriptIds, [itemId], rootFolder, copyExternal, copiedExternalItems);

    for (const folderId of siblingFoldersToInclude) {
        await findAllInSubfolders(folderId, nonUniqueItemIds, nonUniqueScriptIds, rootFolder, copyExternal, copiedExternalItems);
    }

    // Because multiple items can link to the same item, we have to remove duplicates.
    const itemIds = [...new Set(nonUniqueItemIds)];
    await findImportedScripts(nonUniqueScriptIds, itemIds, user, client);

    return itemIds;
}

/**
 * Check if an item is inside a folder or one of its subfolders.
 * @param {string} itemID ID of the item to check
 * @param {string} folderID ID of the folder to check if the item is in
 * @param {string} parentID ID of the parent folder of the item
 * @returns a boolean indicating if the item is in the folder
 */
async function isInFolder(itemID, folderID, parentID) {
    const Item = mongoose.model('Item');
    const item = await Item.findOne({
        _id: itemID
    });

    if (!item) {
        throw new ValidationError(`Linked item ${itemID} does not exist (linked from ${parentID}`);
    }

    // Items that don't have a folder are in the root folder.
    if (!item.folder && folderID !== null) {
        return false;
    }

    let parentFolder = item.folder.toString();

    const Folder = mongoose.model('Folder');

    while (true) {
        if (parentFolder === folderID) {
            return true;
        }

        const nextParent = await Folder.findOne({
            _id: parentFolder
        });
        assert(nextParent);
        if (nextParent.parent === null) {
            return false;
        } else {
            parentFolder = nextParent.parent.toString();
        }
    }
}

/**
 * Recursively find all items inside the folder.
 * @param {string} folderID the ID of the folder to start the search from
 * @param {Array} nonUniqueItemIds array to store all found item IDs
 * @param {Array} nonUniqueScriptIds array to store all found script IDs
 * @param {string} rootFolder the ID of the root folder
 * @param {boolean} copyExternal flag to indicate if external items should be copied, otherwise an error is thrown
 */
async function findAllInSubfolders(folderID, nonUniqueItemIds, nonUniqueScriptIds, rootFolder, copyExternal, copiedExternalItems) {
    const Item = mongoose.model('Item');
    const Folder = mongoose.model('Folder');

    const items = await Item.find({
        folder: folderID,
        deletedAt: { $exists: false }
    });

    const subFolders = await Folder.find({
        parent: folderID,
        deletedAt: { $exists: false }
    });

    for (const item of items) {
        await findLinks(item._id.toString(), nonUniqueItemIds, nonUniqueScriptIds, [item._id.toString()], rootFolder, copyExternal, copiedExternalItems);
    }

    for (const subFolder of subFolders) {
        await findAllInSubfolders(subFolder._id, nonUniqueItemIds, nonUniqueScriptIds, rootFolder, copyExternal, copiedExternalItems);
    }
}

/**
 * Recursively find all linked items of the given item and store them in the two output arrays.
 * @param {string} itemId the ID of the item to start the search from
 * @param {Array} nonUniqueItemIds array to store all found item IDs
 * @param {Array} nonUniqueScriptIds array to store all found script IDs
 * @param {Array} includePath the list of item IDs that were followed to arrive at this item
 * @param {string} rootFolder the ID of the root folder
 * @param {boolean} copyExternal flag to indicate if external items should be copied, otherwise an error is thrown
 */
async function findLinks(itemId, nonUniqueItemIds, nonUniqueScriptIds, path, rootFolder, copyExternal, copiedExternalItems) {
    const Item = mongoose.model('Item');

    // If the item is already known, skip it, otherwise we would end up in an endless loop.
    if (nonUniqueItemIds.includes(itemId)) {
        return;
    }

    // Get the item from the database and scan its link too.
    const item = await Item.findOne({ _id: itemId }).exec();
    let itemWasUpdated = false;

    nonUniqueItemIds.push(itemId);
    if (item.type === "Script") {
        nonUniqueScriptIds.push(itemId);
    }

    for (const link of item.links) {
        // Before following this link, first check if we already passed this item in the current path.
        let linkID = link.to.toString();
        if (path.includes(linkID)) {
            throw new RejectionError("Circular dependency detected: " + path.join(" -> "));
        }

        const isExternal = !await isInFolder(linkID, rootFolder, itemId);
        if (isExternal && !copyExternal) {
            throw new RejectionError(`Item is not in root folder (link ${linkID} in item ${itemId})`);
        } else if (isExternal && copyExternal) {
            const newItemID = await copyExternalItem(linkID, item, copiedExternalItems);
            linkID = newItemID.toString()
            link.to = newItemID;
            itemWasUpdated = true;
        }

        await findLinks(linkID, nonUniqueItemIds, nonUniqueScriptIds, [...path, linkID], rootFolder, copyExternal, copiedExternalItems);
    }

    if (itemWasUpdated) {
        item.markModified('links');
        await item.save();
    }
}
exports.findLinks = findLinks;

/**
 * Copies an external item into the folder of the item that links to it.
 * @param {string} linkedItemID ID of the item to copy
 * @param {Item} originalItem the item that links to the external item
 * @return {string} the ID of the new item
 */
async function copyExternalItem(linkedItemID, originalItem, copiedExternalItems) {
    if (copiedExternalItems.has(linkedItemID)) {
        return copiedExternalItems.get(linkedItemID);
    }

    const Item = mongoose.model('Item');
    const Client = mongoose.model('Client');
    const Plan = mongoose.model('Plan');

    const itemToCopy = await Item.findOne({ _id: linkedItemID }).lean();
    const client = await Client.findOne({ _id: originalItem.client });
    const plan = await Plan.findOne({ _id: client.currentPlan });

    let downloadStream;

    if (itemToCopy.filesize) {
        // Get the download stream before we delete the _id.
        downloadStream = await getItemDownloadStream(itemToCopy);
    }

    delete itemToCopy._id;
    itemToCopy.folder = originalItem.folder;

    const copiedItem = (await Item.insertMany(itemToCopy))[0];

    if (downloadStream) {
        await itemService.uploadFile(
            downloadStream, copiedItem, false,
            client, plan, false, undefined, true, true
        );
        await copiedItem.save();
    }

    copiedExternalItems.set(linkedItemID, copiedItem._id.toString());

    return copiedItem._id;
}

/**
 * Scan through all scripts to find the item IDs of all scripts that are imported.
 * @param {string[]} nonUniqueScriptIds list of all script IDs that were found already
 * @param {string[]} itemIds array where new script item IDs will be stored
 * @param {User} user object of the user that is packaging the item
 * @param {string} client id of the client in which the item is
 * @returns nothing, the output is stored in the itemIds array
 */
async function findImportedScripts(nonUniqueScriptIds, itemIds, user, client) {
    const scriptsToCheck = [...new Set(nonUniqueScriptIds)];

    // Scan through all the scripts and find all the scripts they import using the "import()" statement.
    while (true) {
        // Take a script from the backlog of scripts we need to check.
        // If there are no more scripts to check, we are done.
        const scriptToCheck = scriptsToCheck.pop();
        if (!scriptToCheck) {
            break;
        }

        // Find all the scripts that this script imports.
        const importedScripts = await findImportedLibs(scriptToCheck, user, client);

        for (const script of importedScripts) {
            // If this is a new script we have not yet seen, add it to the list of scripts to check and to the list of itemIDs.
            if (!itemIds.includes(script)) {
                itemIds.push(script);
            }
            scriptsToCheck.push(script);
        }
    }
}

/**
 * Finds all scripts that are imported by the given script.
 * @param {string} scriptId the id of the script to process
 * @param {User} user object of the user that is packaging the item
 * @param {string} client id of the client in which the item is
 * @returns an array of item IDs of the imported scripts
 */
async function findImportedLibs(scriptId, user, client) {
    const Item = mongoose.model('Item');
    const script = await Item.findOne({_id: scriptId}).exec();

    const stream = await getItemDownloadStream(script);
    const code = (await streamToBuffer(stream)).toString();

    const importedPaths = findImportedPaths(code);

    const importedScriptIds = [];
    for (const path of importedPaths) {
        const itemId = await itemService.resolveRelativeItem(path, client, user, script.folder);
        importedScriptIds.push(itemId.toString());
    }

    return importedScriptIds;
}

/**
 * Takes in the code of a Lua script to find the imports.
 * @param {string} code the code of the script to process
 * @returns an array of all direclty imported paths
 */
function findImportedPaths(code) {
    const importRegExp = /import\('(.*)'\)/g;
    const imports = [];
    let match;

    while ((match = importRegExp.exec(code)) !== null) {
        imports.push(match[1]);
    }

    return imports;
}

// -------------------------------------------------------------
// ---------------- Find all required folders ------------------
// -------------------------------------------------------------

// We need to store information about the folder structure of the items we are packaing, because a script can import an item using a relative path.
// Needed folders are not only the folders that direclty contain items, but also all folders between them.

// Example: If we have three folders, each inside another like this: A -> B -> C and two items, one in A and one in C. We also need to include the
// folder between them (B), because a script might use a relative import and step throught the folder B. 

// For every folder, go up until we reach the root folder and store the folder IDs.
exports.findNeededFolders = async function(items, rootFolderID, pkgItems) {
    const Folder = mongoose.model('Folder');

    const folders = {
        [rootFolderID]: await Folder.findOne({
            _id: rootFolderID
        })
    };
    const knownFolders = [rootFolderID];

    const processItem = async (item) => {
        let folderID = item.folder._id.toString();
        if (knownFolders.includes(folderID)) {
            return;
        }

        if (item._isFromPackage) {
            return;
        }

        const folder = await Folder.findOne({
            _id: folderID
        });
        folders[folderID] = folder;
        knownFolders.push(folderID);

        let parent = await Folder.findOne({
            _id: folder.parent
        });

        while (true) {
            const parentId = parent._id.toString()
            if (knownFolders.includes(parentId)) {
                return;
            } else {
                folders[parentId] = parent;
                knownFolders.push(parentId);
                parent = await Folder.findOne({
                    _id: parent.parent
                });
            }
        }
    }

    // We need to collect the folders of all items, including packages.
    for (const i of Object.values(items)) {
        await processItem(i);
    }

    for (const item of Object.values(pkgItems)) {
        await processItem(item);
    }

    return JSON.parse(JSON.stringify(Object.values(folders)));
}

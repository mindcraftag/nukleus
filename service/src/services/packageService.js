"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const { mongoose, ItemVisibility }     = require('@mindcraftgmbh/nukleus-model');
const { Readable, PassThrough }        = require('stream');
const itemService                      = require('./itemService');
const aclTools                         = require('../tools/aclTools');
const { RejectionError }               = require('../jobs/jobagent');
const { findItems, findNeededFolders } = require('./packageService/discovery');
const { enrichItems }                  = require('./packageService/loading');
const { dataToBuffers }                = require('./packageService/packaging');
const decryptorStream                  = require('../filters/decryptorStream');
const { getItemDownloadStream,
        streamToBuffer }               = require('./packageService/util');
const { parsePackage, unpack }         = require('./packageService/unpackaging');
const { fileStorage }                  = require('../..');
const zlib                             = require('zlib');

exports.getItemDownloadStream = getItemDownloadStream;
exports.streamToBuffer = streamToBuffer;
exports.parsePackage = parsePackage;
exports.unpack = unpack;

// Save the package in the database and upload the file to a bucket.
exports.savePackage = async function (stream, type, itemToPackage, user, client, plan, systemUserId, itemName, folderID, createPublicPackage) {
    const Item = mongoose.model('Item');

    let packageItem = new Item({
        name: itemName,
        folder: folderID,
        type: "Package",
        packageType: type,
        public: false,
        visibility: createPublicPackage ? ItemVisibility.Public : ItemVisibility.Private,
        filename: itemName + ".pkg",
        client: client._id,
        tags: itemToPackage.tags,
        categories: itemToPackage.categories,
        description: itemToPackage.description,
        thumbnails: itemToPackage.thumbnails,
        quotaUser: itemToPackage.quotaUser,
        quotaGroup: itemToPackage.quotaGroup,
        createdBy: systemUserId,
        updatedBy: systemUserId,
        acl: [
            {
                user: user._id,
                group: null,
                can: ['read', 'write']
            }
        ],
        __user: systemUserId
    });

    await itemService.uploadFile(stream, packageItem, false, client, plan);
    packageItem.__user = systemUserId;
    await packageItem.save({ __user: systemUserId });

    await aclTools.updateAclCache(packageItem, await aclTools.getClientAcl(client), "item");

    // Copy the attachments
    for (const attachment of itemToPackage.attachments) {
        const attachmentKey = itemToPackage._id.toString() + `_${attachment.name}_${attachment.index}`;
        const download = await fileStorage.download(attachmentKey, attachment.storages);

        let outStream;
        const stream = download.stream;

        // Decrypt the stream if needed
        // -----------------------------------------------------------------------------------------------------
        if (itemToPackage.encryptionKey) {
            const decryptor = decryptorStream.decryptStream(stream, itemToPackage.encryptionKey);
            decryptor.stream.on("error", function (err) {
                logger.error(err);
                res.end();
            });
            outStream = decryptor.stream;
        } else {
            outStream = stream;
        }

        await itemService.addAttachment(packageItem, outStream, attachment.name, attachment.index, false, undefined, client, plan);
    }

    await packageItem.save();

    return packageItem;
}

/**
 * A function to generate the package header.
 * @param {string} itemID id of the item to package
 * @param {string} type the type of the item
 * @param {string[]} siblingFoldersToInclude list of folder IDs that are siblings of the item and should be included in their entirety
 * @param {User} user object of the user that is packaging the item
 * @param {string} client id of the client in which the item is
 * @param {boolean} copyExternal flag to indicate if external items should be copied, otherwise an error is thrown
 * @returns buffer containing the package header
 */
exports.generatePackageHeader = async function (itemID, type, siblingFoldersToInclude, user, client, copyExternal) {
    const Item = mongoose.model('Item');
    const Folder = mongoose.model('Folder');

    const folderID = (await Item.findOne({
        _id: itemID
    })).folder.toString();

    const header = {
        root: itemID,
        type: type,
        rootFolder: folderID
    };

    // Make sure the siblingFoldersToInclude are actually siblings of the item to package.
    for (const siblingID of siblingFoldersToInclude) {
        const siblingFolder = await Folder.findOne({
            _id: siblingID,
            parent: folderID
        });

        if (!siblingFolder) {
            throw new RejectionError("The folder with ID " + siblingID + " is not a sibling of the item to package.");
        }
    }

    // We use a cache for packages because they will be required multiple times during the
    // packaging process and loading them every time is too slow.
    const packageCache = {};

    // First find all items that are required to package the item.
    const itemIDs = await findItems(itemID, siblingFoldersToInclude, user, client, folderID, copyExternal);

    // Then load the metadata of the items and load the packages
    const { items, packageInfo } = await enrichItems(itemIDs, packageCache);

    // Once we have the metadata we can also find the folder structure that we need.
    // (this is required to make relative imports work)
    const folders = await findNeededFolders(items, folderID, packageInfo);

    // We also need to store the folders of the packages.
    // Add the ID of the package to the ID of the folder, so we can distinguish the same folder from different packages.
    // The same is done for items in the enrichItems() function.
    for (const [pkgID, pkg] of Object.entries(packageCache)) {
        for (const folder of Object.values(pkg.folders)) {
            if (folder._id === pkg.header.rootFolder) {
                folder.parent = packageInfo[pkgID].folder.toString();
            } else {
                folder.parent = pkgID + ":" + folder.parent;
            }
            folder._id = pkgID + ":" + folder._id;
            folders.push(folder);
        }
    }

    // Create the buffers for the file from the header, items and folders.
    const { bufferParts, headerBuffer } = dataToBuffers(header, items, folders);

    return {
        bufferParts, headerBuffer, packageCache, items
    };
}

/**
 * A generator function that yields buffer chunks that contain the package content.
 * @param {object} items map containing all items to package
 * @param {object} packageCache map containing all packages that are required to package the items
 * @param {Buffer[]} additionalData buffer array with additional data to include in the package
 * @yields chunks containing the package
 */
exports.generatePackageBody = async function* (items, packageCache, additionalData) {
    yield Buffer.concat(additionalData);

    for (const item of Object.values(items)) {
        if (item._isFromPackage) {
            // If an Item is from a package, then we need to store the file as it is stored in the package, instead of downloading it again.
            const itemId = item._id.slice(item._id.indexOf("/") + 1);
            const fileContent = packageCache[item._isFromPackage].files[itemId];

            // Not every item has a file attached, in that case we just skip it. 
            if (fileContent) {
                yield fileContent;
            }
        } else if (!item.storages || item.storages.length === 0) {
            // If an item is not a package and has no storages, then it doesn't have a file.
            continue;
        } else {
            // Otherwise we need to download the file content from a bucket.
            const chunks = [];
            let size = 0;
            const stream = await getItemDownloadStream(item);

            // Yield a new chunk every 20MB.
            for await (const chunk of stream) {
                chunks.push(chunk);
                size += chunk.length;

                if (size > 20_000_000) {
                    yield Buffer.concat(chunks);
                    chunks.length = 0;
                    size = 0;
                }
            }

            // Always yield the remaining data, even if it is less than 20MB.
            yield Buffer.concat(chunks);
        }
    }
}

/**
 * A wrapper for generatePackage that returns a buffer with the package content.
 * @param {string} itemID id of the item to package
 * @param {string} type the type of the item
 * @param {string[]} siblingFoldersToInclude list of folder IDs that are siblings of the item and should be included in their entirety
 * @param {User} user object of the user that is packaging the item
 * @param {string} client id of the client in which the item is
 * @param {boolean} copyExternal flag to indicate if external items should be copied, otherwise an error is thrown
 * @returns buffer with the package content
 */
exports.generatePackageBuffer = async function (itemID, type, siblingFoldersToInclude, user, client, copyExternal) {
    const {
        bufferParts: additionalData, headerBuffer, packageCache, items
    } = await exports.generatePackageHeader(itemID, type, siblingFoldersToInclude, user, client, copyExternal);

    const gen = exports.generatePackageBody(items, packageCache, additionalData);

    const bufferParts = [];

    for await (const part of gen) {
        bufferParts.push(part);
    }

    const body = zlib.gzipSync(Buffer.concat(bufferParts));

    return Buffer.concat([headerBuffer, body]);
}

/**
 * A wrapper for generatePackage that returns a stream with the package content.
 * @param {string} itemID id of the item to package
 * @param {string} type the type of the item
 * @param {string[]} siblingFoldersToInclude list of folder IDs that are siblings of the item and should be included in their entirety
 * @param {User} user object of the user that is packaging the item
 * @param {string} client id of the client in which the item is
 * @param {boolean} copyExternal flag to indicate if external items should be copied, otherwise an error is thrown
 * @returns stream with the package content
 */
exports.generatePackageStream = async function (itemID, type, siblingFoldersToInclude, user, client, copyExternal) {
    const {
        bufferParts, headerBuffer, packageCache, items
    } = await exports.generatePackageHeader(itemID, type, siblingFoldersToInclude, user, client, copyExternal);

    const gen = exports.generatePackageBody(items, packageCache, bufferParts);

    // Create a new stream that first emits the headerBuffer (r1)
    // and then the package content (r2).
    const r1 = Readable.from(headerBuffer);
    const r2 = Readable.from(gen);

    const gzipStream = zlib.createGzip();
    const combinedStream = new PassThrough();

    r1.pipe(combinedStream, { end: false });
    r2.pipe(gzipStream).pipe(combinedStream);
    gzipStream.on('end', () => combinedStream.end());

    return combinedStream;
}

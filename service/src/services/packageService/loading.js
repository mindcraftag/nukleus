const { mongoose } = require('@mindcraftgmbh/nukleus-model');
const itemService                  = require('../itemService');
const {strict: assert} = require("node:assert");
const { getItemDownloadStream, streamToBuffer } = require('./util');
const { parsePackage } = require('./unpackaging');

// Return the package for an item.
async function getPackageFromItem(item, packageCache) {
    // If we already have the package in the cache, return it.
    if (packageCache[item._id.toString()] !== undefined) {
        return packageCache[item._id.toString()];
    }

    // Otherwise download and decode the package first.
    const stream = await getItemDownloadStream(item);
    const buffer = await streamToBuffer(stream);
    const pkg = await parsePackage(buffer);
    packageCache[item._id.toString()] = pkg;

    return packageCache[item._id.toString()];
}

// Options to use when using itemService.getAggregated().
const aggregationOptions = {
    withFieldInstances: false,
    withAttachmentInfo: false,
    withStats: false,
    noAttributes: false,
    noUserAttributes: false,
    noFields: false,
    noLinks: false,
    noThumbnails: true,
    fetchUserAttributeTemplate: false
}

/**
 * Loads the metadata for items based on their ID.
 * @param {string[]} itemIDs list of the IDs of the items to process
 * @param {*} packageCache object to hold a cache for packages
 * @returns two fields:
 *          - items: array of item objects
 *          - packageMapping: an object that maps package IDs to their root items
 */
exports.enrichItems = async function(itemIDs, packageCache) {
    const Item = mongoose.model('Item');

    // The fileOffset is the starting byte of the next file.
    let fileOffset = 0;
    const items = {};
    const packageMapping = {};
    // key: id of package item, value: 
    const packageInfo = {};

    // Store an item in the items object and calculate the file offset.
    const storeItem = (id, item) => {
        if (items[id] !== undefined) {
            return;
        }

        item.packageFileOffset = fileOffset;
        fileOffset += item.filesize || 0;
        items[id] = item;
    };

    // Go over all items and store their information.
    for (const itemId of itemIDs) {
        const baseItem = await Item.findOne({ _id: itemId }).exec();
        const aggregatedItem = await itemService.getAggregated(baseItem._id, baseItem.client, true, aggregationOptions);

        // We need to add the storages and encryptionKey, because they will be needed to download the item later.
        // These fields are not included in the aggregated item.
        aggregatedItem.storages = baseItem.storages;
        aggregatedItem.encryptionKey = baseItem.encryptionKey;

        if (baseItem.type !== "Package") {
            // Normal items can just be stored directly.
            storeItem(itemId.toString(), aggregatedItem);
        } else {
            // Packages on the other hand need to be unpacked first.
            // We store the items from the packge, but not the package itself.
            const pkg = await getPackageFromItem(baseItem, packageCache);
            const rootItem = pkg.metadata[pkg.header.root];
            packageInfo[itemId] = baseItem;

            // Create a mapping from the Package to its root item, so we can replace
            // links to the Package with links to the "real" item.
            packageMapping[itemId] = rootItem._id;

            // Because the ID of every item is changed when it is stored in this packge, we also need to update the links.
            for (const item of Object.values(pkg.metadata)) {
                for (const link of item.links) {
                    link.to = itemId.toString() + "/" + link.to;
                }
            }

            // Store the items of the package.
            for (const [id, item] of Object.entries(pkg.metadata)) {
                // We don't want to download this item from a bucket, because the file might have been changed since the package was created.
                // Instead we want to take the file content from the package itself, therefore we set the _isFromPackage field to the ID of the package.
                item._isFromPackage = itemId;
                item._id = itemId.toString() + "/" + id;
                item.folder._id = itemId.toString() + ":" + item.folder._id;
                storeItem(itemId.toString() + "/" + id, item);
            }
        }
    }

    // Replace the links to packages with links to the item they contain.
    for (const item of Object.values(items)) {
        if (!item.links) continue;
        for (const link of item.links) {
            if (packageMapping[link.to] !== undefined) {
                link.to = link.to + "/" + packageMapping[link.to];
            }
        }
    }

    return { items, packageMapping, packageInfo };
}
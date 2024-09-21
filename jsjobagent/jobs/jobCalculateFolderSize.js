"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;

module.exports = {

    type: "Job",
    name: "Calculate folder size",
    manualStart: false,
    cronExp: "* * * * *",

    async _completeFolders(folders, clientId, log) {
        const Folder = mongoose.model('Folder');
        const map = new Map();
        const mapByParent = new Map();

        // First put all our folders into a map by ID
        // ------------------------------------------------------
        for (const folder of folders) {
            map.set(folder._id.toString(), folder);
        }

        // Next add all parent folders which are still missing in
        // ------------------------------------------------------
        for (let i=0; i<folders.length; i++) {
            const folder = folders[i];
            if (folder.parent) {
                if (!map.has(folder.parent.toString())) {
                    const parentFolder = await Folder.findOne({
                        _id: folder.parent,
                        client: clientId,
                        deletedAt: { $exists: false }
                    }).select("_id parent").exec();

                    if (parentFolder) {
                        map.set(parentFolder._id.toString(), parentFolder);
                        folders.push(parentFolder);
                    } else {
                        log({ severity: "error" }, `Could not find parent folder ${folder.parent} of folder ${folder._id}`);
                    }
                }
            }
        }

        // Now create a new map by parent folder IDs to return
        // ------------------------------------------------------
        for (const folder of map.values()) {
            const parent = folder.parent ? folder.parent.toString() : null;
            let list;

            if (mapByParent.has(parent)) {
                list = mapByParent.get(parent);
            } else {
                list = [];
                mapByParent.set(parent, list);
            }

            list.push(folder);
        }

        return mapByParent;
    },

    _recursiveBuildTree(node, foldersByParentMap, log) {
        const nodeId = node._id ? node._id.toString() : null;
        const children = foldersByParentMap.get(nodeId);
        if (children) {
            node.children = children.map(x => { return { _id: x._id, parent: node }});
            for (const child of node.children) {
                this._recursiveBuildTree(child, foldersByParentMap, log);
            }
        }
    },

    async _buildFolderTree(folders, clientId, log) {
        const foldersByParentMap = await this._completeFolders(folders, clientId, log);
        const rootNode = { _id: null };
        this._recursiveBuildTree(rootNode, foldersByParentMap, log);
        return rootNode;
    },

    async _fetchFolderItems(node, clientId, Item, Folder, log) {
        const childFolderIds = node.children ? node.children.map(x => x._id) : [];

        // Get a list of all items in the folder
        const items = await Item.find({
            folder: node._id,
            client: clientId,
            deletedAt: { $exists: false }
        }).select("totalSize").exec();

        // Get list of all child folders which are NOT already in the tree
        const folders = await Folder.find({
            _id: { $nin: childFolderIds },
            parent: node._id,
            client: clientId,
            deletedAt: { $exists: false }
        }).select("contentSize").exec();

        let size = 0;
        if (items.length) {
            for (const item of items) {
                size += item.totalSize ? item.totalSize : 0;
            }
        }
        if (folders.length) {
            for (const folder of folders) {
                size += folder.contentSize ? folder.contentSize : 0;
            }
        }
        node.itemSize = size;

        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                await this._fetchFolderItems(child, clientId, Item, Folder, log);
            }
        }
    },

    _calculateFolderSizesRecursive(node, log) {
        let folderSize = 0;
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                folderSize += this._calculateFolderSizesRecursive(child, log);
            }
        }
        node.folderSize = folderSize;
        node.contentSize = node.itemSize + node.folderSize;
        return node.contentSize;
    },

    _writeFolderContentSizes(node, clientId, Folder, log, promises) {
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                this._writeFolderContentSizes(child, clientId, Folder, log, promises);
            }
        }

        if (node._id) {
            promises.push(Folder.updateOne({
                _id: node._id,
                client: clientId
            }, {
                contentSize: node.contentSize,
                recalculateContentSize: false
            }));
        }
    },

    process: async function(tools, log) {
        const Client = mongoose.model('Client');
        const Folder = mongoose.model('Folder');
        const Item = mongoose.model('Item');

        const clients = await Client.find({
            deletedAt: { $exists: false }
        }).select("_id name").exec();

        for (const client of clients) {

            const recalculateFolders = await Folder.find({
                client: client._id,
                $or: [
                    { recalculateContentSize: true },
                    { contentSize: { $exists: false } }
                ],
                deletedAt: { $exists: false }
            }).select("_id parent").exec();

            if (recalculateFolders.length) {
                log(`Recalculating folder content sizes for ${recalculateFolders.length} folders in client ${client.name} (${client._id})`);

                const tree = await this._buildFolderTree(recalculateFolders, client._id, log);
                await this._fetchFolderItems(tree, client._id, Item, Folder, log);
                this._calculateFolderSizesRecursive(tree, log);
                const promises = [];
                this._writeFolderContentSizes(tree, client._id, Folder, log, promises);
                await Promise.all(promises);
            }
        }
    }
};

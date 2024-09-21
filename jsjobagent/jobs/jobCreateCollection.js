"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc              = require('@mindcraftgmbh/nukleus-service');
const mongoose          = nsvc.model.mongoose;
const ItemVisibility    = nsvc.model.ItemVisibility;

module.exports = {

    type: "Job",
    name: "Create Collection",
    manualStart: true,
    elementMode: "items",
    parameters: [
        { "name": "Name", "type": "String" },
        { "name": "Destination Folder", "type": "Folder" },
    ],
    contentTypes: [],

    process: async function(tools, log) {
        const parameters = tools.getParameters();
        const destinationFolderId = parameters["Destination Folder"];
        const name = parameters["Name"];
        const itemIds = tools.getElements() ?? [];
        const clientId = tools.getClientId();
        const userId = tools.getUserId();

        const Client = mongoose.model('Client');
        const client = await Client.findOne({ _id: clientId }).exec();
        if (!client) {
            throw "Client not found!";
        }

        const User = mongoose.model('User');
        const user = await User.findOne({
            _id: userId,
        });
        user.setActiveMembership(clientId);

        if (!destinationFolderId) {
            throw new Error("Destination folder is required!");
        }

        if (!mongoose.isObjectIdOrHexString(destinationFolderId)) {
            throw new Error("Destination folder must be an ObjectID!");
        }

        if ((await nsvc.aclTools.filterFolderIds([destinationFolderId], user, clientId, "write")).length === 0) {
            throw new Error("No write permission in destination folder!");
        }

        const Item = mongoose.model('Item');
        const items = await Item.find({ _id: itemIds, client: clientId, deletedAt: { $exists: false } }).select("acl folder type").exec();

        const filteredItems = await nsvc.aclTools.filterElements(items, user,"read", false);
        if (filteredItems.length === 0) {
            throw new Error("No read permission on items!");
        }

        let allMeshes = true;
        let allAudio = true;
        for (const item of filteredItems) {
            if (item.type !== "Audio")
                allAudio = false;

            if (item.type !== "Mesh")
                allMeshes = false;
        }

        let usageName;
        let fieldName;
        let collectionType;
        if (allAudio) {
            usageName = "AudioItem";
            fieldName = "Audio";
            collectionType = "Audio Collection";
        } else if (allMeshes) {
            usageName = "MeshItems";
            fieldName = "Mesh";
            collectionType = "Mesh Collection";
        } else {
            usageName = "Items";
            fieldName = "Item";
            collectionType = "Collection";
        }

        const links = [];
        let index = 0;
        for (const item of filteredItems) {
            links.push({
                to: item._id,
                usage: `${usageName}[${index++}]->${fieldName}`
            });
        }

        let item = new Item({
            name: name,
            type: collectionType,
            folder: destinationFolderId,
            visibility: ItemVisibility.Private,
            client: client,
            createdBy: user,
            updatedBy: user,
            links: links
        });

        await item.save();
    }
};

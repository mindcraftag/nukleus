"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment            = require('moment');
const nsvc              = require('@mindcraftgmbh/nukleus-service');
const mongoose          = nsvc.model.mongoose;
const ItemVisibility    = nsvc.model.ItemVisibility;

module.exports = {

    type: "Job",
    name: "Export to Zip",
    "parameters": [
        { "name": "Export Metadata", "type": "Boolean", "default": false },
        { "name": "Retain full paths", "type": "Boolean", "default": false },
    ],
    manualStart: true,
    elementMode: "itemsAndFolders",
    contentTypes: [],

    process: async function(tools, log) {

        const parameters = tools.getParameters();
        const exportMetaData = parameters["Export Metadata"] === "true";
        const retainFullPaths = parameters["Retain full paths"] === "true";
        const systemUserId = tools.getSystemUserId();
        const clientId = tools.getClientId();
        const userId = tools.getUserId();
        const elements = tools.getElements();
        const random = await nsvc.security.createRandomPassword(16, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
        const name = `export_${random}`;
        const filename = `${name}.zip`;
        const autoDestructAt = moment().add(1, "day").toDate();

        // Get client and plan
        // ----------------------------------------------------------------------------------------------------
        const Client = mongoose.model('Client');
        const client = await Client.findOne({ _id: clientId }).exec();
        if (!client) {
            throw "Client not found!";
        }

        const Plan = mongoose.model('Plan');
        const plan = await Plan.findOne({ _id: client.currentPlan }).exec();
        if (!plan) {
            throw "Plan not found!";
        }

        const User = mongoose.model('User');
        const user = await User.findOne({ _id: userId }).exec();
        if (!user) {
            throw "User not found!";
        }

        if (!user.setActiveMembership(client._id)) {
            throw "User has no permissions for that client!";
        }

        // Get Temp folder
        // ----------------------------------------------------------------------------------------------------
        const tempFolder = await nsvc.folderService.getSystemFolderId(client._id, "Temp");
        if (!tempFolder) {
            throw "Temp folder not found for client: " + client._id;
        }

        // Create ZIP item
        // ----------------------------------------------------------------------------------------------------
        log("Creating item for zip");
        const Item = mongoose.model('Item');
        let item = new Item({
            name: name,
            folder: tempFolder,
            public: false,
            visibility: ItemVisibility.Private,
            filename: filename,
            autoDestructAt: autoDestructAt,
            client: client._id,
            createdBy: systemUserId,
            updatedBy: systemUserId,
            acl: [
                {
                    user: userId,
                    group: null,
                    can: ['read', 'write']
                },
                {
                    user: null,
                    group: null,
                    can: []
                }
            ],
            __user: systemUserId
        });

        await item.save({__user: systemUserId });

        // Create ZIP stream and upload
        // ----------------------------------------------------------------------------------------------------
        const itemIds = [];
        const folderIds = [];

        for (const element of elements) {
            if (element.isFolder) {
                folderIds.push(element._id);
            } else {
                itemIds.push(element._id);
            }
        }

        log("Creating zip and uploading");
        const stream = await nsvc.itemService.createZipStream(user, client, plan, itemIds, folderIds, exportMetaData, retainFullPaths);
        await nsvc.itemService.uploadFile(stream, item, false, client, plan);
        item.__user = systemUserId;
        await item.save({ __user: systemUserId });

        // Send notification to user
        // ----------------------------------------------------------------------------------------------------
        await nsvc.notificationService.createNotification(userId, clientId, "ZIP Export was created", [item._id]);
    }
};

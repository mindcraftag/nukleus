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
    name: "Clone Item",
    "parameters": [
        { "name": "Deep Clone", "type": "Boolean", "default": false },
        { "name": "Destination Folder", "type": "Folder" },
        { "name": "Exclude Types", "type": "DatatypeList" }
    ],
    manualStart: true,
    elementMode: "items",
    contentTypes: [],

    process: async function(tools, log) {

        const parameters = tools.getParameters();
        const deepClone = parameters["Deep Clone"] === "true";
        const destinationFolderId = parameters["Destination Folder"] ? nsvc.verify.toObjectId(parameters["Destination Folder"]) : null;
        const excludeTypes = parameters["Exclude Types"] ? parameters["Exclude Types"].split(";") : [];
        const clientId = nsvc.verify.toObjectId(tools.getClientId());
        const userId = nsvc.verify.toObjectId(tools.getUserId());
        const itemIds = tools.getElements();

        // Get client and its ACL
        // ----------------------------------------------------------
        const Client = mongoose.model('Client');
        const client = await Client.findOne({
            _id: clientId,
            deletedAt: { $exists: false }
        }).select('acl').exec();

        if (!client) {
            log({ severity: "error "}, "Client not found!");
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
            log({ severity: "error "}, "Executing user not found!");
            return;
        }

        if (!user.setActiveMembership(clientId)) {
            log({ severity: "error "}, "User is not member of this client!");
            return;
        }

        user.clientAcl = client.acl;

        // Verify the user may write to the folder
        // ----------------------------------------------------------
        if (!await nsvc.aclTools.verifyAndGetAclForFolderId(destinationFolderId, user, "write")) {
            log({ severity: "error "}, "Destination folder not found or not writable!");
            return;
        }

        // Clone items
        // ----------------------------------------------------------
        const clonedIds = new Map();
        for (const itemId of itemIds) {
            try {
                const clonedItem = await nsvc.itemService.cloneItem(nsvc.verify.toObjectId(itemId), deepClone, destinationFolderId,
                    excludeTypes, user, clientId, clonedIds);

                log({ severity: 'jobLog' }, "CLONED;" + itemId + ";" + clonedItem._id);
            }
            catch(err) {
                log({ severity: 'error' }, err.toString());
            }
        }
    }
};

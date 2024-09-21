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
const folderService = nsvc.folderService;

function verifyAcl(folder) {
    if (!Array.isArray(folder.acl) || folder.acl.length !== 1)  {
        folder.acl = [{
            user: null,
            group: null,
            can: []
        }];
        return true;
    }

    if (folder.acl[0].user !== null ||
        folder.acl[0].group !== null ||
        !Array.isArray(folder.acl[0].can) ||
        folder.acl[0].can.length !== 0) {
        folder.acl = [{
            user: null,
            group: null,
            can: []
        }];
        return true;
    }

    return false;
}

function ensureFolder(name, parentId, clientId, systemUserId) {
    return new Promise(async (resolve, reject) => {
        try {
            const folderId = await folderService.ensureFolder(clientId, parentId, name, systemUserId, true, true);

            const Folder = mongoose.model('Folder');
            const folder = await Folder.findById(folderId).exec();
            if (!folder)
                reject(`Folder '${name}' created but cannot find it.`);

            // check if normal users have no access to this folder
            if (verifyAcl(folder)) {
                folder.__user = systemUserId;
                await folder.save({__user: systemUserId});
            }

            resolve(folderId);
        }
        catch(err) {
            reject(err);
        }
    });
}

module.exports = {

    type: "Job",
    name: "Ensure system folder",
    manualStart: false,
    interval: 'hourly',

    process: async function(tools, log) {
        const Client = mongoose.model('Client');

        const systemUserId = tools.getSystemUserId();
        const clients = await Client.find({ deletedAt: { $exists: false }}).select("_id").exec();

        const promises = [];

        for (const client of clients) {
            promises.push(ensureFolder("System", null, client._id, systemUserId).then(function(systemFolderId) {
                return Promise.all([
                    ensureFolder("Invoices", systemFolderId, client._id, systemUserId),
                    ensureFolder("Temp", systemFolderId, client._id, systemUserId)
                ])
            }));
        }

        await Promise.all(promises);
    }
};

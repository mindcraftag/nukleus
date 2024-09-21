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

async function calculateStorage(groupId, clientId, log) {
    const Item = mongoose.model('Item');
    const aggregate = Item.aggregate();

    aggregate.match({
        quotaGroup: groupId,
        client: clientId,
        deletedAt: { $exists: false }
    });

    aggregate.group({
        _id: null,
        totalItemSize: {
            "$sum": "$itemSize"
        },
        totalFileSize: {
            "$sum": "$filesize"
        }
    });

    const result = await aggregate.exec();
    if (result.length) {
        const bytes = result[0].totalItemSize + result[0].totalFileSize;
        return bytes / 1024 / 1024 / 1024;
    }

    return 0;
}

async function getClientDefaultGroupStorageQuota(clientId, cache) {
    let quota = cache.get(clientId.toString());
    if (quota === undefined) {
        const Client = mongoose.model('Client');
        const client = await Client.findOne({ _id: clientId, deletedAt: { $exists: false }}).select("defaultGroupStorageQuotaGb").exec();
        if (client) {
            quota = client.defaultGroupStorageQuotaGb || null;
            cache.set(clientId.toString(), quota);
        }
    }

    return quota;
}

module.exports = {

    type: "Job",
    name: "Calculate group storage",
    manualStart: false,
    cronExp: "46 * * * *",

    process: async function(tools, log) {
        const Group = mongoose.model('Group');
        const groups = await Group.find({
            hasFolder: true,
            deletedAt: { $exists: false }
        }).exec();

        const clientCache = new Map();

        for (const group of groups) {
            let changed = false;

            const clientDefaultGroupStorageQuota = await getClientDefaultGroupStorageQuota(group.client, clientCache);

            // check if user storage quota is enabled at all, meaning the default value must be set
            if (clientDefaultGroupStorageQuota !== null && clientDefaultGroupStorageQuota !== undefined) {

                // a value > 0 must be configured, or we don't have to count
                if (group.storageQuotaGb > 0 || clientDefaultGroupStorageQuota > 0) {
                    try {
                        const usedGb = await calculateStorage(group._id, group.client, log);

                        if (usedGb !== group.usedStorageQuotaGb) {
                            group.usedStorageQuotaGb = usedGb;
                            changed = true;
                        }

                    } catch (err) {
                        log({severity: "error"}, `Error processing group storage for user ${group._id}: ${err}`);
                    }
                }
            }

            if (changed)
                await group.save();
        }
    }
};

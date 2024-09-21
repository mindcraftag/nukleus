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

async function calculateStorage(userId, clientId, log) {
    const Item = mongoose.model('Item');
    const aggregate = Item.aggregate();

    aggregate.match({
        quotaUser: userId,
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

async function getClientDefaultUserStorageQuota(clientId, cache) {
    let quota = cache.get(clientId.toString());
    if (quota === undefined) {
        const Client = mongoose.model('Client');
        const client = await Client.findOne({ _id: clientId, deletedAt: { $exists: false }}).select("defaultUserStorageQuotaGb").exec();
        if (client) {
            quota = client.defaultUserStorageQuotaGb || null;
            cache.set(clientId.toString(), quota);
        }
    }

    return quota;
}

module.exports = {

    type: "Job",
    name: "Calculate user storage",
    manualStart: false,
    cronExp: "*/5 * * * *",

    process: async function(tools, log) {
        const User = mongoose.model('User');
        const users = await User.find().exec();

        const clientCache = new Map();

        for (const user of users) {
            let changed = false;

            for (const membership of user.memberships) {
                const clientDefaultUserStorageQuota = await getClientDefaultUserStorageQuota(membership.client, clientCache);

                // check if user storage quota is enabled at all, meaning the default value must be set
                if (clientDefaultUserStorageQuota !== null && clientDefaultUserStorageQuota !== undefined) {

                    // a value > 0 must be configured, or we don't have to count
                    if (membership.storageQuotaGb > 0 || clientDefaultUserStorageQuota > 0) {
                        try {
                            const usedGb = await calculateStorage(user._id, membership.client, log);

                            if (usedGb !== membership.usedStorageQuotaGb) {
                                membership.usedStorageQuotaGb = usedGb;
                                changed = true;
                            }

                        } catch (err) {
                            log({severity: "error"}, `Error processing user storage for user ${user._id}: ${err}`);
                        }
                    }
                }
            }

            if (changed)
                await user.save();
        }
    }
};

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
const fileStorage = nsvc.fileStorage;

function storagesDiff(storages, item) {
    const diff = [];
    for (const storage of storages) {
        const storageStr = storage.toString();
        let found = false;
        for (const itemStorage of item.storages) {
            if (itemStorage.toString() === storageStr) {
                found = true;
                break;
            }
        }
        if (!found) {
            diff.push({
                action: "add",
                storage: storage
            });
        }
    }
    for (const itemStorage of item.storages) {
        const storageStr = itemStorage.toString();
        let found = false;
        for (const storage of storages) {
            if (storage.toString() === storageStr) {
                found = true;
                break;
            }
        }
        if (!found) {
            diff.push({
                action: "remove",
                storage: itemStorage
            });
        }
    }
    return diff;
}

async function processDiffs(object, diffs, key, availableStorages, saveFunc, log) {
    for (const diff of diffs) {
        switch (diff.action) {
            case "add":
                log(`Adding ${key} to storage ${diff.storage}`);
                let found = false;
                for (const storage of availableStorages) {
                    if (storage._id.equals(diff.storage)) {
                        const download = await fileStorage.download(key, object.storages);
                        await fileStorage.upload(key, download.stream, storage._id);
                        object.storages.push(storage);
                        await saveFunc(object.storages);
                        found = true;
                        break;
                    }
                }
                if (!found)
                    throw `Storage not found! ${diff.storage}`;

                break;
            case "remove":
                log(`Removing ${key} from storage ${diff.storage}`);
                await fileStorage.delete(key, diff.storage);
                object.storages = object.storages.filter(s => !s.equals(diff.storage));
                await saveFunc(object.storages);
                break;
        }
    }
}

async function processItem(itemId, storages, availableStorages, storageHash, tools, log) {
    try {
        const Item = mongoose.model('Item');
        const item = await Item.findOne({ _id: itemId }).select('-attributes -thumbnails -userAttributes -properties').exec();

        async function saveFunc(storages) {
            await Item.updateOne({
                _id: itemId
            }, {
                $set: {
                    storages: storages,
                    __user: tools.job.createdBy
                }
            });
        }

        const key = item._id.toString();

        if (item.filesize) {
            const diffs = storagesDiff(storages, item);
            await processDiffs(item, diffs, key, availableStorages, saveFunc, log);
        }

        if (Array.isArray(item.attachments)) {
            for (const attachment of item.attachments) {

                async function attachmentSaveFunc(storages) {
                    await Item.updateOne({
                        _id: itemId,
                        "attachments._id": attachment._id
                    }, {
                        $set: {
                            "attachments.$.storages": storages,
                            __user: tools.job.createdBy
                        }
                    });
                }

                const attachmentKey = `${key}_${attachment.name}_${attachment.index}`;
                const attachmentDiffs = storagesDiff(storages, attachment);

                await processDiffs(attachment, attachmentDiffs, attachmentKey, availableStorages, attachmentSaveFunc, log);

                await Item.updateOne({
                    _id: itemId,
                    "attachments._id": attachment._id
                }, {
                    $set: {
                        "attachments.$.storageHash": storageHash,
                        __user: tools.job.createdBy
                    }
                });
            }
        }

        await Item.updateOne({
            _id: itemId
        }, {
            $set: {
                storageHash: storageHash,
                __user: tools.job.createdBy
            }
        });

        log(`Synced item: ${item._id}`)
    } catch (err) {
        log({severity: "error"}, `Error syncing storages for item ${itemId}: ${err}`);
    }
}

module.exports = {

    type: "Job",
    name: "Sync Storages",
    manualStart: false,
    interval: 'immediate',
    watch: "Item",

    process: async function(tools, log) {

        const Plan = mongoose.model('Plan');
        const Client = mongoose.model('Client');
        const Item = mongoose.model('Item');

        log("Getting all plans from database");
        const plans = await Plan.find().select("_id name storages").exec();
        const plansMap = new Map();
        for (const plan of plans) {
            plansMap.set(plan._id.toString(), plan);
        }

        log("Getting all clients from database");
        const clients = await Client.find().select("_id name storages currentPlan").exec();

        log("Getting storages.");
        const availableStorages = fileStorage.getStorages();

        for (const client of clients) {
            try {
                const storages = client.storages || [];
                const plan = plansMap.get(client.currentPlan.toString());

                // Create list of required storages according to client and plan storages
                // -------------------------------------------------------
                for (const storage of plan.storages) {
                    if (!storages.includes(storage))
                        storages.push(storage);
                }

                // Create storagehash
                // -------------------------------------------------------
                const storageHash = nsvc.storageService.getStorageHash(storages);

                // Get all items that do not have the required storages
                // -------------------------------------------------------
                const items = await Item.find({
                    $or: [
                        {
                            $and: [
                                {
                                    $or: [
                                        { storageHash: { $ne: storageHash }},
                                        { storageHash: { $exists: false }},
                                        { storageHash: null },
                                    ]
                                },
                                {
                                    filesize: {$exists: true}
                                },
                            ]
                        },
                        {
                            $and: [
                                {
                                    $or: [
                                        { "attachments.storageHash": { $ne: storageHash }},
                                        { "attachments.storageHash": { $exists: false }},
                                        { "attachments.storageHash": null },
                                    ]
                                },
                                {
                                    "attachments.0": {$exists: true}
                                },
                            ]
                        }
                    ],
                    deletedAt: { $exists: false },
                    client: client
                }).select('_id').exec();

                if (items.length) {
                    log(`Found ${items.length} items to sync for client ${client.name} (${client._id}).`);
                    let promises = [];
                    for (const item of items) {

                        promises.push(processItem(item._id, storages, availableStorages, storageHash, tools, log));

                        if (promises.length >= 10) {
                            await Promise.all(promises);
                            promises = [];
                        }
                    }
                    await Promise.all(promises);
                }
            }
            catch(err) {
                log({ severity: "error" }, `Error syncing storages for client ${client._id}: ${err}`);
            }
        }

        log(`Done syncing storages`);
    }
};

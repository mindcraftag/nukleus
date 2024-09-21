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

async function processItem(item) {
    let quotaGroup = await nsvc.folderService.getFolderQuotaGroup(item.folder, item.client);
    const Item = mongoose.model('Item');
    await Item.updateOne({ _id: item._id }, { quotaGroup: quotaGroup }).exec();
}

module.exports = {

    type: "Job",
    name: "Set item quota group",
    manualStart: false,
    cronExp: "48 * * * *",

    process: async function(tools, log) {
        const Item = mongoose.model('Item');
        const items = await Item.find({
            quotaGroup: { $exists: false },
            deletedAt: { $exists: false }
        }).select("_id folder client").exec();

        if (items.length) {
            log(`Recalculating quota group for ${items.length} items`);
            const promises = [];
            for (const item of items) {
                promises.push(processItem(item).catch(function (err) {
                    log({severity: "error"}, `Error processing item ${item._id}: ${err}`);
                }));
            }
            await Promise.all(promises);
        }
    }
};

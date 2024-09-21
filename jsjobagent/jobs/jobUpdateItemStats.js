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
    const ConversationEntry = mongoose.model('ConversationEntry');
    const count = await ConversationEntry.countDocuments({ conversation: item.conversation });

    const ItemStat = mongoose.model('ItemStat');
    await ItemStat.findOneAndUpdate({ item: item._id }, { $set: { "counts.messages": count }}, { upsert: true });
}

module.exports = {

    type: "Job",
    name: "Update item stats",
    manualStart: false,
    cronExp: "38 * * * *",

    process: async function(tools, log) {
        const Item = mongoose.model('Item');
        const items = await Item.find({
            deletedAt: { $exists: false },
            conversation: { $exists: true }
        }).select("_id conversation").exec();

        if (items.length) {
            log(`Recalculating stats for ${items.length} items`);
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

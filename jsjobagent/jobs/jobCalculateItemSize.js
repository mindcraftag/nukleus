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
    name: "Calculate item size",
    manualStart: false,
    cronExp: "* * * * *",

    process: async function(tools, log) {
        const Item = mongoose.model('Item');
        const Folder = mongoose.model('Folder');

        // Get all items that have no item size or need to be recalculated
        // -------------------------------------------------------------------
        const aggregate = Item.aggregate();
        aggregate.match({
            $or: [
                { itemSize: { $exists: false } },
                { recalculateItemSize: true }
            ],
            deletedAt: { $exists: false }
        });
        aggregate.project({
            "object_size": {
                "$bsonSize": "$$ROOT"
            },
            "filesize": 1,
            "folder": 1
        })
        const items = await aggregate.exec();

        // For all items, recalculate their size
        // -------------------------------------------------------------------
        if (items.length) {
            log(`Recalculating item size for ${items.length} items`);
            const folderIds = [];
            const promises = [];
            for (const item of items) {

                if (item.folder) {
                    folderIds.push(item.folder);
                }

                promises.push(Item.updateOne({ _id: item._id }, {
                    itemSize: item.object_size,
                    totalSize: (item.filesize ? item.filesize : 0) + item.object_size,
                    recalculateItemSize: false
                }).catch(function (err) {
                    log({severity: "error"}, `Error processing item ${item._id}: ${err}`);
                }));
            }

            // For all touched items, we now also need to recalculate the size of the containing folders
            // -------------------------------------------------------------------
            if (folderIds.length) {
                promises.push(Folder.updateMany({_id: folderIds}, {
                    recalculateContentSize: true
                }).catch(function (err) {
                    log({severity: "error"}, `Error setting recalculateContentSize on folders: ${err}`);
                }));
            }

            await Promise.all(promises);
        }
    }
};

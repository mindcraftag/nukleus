"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment      = require('moment');
const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;
const fileStorage = nsvc.fileStorage;

module.exports = {

    type: "Job",
    name: "Deleted items cleanup",
    manualStart: false,
    interval: 'hourly',

    process: async function(tools, log) {
        const threshold = moment().subtract(1, 'days');

        const Item = mongoose.model('Item');
        const items = await Item.find({ deletedAt: { $lt: threshold }}).exec();
        const promises = [];

        const storages = fileStorage.getStorages();

        for (const item of items) {
            log("Deleting item after grace period: " + item._id);
            promises.push(new Promise((resolve, reject) => {
                const key = item._id.toString();

                const promises = [];
                for (const storage of storages) {
                    if (item.storages.includes(storage._id)) {
                        promises.push(fileStorage.delete(key, storage._id));
                    }
                }

                if (Array.isArray(item.attachments)) {
                    for (const attachment of item.attachments) {
                        const attachmentKey = item._id.toString() + "_" + attachment.name + "_" + attachment.index;

                        for (const storage of storages) {
                            if (attachment.storages.includes(storage._id)) {
                                promises.push(fileStorage.delete(attachmentKey, storage._id));
                            }
                        }
                    }
                }

                Promise.all(promises).then(function() {
                    // now delete item from mongodb
                    return Item.deleteOne({
                        _id: item._id
                    }, { __user: tools.job.createdBy }).exec().then(function() {
                        resolve();
                    });
                }).catch(function(err) {
                    reject(err);
                });
            }));
        }

        await Promise.all(promises);
    }
};
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

module.exports = {

    type: "Job",
    name: "Item auto-destruct",
    manualStart: false,
    interval: 'hourly',

    process: async function(tools, log) {
        const systemUserId = tools.getSystemUserId();
        const threshold = moment();

        const Item = mongoose.model('Item');
        const items = await Item.find({
            autoDestructAt: { $lt: threshold },
            deletedAt: { $exists: false }
        }).select('_id').exec();

        log(`Found items to auto-destruct: ${items.length}`);
        if (items.length) {
            const itemIds = items.map(x => x._id);
            await Item.updateMany({
                _id: itemIds
            }, {
                $set: { deletedAt: new Date() }
            }, {__user: systemUserId }).exec();
        }
    }
};

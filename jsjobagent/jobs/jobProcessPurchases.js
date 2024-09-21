"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc      = require('@mindcraftgmbh/nukleus-service');
const mongoose  = nsvc.model.mongoose;

module.exports = {

    type: "Job",
    name: "Process Purchases",
    manualStart: false,
    interval: "hourly",

    process: async function(tools, log) {
        const Purchase = mongoose.model('Purchase');

        const purchases = await Purchase.find({
            paidUntil: { $lt: new Date() },
            active: true
        }).select("_id canceledAt").exec();

        log(`Found ${purchases.length} purchases to process.`);

        const promises = [];

        for (let purchase of purchases) {
            promises.push(new Promise(async (resolve, reject) => {
                try {
                    if (!purchase.canceledAt) {
                        await nsvc.purchaseService.extendSubscription(purchase._id);
                    } else {
                        await nsvc.purchaseService.deactivatePurchase(purchase._id);
                    }
                }
                catch(err) {
                    log({severity: "error"}, `Error processing purchase ${purchase._id}: ${err}`);
                }

                resolve();
            }));
        }

        await Promise.all(promises);
    }
};

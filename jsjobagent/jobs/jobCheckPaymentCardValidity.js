"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment      = require("moment");
const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;
const mailService = nsvc.mailService;

module.exports = {

    type: "Job",
    name: "Check payment card validity",
    manualStart: false,
    interval: 'weekly',

    process: async function(tools, log) {

        // if cards expire before the threshold date and after the current date, send out a warning
        // if cards are already expired, send out a different warning
        const now = moment();
        const threshold = moment().add(3, 'month');

        log("Getting all clients with payment setup from database");
        const Client = mongoose.model('Client');
        const clients = await Client.find({
            "payment.cardInfo": { $exists: true },
            deletedAt: { $exists: false }
        }).select("name").populate('paymentSetup').exec();

        log(`Found ${clients.length} clients:`);
        const promises = [];
        for (const client of clients) {
            const paymentSetup = client.paymentSetup;
            const cardInfo = paymentSetup.cardInfo;

            if (cardInfo && cardInfo.exp_year && cardInfo.exp_month) {
                const expiration = moment(new Date(cardInfo.exp_year, cardInfo.exp_month, 1));
                const card = `${cardInfo.brand}/${cardInfo.last4}`;

                if (expiration.isBefore(threshold) && expiration.isAfter(now)) {
                    promises.push(mailService.createCardNearingExpirationMail(paymentSetup.address.email, card, expiration.toDate()));
                } else if (expiration.isAfter(now)) {
                    promises.push(mailService.createCardExpiredMail(paymentSetup.address.email, card, expiration.toDate()));
                }
            }
        }

        await Promise.all(promises);
    }
};

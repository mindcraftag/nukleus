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
const mailer      = nsvc.mailer;

module.exports = {

    type: "Job",
    name: "Mailer",
    manualStart: false,
    interval: "immediate",
    watch: "Mail",

    process: async function(tools, log) {
        const Mail = mongoose.model('Mail');
        const mails = await Mail.find({ processedAt: { $exists: false } }).exec();

        log(`Found ${mails.length} mails to send.`);

        const adminAddress = tools.getConfig().mailService.adminAddress;

        if (mails && mails.length) {
            const promises = [];

            for (const mail of mails) {

                let model = Array.from(mail.fields).reduce((obj, [key, value]) => (
                    Object.assign(obj, { [key]: value })
                ), {});

                // If this is an admin mail, send it to the configured admin email address,
                // otherwise send it to the address specified in the mail.
                let address = mail.admin ? adminAddress : mail.address;

                // If the address is empty, log an error and continue with the next mail.
                if (address.length === 0) {
                    log({ severity: "error" }, `Mail ${mail._id} has no address.`);
                    continue;
                }

                promises.push(mailer.createAndSend(mail.template, model, address, mail.attachments, mail.client).then(function (info) {
                    mail.processedAt = new Date();
                    mail.success = true;
                    mail.result = info;
                    mail.save().then(function () {
                    });
                }).catch(function (err) {
                    mail.processedAt = new Date();
                    mail.success = false;
                    mail.result = { error: err.toString() };
                    mail.save().then(function () {
                    });
                }));
            }

            await Promise.all(promises);
        }
    }
};

"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment    = require('moment');
const nsvc      = require('@mindcraftgmbh/nukleus-service');
const mongoose  = nsvc.model.mongoose;

function paymentSetupIsValid(paymentSetup) {
    if (!paymentSetup.paymentMethodId)
        return false;

    const cardInfo = paymentSetup.cardInfo;
    if (cardInfo && cardInfo.exp_year && cardInfo.exp_month) {
        const expiration = moment(new Date(cardInfo.exp_year, cardInfo.exp_month, 1));
        if (expiration.isBefore(moment()))
            return false;
    }

    return true;
}

async function processInvoice(invoice, paymentSetup, log) {
    if (paymentSetupIsValid(paymentSetup)) {
        try {
            invoice.paymentInfo = await nsvc.paymentService.processInvoicePayment(paymentSetup, invoice);
            if (invoice.paymentInfo.status === "succeeded") {
                invoice.paidAt = new Date();
            } else {
                invoice.failedAt = new Date();
                const cardInfo = paymentSetup.cardInfo;
                const card = `${cardInfo.brand}/${cardInfo.last4}`;
                await nsvc.mailService.createPaymentFailedMail(paymentSetup.address.email, card, invoice.number);
            }
        }
        catch(err) {
            invoice.failedAt = new Date();
            const cardInfo = paymentSetup.cardInfo;
            const card = `${cardInfo.brand}/${cardInfo.last4}`;
            await nsvc.mailService.createPaymentFailedMail(paymentSetup.address.email, card, invoice.number);
        }

        await invoice.save();
    }
}

module.exports = {

    type: "Job",
    name: "Process Payments",
    manualStart: false,
    interval: "immediate",
    watch: "Invoice",

    process: async function(tools, log) {
        const Invoice = mongoose.model('Invoice');
        const Client = mongoose.model('Client');

        const failedThreshold = moment().add(-1, 'day').toDate();

        const invoices = await Invoice.find({
            paidAt: { $exists: false },
            $or: [
                { failedAt: { $exists: false}},
                { failedAt: { $lt: failedThreshold }}
            ]
        }).exec();

        log(`Found ${invoices.length} invoices to process payment for.`);

        const promises = [];

        for (let invoice of invoices) {
            promises.push(new Promise(async (resolve, reject) => {
                try {
                    // CHeck if this is an invoice to a user or a client.
                    if (invoice.user) {

                        // Invoice to a user
                        // --------------------------------------------------------------------------
                        const paymentSetup = await nsvc.userService.getPaymentSetup(invoice.user, invoice.client);
                        if (!paymentSetup) {
                            log({severity: "error"}, `User for this invoice was not found or has no payment configured: ${invoice._id}`);
                        } else {
                            await processInvoice(invoice, paymentSetup, log);
                        }

                    } else {

                        // Invoice to a client
                        // --------------------------------------------------------------------------
                        const client = await Client.findOne({_id: invoice.client, deletedAt: {$exists: false}}).populate('paymentSetup').exec();
                        if (!client) {
                            log({severity: "error"}, `Invoice does not have a valid client: ${invoice._id}`);
                        } else {
                            await processInvoice(invoice, client.paymentSetup, log);
                        }
                    }
                }
                catch(err) {
                    log({severity: "error"}, `Error processing invoice ${invoice._id}: ${err}`);
                }

                resolve();
            }));
        }

        await Promise.all(promises);
    }
};

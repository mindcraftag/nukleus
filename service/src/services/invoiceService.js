"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose = require('@mindcraftgmbh/nukleus-model').mongoose;
const logger = require('../tools/logger');
const { processRefund } = require('./paymentService');

/**
 * Retrieve the next invoice number
 * @returns {Promise<*>}
 */
exports.getNextInvoiceNumber = async function() {
    const KeyValuePair = mongoose.model("KeyValuePair");
    const keyValuePair = await KeyValuePair.findOneAndUpdate({ key: 'invoicenumber' }, { $inc: { value: 1 }});
    return keyValuePair.value + 1;
}

/**
 * Create a new invoice in the database
 * @param date date of the invoice
 * @param invoicingYear the year of the invoicing period. may be undefined for user invoices
 * @param invoicingMonth the month of the invoicing period. may be undefined for user invoices
 * @param userId optional user for the invoice. can be null, then it is an invoice to the client
 * @param clientId client of the invoice
 * @param positions the positions on the invoice
 * @param paymentSetup a payment setup to get vat and card info from
 * @returns {Promise<*|(function(*, *, *, *): (*))>}
 */
exports.createInvoice = async function(date, invoicingYear, invoicingMonth, userId, clientId, positions, paymentSetup, asyncPaymentFunc) {

    let subtotal = 0;

    for (const position of positions) {
        subtotal += position.price;
    }

    const Invoice = mongoose.model("Invoice");
    let invoice = new Invoice();
    invoice.number = await exports.getNextInvoiceNumber();
    invoice.date = date;
    invoice.year = invoicingYear;
    invoice.month = invoicingMonth;
    invoice.user = userId;
    invoice.client = clientId;
    invoice.positions = positions;
    invoice.subtotalAmount = subtotal;
    invoice.vatPercent = paymentSetup.vatAmount;
    invoice.vatAmount = Math.round(subtotal * paymentSetup.vatAmount / 100);
    invoice.totalAmount = Math.round(invoice.subtotalAmount + invoice.vatAmount);
    invoice.currency = paymentSetup.currency;

    if (paymentSetup.cardInfo) {
        invoice.message = `Will be payed using: ${paymentSetup.cardInfo.brand} (...${paymentSetup.cardInfo.last4})`;
    }

    if (asyncPaymentFunc) {
        invoice.paymentInfo = await asyncPaymentFunc(invoice);
        if (invoice.paymentInfo.status === "succeeded") {
            invoice.paidAt = new Date();
        } else {
            logger.error("Payment failed: " + JSON.stringify(invoice.paymentInfo));
            return null;
        }
    }

    await invoice.save();

    return invoice;
}

exports.getClientInvoices = async function(clientId) {
    const Invoice = mongoose.model('Invoice');

    const invoices = await Invoice.find({
        client: clientId,
        user: { $exists: false }
    }).sort([["year", "desc"], ["month", "desc"]]).exec();

    return invoices;
}

exports.getUserInvoices = async function(userId, clientId) {
    const Invoice = mongoose.model('Invoice');

    const invoices = await Invoice.find({
        client: clientId,
        user: userId
    }).exec();

    return invoices;
}

/**
 * This method will refund the specified amount of the invoice and cancel the purchase.
 * @param invoiceNumber Number of the invoice which should be (partially) refunded.
 * @param amount Amount that should be refunded in the smallest unit of the currency.
 * @param reason Reason for the refund.
 * @param client The client for which to process the refund. Will be ignored if undefined.
 */
exports.refundInvoice = async function(invoiceNumber, amount, reason, client) {
    const Invoice = mongoose.model('Invoice');
    const invoiceQuery = Invoice.findOne();
    invoiceQuery.where("number").equals(invoiceNumber);

    if (client) {
        invoiceQuery.where('client').equals(client);
    }

    const invoice = await invoiceQuery.exec();
    
    // Check that there is an invoice with the specified number.
    if (invoice === null) {
        throw new Error("invoice with number " + invoiceNumber + " does not exist");
    }

    // Check that the refund isn't larget than the original payment.
    if (invoice.totalAmount < amount) {
        throw new Error("Unable to refund invoice " + invoiceNumber + ": Refunding " + amount + " would result in a larger refund than the original payment.");
    }

    // If this invoice has already been refunded once, check that
    // this refund won't result in refunding more than the original payment.
    if (invoice.refundAmount) {
        if (typeof invoice.refundAmount !== "number") {
            throw new Error("Unable to refund invoice " + invoiceNumber + ": 'refundAmount' is not a number.");
        } else if (invoice.totalAmount < invoice.refundAmount + amount) {
            throw new Error("Unable to refund invoice " + invoiceNumber + ": Refunding " + amount + " would result in a larger refund than the original payment.");
        }
    }

    // Create the refund.
    const refund = await processRefund(invoice, amount);

    if (refund.status === "succeeded") {
        // If the refund was successfull, update the fields on the invoice.
        invoice.refundedAt = new Date();
        invoice.refundReason = reason;

        if (invoice.refundAmount) {
            invoice.refundAmount += amount;
        } else {
            invoice.refundAmount = amount;
        }

        await invoice.save();

        // Find the purchase that is associated with this invoice.
        const Purchase = mongoose.model('Purchase');
        const purchase = await Purchase.findOne({
            "paymentHistory.invoice": invoice._id
        });

        if (purchase) {
            // Cancel and deactivate the purchase.
            purchase.canceledAt = new Date();
            purchase.paidUntil = new Date();
            purchase.active = false;
            purchase.cancellationReason = reason;
            purchase.remainingNetValue = 0;
            await purchase.save();
        }
    } else {
        // Log the error in case the refund failed.
        logger.error("Refund failed: " + JSON.stringify(refund));
        throw new Error("Refund failed");
    }
};

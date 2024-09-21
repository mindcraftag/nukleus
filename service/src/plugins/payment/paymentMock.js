"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const Payment = require('./payment');

class PaymentMock extends Payment {

    constructor(cfg) {
        super();
    }

    isLiveMode() {
        return false;
    }

    createEventParser(req, res, next) {

    }

    async startCheckout(paymentSetupId, successUrl, cancelUrl) {

    }

    async startUserCheckout(userId, clientId, successUrl, cancelUrl) {

    }

    async completeCheckout(customerId, paymentMethodId) {

    }

    async deleteCustomer(customerId) {

    }

    async processPayment(paymentSetup, invoiceNo, totalAmount, currency) {

    }

    async processInvoicePayment(paymentSetup, invoice) {

    }

    async processRefund(invoice, amount) {

    }

}

module.exports = {

    type: "Payment",
    name: "Mock",

    instantiate(cfg) {
        return new PaymentMock(cfg);
    }
};

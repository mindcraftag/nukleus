"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const Stripe            = require('stripe');
const bodyParser        = require("body-parser");
const Payment           = require('./payment');
const model             = require('@mindcraftgmbh/nukleus-model');
const logger            = require("../../tools/logger");
const {ValidationError} = require("../../exception");
const paymentService    = require("../../services/paymentService");
const mongoose          = model.mongoose;

class PaymentStripe extends Payment {

    constructor(config) {
        super();

        logger.info("Initializing payment service.");
        this.livemode = config.livemode;
        this.signingSecret = config.signingSecret;
        this.stripe = Stripe(config.stripeKey, {
            apiVersion: '2020-08-27',
        });

        this.bodyRawParser = bodyParser.raw({type: 'application/json'});

        this.PAYMENT_METHOD_TYPES = [
            'card'
        ];
    }

    /**
     * Parses stripe events inside an incoming request
     * @param req
     * @param res
     * @param next
     */
    createEventParser(req, res, next) {
        const signature = req.headers['stripe-signature'];
        if (signature) {
            this.bodyRawParser(req, res, function() {
                try {
                    req.stripeEvent = this._createEventAndVerify(req.body, signature, signingSecret);
                    next();
                } catch (err) {
                    res.status(400).send(`Webhook Error: ${err.message}`);
                    res.end();
                }
            });
        } else {
            next();
        }
    }

    /**
     * Create a stripe event out of a request body. Verify the signature using the secret
     * @param body
     * @param signature
     * @param secret
     * @returns {Stripe.Event}
     */
    _createEventAndVerify(body, signature, secret) {
        return this.stripe.webhooks.constructEvent(body, signature, secret);
    }

    /**
     * returns whether this is live mode or just testing
     * @returns {boolean}
     */
    isLiveMode() {
        return this.livemode;
    }

    /**
     *  Create a new customer in stripe with an email address
     * @param email
     * @returns {Promise<*>}
     */
    async _createCustomer(email) {
        const customer = await this.stripe.customers.create({
            email: email
        });

        return customer.id;
    };

    /**
     * Delete stripe customer
     * @param customerId
     * @returns {Promise<void>}
     */
    async deleteCustomer(customerId) {
        await this.stripe.customers.del(customerId);
    };

    /**
     * Create a new setup session to register a payment for a customer
     * @param customerId
     * @param successUrl URL to redirect to after coming back from stripe successfully
     * @param cancelUrl URL to redirect to after coming back from stripe canceling
     * @returns {Promise<*>}
     */
    async _createSession(customerId, successUrl, cancelUrl) {
        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: this.PAYMENT_METHOD_TYPES,
            mode: 'setup',
            customer: customerId,
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        return session;
    };

    /**
     * Start stripe checkout. The customer is created if necessary and a new checkout session is started
     * @param paymentSetupId
     * @param successUrl URL to redirect to after coming back from stripe successfully
     * @param cancelUrl URL to redirect to after coming back from stripe canceling
     * @returns {Promise<*>}
     */
    async startCheckout(paymentSetupId, successUrl, cancelUrl) {
        const PaymentSetup = mongoose.model('PaymentSetup');
        const paymentSetup = await PaymentSetup.findById(paymentSetupId).exec();

        if (!paymentSetup.customerId) {
            const email = paymentSetup.address.email;
            if (!email) {
                throw "Client has no email set. Cannot create customer.";
            }

            paymentSetup.customerId = await this._createCustomer(email);
            await paymentSetup.save();
        }

        const session = await this._createSession(paymentSetup.customerId, successUrl, cancelUrl);
        return session;
    };

    /**
     * Start user stripe checkout. The customer is created if necessary and a new checkout session is started
     * @param paymentSetupId
     * @param successUrl URL to redirect to after coming back from stripe successfully
     * @param cancelUrl URL to redirect to after coming back from stripe canceling
     * @returns {Promise<*>}
     */
    async startUserCheckout(userId, clientId, successUrl, cancelUrl) {

        const User = mongoose.model("User");
        const user = await User.findOne({
            _id: userId,
            deletedAt: { $exists: false }
        }).exec();

        if (!user) {
            throw new ValidationError("User not found!");
        }

        let membership;
        for (const m of user.memberships) {
            if (m.client.equals(clientId)) {
                membership = m;
                break;
            }
        }

        if (!membership) {
            throw new ValidationError("User is not member of this client!");
        }

        let paymentSetup;
        if (!membership.paymentSetup) {
            paymentSetup = await paymentService.createPaymentSetup(user.account);
            membership.paymentSetup = paymentSetup;
            await user.save();
        } else {
            const PaymentSetup = mongoose.model('PaymentSetup');
            paymentSetup = await PaymentSetup.findById(membership.paymentSetup).exec();
        }

        if (!paymentSetup.customerId) {
            const email = paymentSetup.address.email;
            if (!email) {
                throw "Client has no email set. Cannot create customer.";
            }

            paymentSetup.customerId = await this._createCustomer(email);
            await paymentSetup.save();
        }

        const session = await this._createSession(paymentSetup.customerId, successUrl, cancelUrl);
        return session;
    };

    /**
     * Process a payment
     * @param paymentSetup
     * @param invoiceNo
     * @param totalAmount
     * @param currency
     * @returns {Promise<void>}
     */
    async processPayment(paymentSetup, invoiceNo, totalAmount, currency) {
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: totalAmount,
            currency: currency.toLowerCase(),
            payment_method: paymentSetup.paymentMethodId,
            payment_method_types: this.PAYMENT_METHOD_TYPES,
            customer: paymentSetup.customerId,
            confirm: true,
            off_session: true,
            receipt_email: paymentSetup.address.email,
            description: "Invoice " + invoiceNo,
            statement_descriptor: "Invoice " + invoiceNo
        }, {
            idempotencyKey: invoiceNo
        });

        return paymentIntent;
    };

    /**
     * Process payment of an invoice
     * @param paymentSetup
     * @param invoice
     * @returns {Promise<void>}
     */
    async processInvoicePayment(paymentSetup, invoice) {
        return this.processPayment(paymentSetup, invoice.number, invoice.totalAmount, invoice.currency);
    }

    /**
     * Process a refund
     * @param invoice
     * @param amount
     * @returns {Promise<void>}
     */
    async processRefund(invoice, amount) {
        const refund = await this.stripe.refunds.create({
            payment_intent: invoice.paymentInfo.id,
            amount: amount
        });

        return refund;
    }
}

module.exports = {

    type: "Payment",
    name: "Stripe",

    instantiate(cfg) {
        return new PaymentStripe(cfg);
    }
};

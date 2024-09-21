"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const Stripe          = require('stripe');
const bodyParser      = require('body-parser');
const model           = require('@mindcraftgmbh/nukleus-model');
const mongoose        = model.mongoose;
const logger          = require('../tools/logger');
const mailService     = require('./mailService');
const ValidationError = require('../exception').ValidationError;

let stripe;
let livemode = false;
let signingSecret;
let bodyRawParser = bodyParser.raw({type: 'application/json'});

const PAYMENT_METHOD_TYPES = [
    'card'
];

/**
 * Initialize stripe payment
 * @param config
 */
exports.init = function(config) {
  logger.info("Initializing payment service.");
  livemode = config.livemode;
  signingSecret = config.signingSecret;

  let stripeKey = config.stripeKey;
  let stripeConfig = {
    apiVersion: '2020-08-27',
  };

  if (config.unitTestMode) {
    // When in unit test mode, use the stripe-mock server.
    stripeConfig.host = "localhost";
    stripeConfig.protocol = "http";
    stripeConfig.port = 12111;

    // When using the stripe-mock server, we need to use "any valid looking testmode secret API key".
    stripeKey = config.stripeUnitTestKey;
  }

  stripe = Stripe(stripeKey, stripeConfig);
};

/**
 * Create a new paymentsetup
 * @param email
 * @returns {Promise<*>}
 */
exports.createPaymentSetup = async function(email) {
  const PaymentSetup = mongoose.model('PaymentSetup');
  const paymentSetup = new PaymentSetup({
    address: {
      email: email
    },
    vatAmount: 7.7,
    // Leave the currency undefined for now. It will be set when the user attaches a card using Stripe.
    currency: undefined
  });
  await paymentSetup.save();
  return paymentSetup;
}

/**
 * Parses stripe events inside an incoming request
 * @param req
 * @param res
 * @param next
 */
exports.stripeEventParser = function(req, res, next) {
  const signature = req.headers['stripe-signature'];
  if (signature) {
    bodyRawParser(req, res, function() {
      try {
        req.stripeEvent = exports.createEventAndVerify(req.body, signature, signingSecret);
        next();
      } catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        res.end();
      }
    });
  } else {
    next();
  }
};

/**
 * Create a stripe event out of a request body. Verify the signature using the secret
 * @param body
 * @param signature
 * @param secret
 * @returns {Stripe.Event}
 */
exports.createEventAndVerify = function(body, signature, secret) {
  return stripe.webhooks.constructEvent(body, signature, secret);
};

/**
 * returns whether this is live mode or just testing
 * @returns {boolean}
 */
exports.isLiveMode = function() {
  return livemode;
};

/**
 *  Create a new customer in stripe with an email address
 * @param email
 * @returns {Promise<*>}
 */
exports.createCustomer = async function(email) {
  const customer = await stripe.customers.create({
    email: email
  });

  return customer.id;
};

/**
 * Delete stripe customer
 * @param customerId
 * @returns {Promise<void>}
 */
exports.deleteCustomer = async function(customerId) {
  await stripe.customers.del(customerId);
};

/**
 * Create a new setup session to register a payment for a customer
 * @param customerId
 * @param successUrl URL to redirect to after coming back from stripe successfully
 * @param cancelUrl URL to redirect to after coming back from stripe canceling
 * @returns {Promise<*>}
 */
exports.createSession = async function(customerId, successUrl, cancelUrl) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: PAYMENT_METHOD_TYPES,
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
exports.startCheckout = async function(paymentSetupId, successUrl, cancelUrl) {
  const PaymentSetup = mongoose.model('PaymentSetup');
  const paymentSetup = await PaymentSetup.findById(paymentSetupId).exec();

  if (!paymentSetup.customerId) {
    const email = paymentSetup.address.email;
    if (!email) {
      throw "Client has no email set. Cannot create customer.";
    }

    paymentSetup.customerId = await exports.createCustomer(email);
    await paymentSetup.save();
  }

  const session = await exports.createSession(paymentSetup.customerId, successUrl, cancelUrl);
  return session;
};

/**
 * Start user stripe checkout. The customer is created if necessary and a new checkout session is started
 * @param paymentSetupId
 * @param successUrl URL to redirect to after coming back from stripe successfully
 * @param cancelUrl URL to redirect to after coming back from stripe canceling
 * @returns {Promise<*>}
 */
exports.startUserCheckout = async function(userId, clientId, successUrl, cancelUrl) {

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
    paymentSetup = await exports.createPaymentSetup(user.account);
    membership.paymentSetup = paymentSetup;
    user.save();
  } else {
    const PaymentSetup = mongoose.model('PaymentSetup');
    paymentSetup = await PaymentSetup.findById(membership.paymentSetup).exec();
  }

  if (!paymentSetup.customerId) {
    const email = paymentSetup.address.email;
    if (!email) {
      throw "Client has no email set. Cannot create customer.";
    }

    paymentSetup.customerId = await exports.createCustomer(email);
    await paymentSetup.save();
  }

  const session = await exports.createSession(paymentSetup.customerId, successUrl, cancelUrl);
  return session;
};

/**
 * Complete a checkout and save a clients payment method Id that was just created on stripe
 * @param customerId
 * @param paymentMethodId
 * @returns {Promise<void>}
 */
exports.completeCheckout = async function(customerId, paymentMethodId) {
  const PaymentSetup = mongoose.model('PaymentSetup');
  const paymentSetup = await PaymentSetup.findOne({
    customerId: customerId,
    deleted: { $exists: false}
  }).exec();

  if (!paymentSetup) {
    logger.error("PaymentSetup not found for completing checkout: " + customerId);
    return;
  }

  paymentSetup.paymentMethodId = paymentMethodId;
  await paymentSetup.save();

  // Find the user who owns this payment setup and send an email about the changed payment setup
  // ------------------------------------------------------------------------------------------
  const User = mongoose.model('User');
  const user = await User.findOne({
    deletedAt: { $exists: false },
    active: true,
    "memberships.paymentSetup": paymentSetup._id
  }).exec();

  if (!user) {
    logger.error("User not found for PaymentSetup in completeCheckout. PaymentSetup ID: " + paymentSetup._id);
    return;
  }

  const email = paymentSetup.address.email || user.account;
  for (const membership of user.memberships) {
    if (paymentSetup._id.equals(membership.paymentSetup)) {
      await mailService.createPaymentChangedMail(email, membership.client);
    }
  }
};

/**
 * Attach card information to the client that was submitted by stripe
 * @param customerId
 * @param cardInfo
 * @returns {Promise<void>}
 */
exports.attachCard = async function(customerId, cardInfo) {
  const PaymentSetup = mongoose.model('PaymentSetup');
  const paymentSetup = await PaymentSetup.findOne({
    customerId: customerId,
    deleted: { $exists: false}
  }).exec();

  if (!paymentSetup) {
    logger.error("PaymentSetup not found for attaching card info: " + customerId);
    return;
  }

  // Determine the currency of the card by looking at the country from which the card was issued.
  // This is not perfect, but the best guess we can make with the data Stripe provides.
  let currency = "eur";
  if (cardInfo.country === "US") {
    currency = "usd";
  } else if (cardInfo.country === "CH") {
    currency = "chf";
  }

  paymentSetup.currency = currency;
  paymentSetup.cardInfo = cardInfo;

  await paymentSetup.save();
};

/**
 * Process a payment
 * @param client
 * @param invoiceNo
 * @param totalAmount
 * @param currency
 * @returns {Promise<void>}
 */
exports.processPayment = async function(paymentSetup, invoiceNo, totalAmount, currency) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount,
    currency: currency.toLowerCase(),
    payment_method: paymentSetup.paymentMethodId,
    payment_method_types: PAYMENT_METHOD_TYPES,
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
exports.processInvoicePayment = async function(paymentSetup, invoice) {
  return exports.processPayment(paymentSetup, invoice.number, invoice.totalAmount, invoice.currency);
};

/**
 * Process a refund
 * @param invoice
 * @param amount
 * @returns {Promise<void>}
 */
exports.processRefund = async function(invoice, amount) {
  const refund = await stripe.refunds.create({
    payment_intent: invoice.paymentInfo.id,
    amount: amount
  });

  return refund;
}

/**
 * Returns a payment setup by its Id
 * @param id
 * @returns {Promise<*>}
 */
exports.getPaymentSetup = async function(id) {
  const PaymentSetup = mongoose.model('PaymentSetup');
  const paymentSetup = await PaymentSetup.findOne({ _id: id }).exec();
  return paymentSetup;
}

/**
 * Returns a list of all supported currencies.
 */
exports.getSupportedCurrencies = async function() {
  const KeyValuePair = mongoose.model("KeyValuePair");
  const keyValuePair = await KeyValuePair.findOne({ key: 'supportedcurrencies' });

  if (!keyValuePair) throw new ValidationError("KeyValuePair 'supportedcurrencies' not found.");
  if (!Array.isArray(keyValuePair.value)) throw new ValidationError("KeyValuePair 'supportedcurrencies' must be an array.");

  return keyValuePair.value;
}

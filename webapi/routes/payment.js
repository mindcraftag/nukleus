"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const express       = require('express');
const bodyParser    = require('body-parser');
const nsvc          = require('@mindcraftgmbh/nukleus-service');
const logger        = nsvc.logger;
const router        = express.Router();

module.exports = {
  path: "/api/payment",
  router: router,
  permissions: [
    { name: 'payments_admin', group: 'payment', description: 'Administrate payment' }
  ]
};

// ############################################################################################################
//  Checkout endpoint for clients
// ############################################################################################################
router.route('/checkout')
  .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["payments_admin"], { fetchClient: true }), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const successUrl = nsvc.verify.optionalString(req, "successUrl");
      const cancelUrl = nsvc.verify.optionalString(req, "cancelUrl");

      const session = await nsvc.paymentService.startCheckout(req.client.paymentSetup, successUrl, cancelUrl);

      res.json({
        result: "success",
        data: {
          id: session.id,
          url: session.url
        }
      });
    });
  });

// ############################################################################################################
//  Checkout endpoint for users
// ############################################################################################################
router.route('/usercheckout')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true }), function (req, res) {
      nsvc.common.handleError(req, res,async function() {

        if (!req.plan.userPurchasesEnabled) {
          throw new nsvc.exception.ValidationError("User purchases not enabled.");
        }

        // Stripe requires the success URL, but not the cancel URL. (https://stripe.com/docs/api/checkout/sessions/create#create_checkout_session-success_url)
        const successUrl = nsvc.verify.string(req, "successUrl");
        const cancelUrl = nsvc.verify.optionalString(req, "cancelUrl");

        const session = await nsvc.paymentService.startUserCheckout(req.userObjectId, req.user.client, successUrl, cancelUrl);

        res.json({
          result: "success",
          data: {
            id: session.id,
            url: session.url
          }
        });

      });
    });

// ############################################################################################################
//  Webhook for stripe
// ############################################################################################################
router.route('/stripeWebhook')
  .post(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), bodyParser.raw({type: 'application/json'}), async function(req, res) {
    try {

      const event = req.stripeEvent;

      res.json({received: true});

      // only process messages that are intended for our system
      if (event.livemode !== nsvc.paymentService.isLiveMode())
        return;

      //logger.debug(event);

      switch (event.type) {
        case 'payment_intent.created': {
          const result = event.data.object;
          //logger.debug("Payment intent created: ", result);
          break;
        }
        case 'payment_intent.succeeded': {
          const result = event.data.object;
          //logger.debug("Payment intent succeeded: ", result);
          break;
        }
        case 'payment_intent.payment_failed': {
          const result = event.data.object;
          //logger.debug("Payment intent failed: ", result);
          break;
        }
        case 'charge.failed': {
          const result = event.data.object;
          //logger.debug("Charge failed: ", result);
          break;
        }
        case 'payment_method.attached': {
          const result = event.data.object;
          const customerId = result.customer;
          const cardInfo = result.card || result.sepa_debit;
          await nsvc.paymentService.attachCard(customerId, cardInfo);
          //logger.debug(result);
          break;
        }
        case 'setup_intent.succeeded': {
          const result = event.data.object;
          //logger.debug(result);
          const customerId = result.customer;
          const paymentMethodId = result.payment_method;
          await nsvc.paymentService.completeCheckout(customerId, paymentMethodId);
          break;
        }
        case 'checkout.session.completed': {
          const result = event.data.object;
          //logger.debug(result);
          break;
        }
        default:
          logger.debug(`Unhandled stripe event type ${event.type}`);
      }
    }
    catch(err) {
      logger.error(err);
    }
  });

router.route('/supportedCurrencies')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const supportedCurrencies = await nsvc.paymentService.getSupportedCurrencies();

            res.json({
                result: 'success',
                data: supportedCurrencies
            });
        });
    });

"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const express = require('express');
const nsvc = require('@mindcraftgmbh/nukleus-service');
const mongoose = nsvc.model.mongoose;
const router = express.Router();

module.exports = {
  path: "/api/newsletter",
  router: router,
};

// ############################################################################################################
//  Get list of all newsletters. Will return all newsletters for users with the
//  newsletter_admin permission, otherwise will only return newsletters that the
//  requesting user is an editor of.
// ############################################################################################################
router.route('/')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchClient: true }), function (req, res) {
    nsvc.common.handleError(req, res, async function () {
      const Newsletter = mongoose.model('Newsletter');

      let newsletters = [];
      if (req.user.hasPermissions(['newsletter_admin'])) {
        newsletters = await Newsletter.find({
          client: req.client.id,
          deletedAt: { $exists: false }
        })
      } else {
        newsletters = await Newsletter.find({
          editors: req.user.id,
          client: req.client.id,
          deletedAt: { $exists: false }
        });
      }

      res.json({
        result: "success",
        data: nsvc.common.ensureExactFieldsInArray(newsletters, [
          "_id", "name", "createdAt"
        ])
      });
    });
  })
  // ############################################################################################################
  //  Create a new newsletter. Only allowed for users with the client_admin permission.
  // ############################################################################################################
  .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], { fetchClient: true }), function (req, res) {
    nsvc.common.handleError(req, res, async function () {
      const Newsletter = mongoose.model('Newsletter');

      const name = nsvc.verify.string(req, "name");
      const editors = nsvc.verify.objectIdArray(req, "editors");

      const nameInUse = await Newsletter.findOne({
        name: name,
        client: req.client.id,
        deletedAt: { $exists: false }
      });

      if (nameInUse) {
        res.status(400).json({
          result: "failed",
          error: "Newsletter name already in use."
        });
        return;
      }

      const newsletter = await Newsletter.create({
        name: name,
        client: req.client.id,
        editors: editors
      });

      res.json({
        result: "success",
        data: {
          id: newsletter._id
        }
      });
    });
  });

// ############################################################################################################
//  Get a specific newsletter. Will only return for users with the
//  newsletter_admin permission or if the requesting user is an editor of the
//  requested newsletter.
// ############################################################################################################
router.route('/:id')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchClient: true }), function (req, res) {
    nsvc.common.handleError(req, res, async function () {
      const Newsletter = mongoose.model('Newsletter');
      const NewsletterSubscription = mongoose.model('NewsletterSubscription');

      const id = nsvc.verify.toObjectId(req.params.id);

      let newsletter = null;
      if (req.user.hasPermissions(['newsletter_admin'])) {
        newsletter = await Newsletter.findOne({
          _id: id,
          client: req.client.id,
          deletedAt: { $exists: false }
        })
      } else {
        newsletter = await Newsletter.findOne({
          _id: id,
          client: req.client.id,
          editors: req.user.id,
          deletedAt: { $exists: false }
        });
      }

      if (!newsletter) {
        res.status(404).json({
          result: "failed",
          error: "Newsletter not found."
        });
        return;
      }

      const fields = ["_id", "name", "editors", "createdAt"];

      // client admins also get the list of all subscribed users
      if (req.user.hasPermissions(['client_admin'])) {
        fields.push("subscribers");
        newsletter.subscribers = nsvc.common.ensureExactFieldsInArray(
          await NewsletterSubscription.find({
            newsletter: newsletter._id,
            deletedAt: { $exists: false }
          })
          , ["email", "createdAt"]);
      }

      res.json({
        result: "success",
        data: nsvc.common.ensureExactFieldsInObject(newsletter, fields)
      });
    });
  })
  // ############################################################################################################
  //  Edit an existing newsletter. Only allowed for users with the client_admin permission.
  // ############################################################################################################
  .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], { fetchClient: true }), function (req, res) {
    nsvc.common.handleError(req, res, async function () {
      const Newsletter = mongoose.model('Newsletter');

      const id = nsvc.verify.toObjectId(req.params.id);
      const name = nsvc.verify.string(req, "name");
      const editors = nsvc.verify.objectIdArray(req, "editors");

      const newsletter = await Newsletter.findOne({
        _id: id,
        client: req.client.id,
        deletedAt: { $exists: false }
      });

      if (!newsletter) {
        res.status(404).json({
          result: "failed",
          error: "Newsletter not found."
        });
        return;
      }

      if (name !== newsletter.name) {

        const nameInUse = await Newsletter.findOne({
          name: name,
          client: req.client.id,
          deletedAt: { $exists: false }
        });

        if (nameInUse) {
          res.status(400).json({
            result: "failed",
            error: "Newsletter name already in use."
          });
          return;
        }
      }

      newsletter.name = name;
      newsletter.editors = editors;
      await newsletter.save();

      res.json({
        result: "success",
        data: newsletter
      });
    });
  })
  // ############################################################################################################
  //  Delete an existing newsletter. Only allowed for users with the client_admin permission.
  // ############################################################################################################
  .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], { fetchClient: true }), function (req, res) {
    nsvc.common.handleError(req, res, async function () {
      const Newsletter = mongoose.model('Newsletter');

      const id = nsvc.verify.toObjectId(req.params.id);
      const newsletter = await Newsletter.findOne({
        _id: id,
        client: req.client.id,
        deletedAt: { $exists: false }
      });

      if (!newsletter) {
        res.status(404).json({
          result: "failed",
          error: "Newsletter not found."
        });
        return;
      }

      newsletter.deletedAt = new Date();
      await newsletter.save();

      const NewsletterSubscription = mongoose.model('NewsletterSubscription');
      await NewsletterSubscription.updateMany({
        newsletter: newsletter._id,
      }, {
        $set: {
          deletedAt: new Date()
        }
      });

      res.json({
        result: "success",
      });
    });
  });

// In test mode, we need to allow more requests to this endpoint.
// 4 request per 24 hours for production, unlimited requests during testing.
const JOIN_RATE_LIMIT = process.env["NODE_ENV"] === "test" ? 999999 : 4;

// ############################################################################################################
//  Join a newsletter.
// ############################################################################################################
router.route('/join')
  .post(nsvc.limiting.createLimiter(JOIN_RATE_LIMIT, 24 * 60 * 60), nsvc.security.accessAnonymous(), function (req, res) {
    nsvc.common.handleError(req, res, async function () {
      const Newsletter = mongoose.model('Newsletter');
      const NewsletterSubscription = mongoose.model('NewsletterSubscription');

      const id = nsvc.verify.objectId(req, "id");
      const email = nsvc.verify.emailAddress(req, "email");

      const newsletter = await Newsletter.findOne({
        _id: id,
        deletedAt: { $exists: false }
      });

      if (!newsletter) {
        res.status(404).json({
          result: "failed",
          error: "Newsletter not found."
        });
        return;
      }

      // Three scenarios:
      // - user has never subscribed => send out email
      // - user has subscribed, and is active
      // - user has subscribed, but is inactive => send out email
      const existingSubscribtion = await NewsletterSubscription.findOne({
        email: email,
        newsletter: newsletter._id,
        deletedAt: { $exists: false }
      });

      /*
      // This is the double opt-in version.
      if (existingSubscribtion === null) {
        const confirmEmailToken = await nsvc.security.createRandomPassword(32,
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
        await NewsletterSubscription.create({
          email: email,
          newsletter: newsletter._id,
          status: "inactive",
          token: confirmEmailToken
        });
        await nsvc.mailService.createMail(email, "newsletter-verify", {
          token: confirmEmailToken
        }, undefined, newsletter.client);
      } else if (existingSubscribtion.status === "inactive") {
        await nsvc.mailService.createMail(email, "newsletter-verify", {
          token: existingSubscribtion.token
        }, undefined, newsletter.client);
      }
      */

      if (existingSubscribtion === null) {
        const confirmEmailToken = await nsvc.security.createRandomPassword(32,
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
        await NewsletterSubscription.create({
          email: email,
          newsletter: newsletter._id,
          status: "active",
          token: confirmEmailToken
        });
      }

      res.json({
        result: "success",
      });
    });
  });

// ############################################################################################################
//  Confirm a subscription to a newsletter.
// ############################################################################################################
router.route('/confirm')
  .post(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
    nsvc.common.handleError(req, res, async function () {
      const NewsletterSubscription = mongoose.model('NewsletterSubscription');

      const token = nsvc.verify.string(req, "token");

      const subscription = await NewsletterSubscription.findOne({
        token: token,
        deletedAt: { $exists: false }
      });

      if (!subscription) {
        res.status(400).json({
          result: 'failed',
          error: "Unknown token"
        });
      } else {
        subscription.status = "active";
        await subscription.save();
      }

      res.json({
        result: "success",
      });
    });

  });

// ############################################################################################################
//  Unsubscribe from a newsletter.
// ############################################################################################################
router.route('/unsubscribe')
  .post(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
    nsvc.common.handleError(req, res, async function () {
      const NewsletterSubscription = mongoose.model('NewsletterSubscription');

      const token = nsvc.verify.string(req, "token");

      const subscription = await NewsletterSubscription.findOne({
        token: token,
      });

      if (!subscription) {
        res.status(400).json({
          result: 'failed',
          error: "Unknown token"
        });
      } else {
        subscription.status = "inactive";
        await subscription.save();
      }

      res.json({
        result: "success",
      });
    });
  });

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
const nsvc          = require('@mindcraftgmbh/nukleus-service');
const mongoose      = nsvc.model.mongoose;
const router        = express.Router();

module.exports = {
  path: "/api/invoice",
  router: router,
  permissions: [
    { name: 'invoice_admin', group: 'invoice', description: 'Access invoices' }
  ]
};

// ############################################################################################################
// Get list of all invoices for current client
// ############################################################################################################
router.route('/')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoice_admin']), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const invoices = await nsvc.invoiceService.getClientInvoices(req.user.client);

      res.json({
        result: "success",
        data: invoices
      });
    });
  });

// ############################################################################################################
// Get list of all invoices for specific client
// ############################################################################################################
router.route('/client/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoice_admin'], true), function (req, res) {
      nsvc.common.handleError(req, res,async function() {

        const clientId = nsvc.verify.toObjectId(req.params.id);
        const invoices = await nsvc.invoiceService.getClientInvoices(clientId);

        res.json({
          result: "success",
          data: invoices
        });
      });
    });

// ############################################################################################################
// Get list of all invoices for current user
// ############################################################################################################
router.route('/my')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
      nsvc.common.handleError(req, res,async function() {

        const invoices = await nsvc.invoiceService.getUserInvoices(req.userObjectId, req.user.client);

        res.json({
          result: "success",
          data: invoices
        });
      });
    });

// ############################################################################################################
// Get invoice pdf
// ############################################################################################################
router.route('/download/:id')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoice_admin']), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const query = {
        _id: nsvc.verify.toObjectId(req.params.id)
      };

      if (!req.user.superadmin) {
        query.client = req.user.client;
      }

      const Invoice = mongoose.model('Invoice');
      const invoice = await Invoice.findOne(query).exec();

      if (!invoice) {
        res.json({
          result: "failed",
          error: "Invoice not found"
        });
        return;
      }

      if (!invoice.item) {
        res.json({
          result: "failed",
          error: "Invoice has no pdf attached."
        });
        return;
      }

      const itemQuery = {
        _id: invoice.item,
        deletedAt: { $exists: false }
      };

      if (!req.user.superadmin) {
        itemQuery.client = req.user.client;
      }

      const Item = mongoose.model('Item');
      const item = await Item.findOne(itemQuery).select("name type mimeType filesize filename client hash storages encryptionKey").exec();

      if (!item || !item.filesize) {
        res.json({
          result: "failed",
          error: "Item not found"
        });
      }
      else {
        await nsvc.itemService.handleDownload(req, res, item);
        await nsvc.clientMetrics.incSecureDownloads(item.client, item.filesize);
      }
    });
  });

// ############################################################################################################
// Regenerate invoice
// ############################################################################################################
router.route('/regenerate/:id')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoice_admin'], true), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const query = {
        _id: nsvc.verify.toObjectId(req.params.id)
      };

      if (!req.user.superadmin) {
        query.client = req.user.client;
      }

      const Invoice = mongoose.model('Invoice');
      const invoice = await Invoice.findOne(query).exec();

      if (!invoice) {
        res.json({
          result: "failed",
          error: "Invoice not found"
        });
        return;
      }

      if (!invoice.item) {
        res.json({
          result: "failed",
          error: "Invoice has no pdf attached."
        });
        return;
      }

      const Item = mongoose.model('Item');
      await Item.updateMany({
        _id: invoice.item._id,
        client: invoice.client
      }, {
        $set: { deletedAt: new Date() }
      }, {__user: req.userObjectId}).exec();

      invoice.item = undefined;
      await invoice.save();

      res.json({
        result: "success"
      });
    });
  });

// ############################################################################################################
// Get list of all invoices for a month
// ############################################################################################################
router.route('/month/:month/:year')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoice_admin'], true), function (req, res) {
      nsvc.common.handleError(req, res,async function() {
        const Invoice = mongoose.model('Invoice');

        const invoices = await Invoice.find({
          year: parseInt(req.params.year),
          month: parseInt(req.params.month)
        }).exec();

        res.json({
          result: "success",
          data: invoices
        });
      });
    });

// ############################################################################################################
// Refund a specific invoice by specifying the invoiceNumber, amount (in the smallest unit of the currency)
// and optionally a reason for the refund.
// ############################################################################################################
router.route('/refund')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoice_admin'], true), function (req, res) {
      nsvc.common.handleError(req, res,async function() {
        const invoiceNumber = nsvc.verify.integerNumber(req, "invoice");
        const amount = nsvc.verify.integerNumber(req, "amount");
        let reason = nsvc.verify.optionalString(req, "reason");

        // If no reason was specified, we set the reason to "manual refund";
        if (!(reason && reason.length > 0)) {
          reason = "manual refund";
        }

        try {
          await nsvc.invoiceService.refundInvoice(invoiceNumber, amount, reason, req.user.client);

          res.json({
            result: "success",
            data: "ok"
          });
        } catch (err) {
          // Return the error in case one occurs.
          res.json({
            result: "failed",
            data: err
          });
        }
      });
    });

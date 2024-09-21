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
const router        = express.Router();

module.exports = {
    path: "/api/purchase",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of purchases
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([],{ fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let nextItem = null;

            if (!req.plan.userPurchasesEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "User purchases not enabled."
                });
                return;
            }

            if (req.query.nextItem !== undefined) {
                nextItem = nsvc.verify.toObjectId(req.query.nextItem);
            }

            const data = await nsvc.purchaseService.getMyPurchasesPaginated(req.user._id, req.user.client, req.query.pageSize, nextItem);

            res.json({
                result: "success",
                data: data.purchases,
                next: data.nextObjectID
            });
        });
    })

// ############################################################################################################
// Purchase something
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([],{ fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            if (!req.plan.userPurchasesEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "User purchases not enabled."
                });
                return;
            }

            const purchasableId = nsvc.verify.objectId(req, "purchasable");
            const optionId = nsvc.verify.objectId(req, "option");

            const purchase = await nsvc.purchaseService.purchase(purchasableId, req.user._id, req.user.client, optionId);

            res.json({
                result: "success",
                data: purchase._id
            });
        });
    })

// ############################################################################################################
// Cancel purchase
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([],{ fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            if (!req.plan.userPurchasesEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "User purchases not enabled."
                });
                return;
            }

            const purchaseId = nsvc.verify.objectId(req, "id");
            await nsvc.purchaseService.cancelPurchase(purchaseId, req.user._id, req.user.client);

            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// Query all purchases by user (email), invoice number and creation date.
// ############################################################################################################
router.route('/query')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], {needsSuperAdmin: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const startDate = nsvc.verify.optionalDate(req, "startDate");
            const endDate = nsvc.verify.optionalDate(req, "endDate");
            const email = nsvc.verify.optionalString(req, "email");
            const invoice = nsvc.verify.optionalString(req, "invoice");
            const cursor = nsvc.verify.optionalString(req, "cursor");
            const limit = nsvc.verify.optionalIntegerNumber(req, "limit");

            const data = await nsvc.purchaseService.queryAllPurchases(startDate, endDate, email, invoice, req.user.client, cursor, limit);

            res.json({
                result: "success",
                data: data,
            });
        });
    });

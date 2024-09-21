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
    path: "/api/purchasable",
    router: router,
    permissions: [
        { name: 'purchasable_admin', group: 'mailing', description: 'Administrate purchasables' }
    ]
};

// ############################################################################################################
// Get list of purchasables
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([],{ fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            if (!req.plan.userPurchasesEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "User purchases not enabled."
                });
                return;
            }

            const purchasables = await nsvc.purchasableService.getPurchasables(req.user.client);

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(purchasables, [
                    "_id", "name", "public", "description", "options", "createdAt", "updatedAt",
                    "createdBy", "updatedBy", "groupId", "pricesContainVat"
                ])
            });
        });
    })

// ############################################################################################################
// Create purchasable
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['purchasable_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.userPurchasesEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "User purchases not enabled."
                });
                return;
            }

            const name = nsvc.verify.string(req, 'name');
            const description = nsvc.verify.string(req, 'description', 10000);
            const options = nsvc.verify.array(req, 'options');
            const groupId = nsvc.verify.optionalString(req, "groupId");
            const activationActions = nsvc.verify.optionalArray(req, "activationActions");
            const deactivationActions = nsvc.verify.optionalArray(req, "deactivationActions");
            const isPublic = nsvc.verify.optionalBoolean(req, "public", false);
            const pricesContainVat = nsvc.verify.optionalBoolean(req, "pricesContainVat", false);

            const purchasable = await nsvc.purchasableService.createPurchasable(name, description, options,
                groupId, activationActions, deactivationActions, req.user.client, req.userObjectId, isPublic, pricesContainVat);

            res.status(201).json({
                result: "success",
                data: purchasable._id
            });
        });
    })

// ############################################################################################################
// Modify purchasable
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['purchasable_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.userPurchasesEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "User purchases not enabled."
                });
                return;
            }

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, 'name');
            const description = nsvc.verify.string(req, 'description', 10000);
            const options = nsvc.verify.array(req, 'options');
            const groupId = nsvc.verify.optionalString(req, "groupId");
            const activationActions = nsvc.verify.optionalArray(req, "activationActions");
            const deactivationActions = nsvc.verify.optionalArray(req, "deactivationActions");
            const isPublic = nsvc.verify.optionalBoolean(req, "public", false);
            const pricesContainVat = nsvc.verify.optionalBoolean(req, "pricesContainVat", false);

            await nsvc.purchasableService.updatePurchasable(id, name, description, options,
                groupId, activationActions, deactivationActions, req.user.client, req.userObjectId, isPublic, pricesContainVat);

            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// Delete purchasable
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['purchasable_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.userPurchasesEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "User purchases not enabled."
                });
                return;
            }

            const id = nsvc.verify.objectId(req, "id");
            await nsvc.purchasableService.deletePurchasable(id, req.user.client, req.userObjectId);
            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get specific purchasable
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['purchasable_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.userPurchasesEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "User purchases not enabled."
                });
                return;
            }

            const id = nsvc.verify.toObjectId(req.params.id);
            const purchasable = await nsvc.purchasableService.getPurchasable(id, req.user.client);

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(purchasable,[
                    "_id", "name", "description", "options", "createdAt", "updatedAt", "createdBy", "updatedBy",
                    "groupId", "activationActions", "deactivationActions", "public", "pricesContainVat"
                ])
            });
        });
    });

// ############################################################################################################
// Get list of public purchasables
// ############################################################################################################
router.route('/public/:clientId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const clientId = nsvc.verify.toObjectId(req.params.clientId);
            const client = await nsvc.clientService.getClient(clientId, "_id", true);

            if (!client) {
                res.status(400).json({
                    result: "failed",
                    error: "client not found"
                });
            }

            if (!client.currentPlan.userPurchasesEnabled) {
                res.json({
                    result: "success",
                    data: []
                });
            }

            const purchasables = await nsvc.purchasableService.getPurchasables(client._id, true);

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(purchasables, [
                    "_id", "name", "description", "options", "groupId", "pricesContainVat"
                ])
            });
        });
    })

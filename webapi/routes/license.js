"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const express           = require('express');
const nsvc              = require('@mindcraftgmbh/nukleus-service');
const router            = express.Router();
const ValidationError   = nsvc.exception.ValidationError;

module.exports = {
    path: "/api/license",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of licenses
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const licenses = await nsvc.licenseService.getLicenses(req.user.client, true);

            const fields = [
                "_id", "name", "link", "text", "shorttext"
            ];

            const mappedLicenses = licenses.map(function(obj) {
                return nsvc.common.ensureExactFieldsInObject(obj, fields);
            });

            res.json({
                result: "success",
                data: mappedLicenses
            });
        });
    })

// ############################################################################################################
// Create license
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin']), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const name = nsvc.verify.string(req, "name");
            const text = nsvc.verify.optionalString(req, "text", 100000);
            const shorttext = nsvc.verify.optionalString(req, "shorttext");
            const link = nsvc.verify.optionalString(req, "link");

            let clientId = req.user.client;
            if (req.user.superadmin && req.body.client) {
                clientId = nsvc.verify.toObjectId(req.body.client);
                if (!await nsvc.clientService.existsClient(clientId)) {
                    throw new ValidationError("Client not found.");
                }
            }

            const id = await nsvc.licenseService.createLicense(name, text, shorttext, link, clientId);

            res.status(201).json({
                result: "success",
                data: id
            });
        });
    })


// ############################################################################################################
// Update license
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin']), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, "name");
            const text = nsvc.verify.optionalString(req, "text", 100000);
            const shorttext = nsvc.verify.optionalString(req, "shorttext");
            const link = nsvc.verify.optionalString(req, "link");

            let clientId = req.user.client;
            if (req.user.superadmin && req.body.client) {
                clientId = nsvc.verify.toObjectId(req.body.client);
                if (!await nsvc.clientService.existsClient(clientId)) {
                    throw new ValidationError("Client not found.");
                }
            }

            await nsvc.licenseService.updateLicense(id, name, text, shorttext, link, clientId);

            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// Delete license
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin']), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            const id = nsvc.verify.objectId(req, "_id");

            let clientId = req.user.client;
            if (req.user.superadmin && req.body.client) {
                clientId = nsvc.verify.toObjectId(req.body.client);
                if (!await nsvc.clientService.existsClient(clientId)) {
                    throw new ValidationError("Client not found.");
                }
            }

            await nsvc.licenseService.deleteLicense(id, clientId);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get specific license
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);

            let clientId = req.user.client;
            if (req.user.superadmin) {
                clientId = undefined;
            }

            const license = await nsvc.licenseService.getLicense(id, clientId);

            const fields = [
                "_id", "name", "link", "shorttext", "text"
            ];

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(license, fields)
            });
        });
    })

// ############################################################################################################
// Get list of licenses
// ############################################################################################################
router.route('/inclient/:clientId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const clientId = nsvc.verify.toObjectId(req.params.clientId);
            const licenses = await nsvc.licenseService.getLicenses(clientId, true);

            const fields = [
                "_id", "name", "link", "shorttext", "text"
            ];

            const mappedLicenses = licenses.map(function(obj) {
                return nsvc.common.ensureExactFieldsInObject(obj, fields);
            });

            res.json({
                result: "success",
                data: mappedLicenses
            });
        });
    });

// ############################################################################################################
// Get specific public license for client
// ############################################################################################################
router.route('/public/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);
            const license = await nsvc.licenseService.getPublicLicense(id);

            const fields = [
                "_id", "name", "link", "shorttext", "text"
            ];

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(license, fields)
            });
        });
    })

// ############################################################################################################
// Get public list of licenses for client
// ############################################################################################################
router.route('/publiclist/:clientId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const clientId = nsvc.verify.toObjectId(req.params.clientId);
            const licenses = await nsvc.licenseService.getPublicLicenses(clientId, true);

            const fields = [
                "_id", "name", "link", "shorttext", "text"
            ];

            const mappedLicenses = licenses.map(function(obj) {
                return nsvc.common.ensureExactFieldsInObject(obj, fields);
            });

            res.json({
                result: "success",
                data: mappedLicenses
            });
        });
    })

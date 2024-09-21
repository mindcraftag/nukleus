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
    path: "/api/itemtemplate",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of item templates
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const itemTemplates = await nsvc.itemTemplateService.getItemTemplates(req.user.client);

            const fields = [
                "_id", "name", "type", "rootItem", "folders"
            ];

            const mappedItemTemplates = itemTemplates.map(function(obj) {
                return nsvc.common.ensureExactFieldsInObject(obj, fields);
            });

            res.json({
                result: "success",
                data: mappedItemTemplates
            });
        });
    })

    // ############################################################################################################
    // Create item template
    // ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin']), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const name = nsvc.verify.string(req, "name");
            const type = nsvc.verify.optionalString(req, "type");
            const rootItem = nsvc.verify.objectId(req, "rootItem");
            const folders = nsvc.verify.optionalObjectIdArray(req, "folders");

            let clientId = req.user.client;
            if (req.user.superadmin && req.body.client) {
                clientId = nsvc.verify.toObjectId(req.body.client);
                if (!await nsvc.clientService.existsClient(clientId)) {
                    throw new ValidationError("Client not found");
                }
            }

            const id = await nsvc.itemTemplateService.createItemTemplate(name, type, rootItem, folders, clientId);

            res.status(201).json({
                result: "success",
                data: id
            });
        });
    })


    // ############################################################################################################
    // Update item template
    // ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin']), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, "name");
            const type = nsvc.verify.optionalString(req, "type");
            const rootItem = nsvc.verify.objectId(req, "rootItem");
            const folders = nsvc.verify.optionalObjectIdArray(req, "folders");

            let clientId = req.user.client;
            if (req.user.superadmin && req.body.client) {
                clientId = nsvc.verify.toObjectId(req.body.client);
                if (!await nsvc.clientService.existsClient(clientId)) {
                    throw new ValidationError("Client not found.");
                }
            }

            await nsvc.itemTemplateService.updateItemTemplate(id, name, type, rootItem, folders, clientId);

            res.json({
                result: "success"
            });
        });
    })

    // ############################################################################################################
    // Delete item template
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

            await nsvc.itemTemplateService.deleteItemTemplate(id, clientId);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Return public list of templates
// ############################################################################################################
router.route('/list')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const itemTemplates = await nsvc.itemTemplateService.getItemTemplates(req.user.client);

            const fields = [
                "_id", "name", "type"
            ];

            const mappedItemTemplates = itemTemplates.map(function(obj) {
                return nsvc.common.ensureExactFieldsInObject(obj, fields);
            });

            res.json({
                result: "success",
                data: mappedItemTemplates
            });
        });
    })

// ############################################################################################################
// Get specific item template
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);

            const itemTemplate = await nsvc.itemTemplateService.getItemTemplate(id, req.user.client);

            const fields = [
                "_id", "name", "type", "rootItem", "folders"
            ];

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(itemTemplate, fields)
            });
        });
    })



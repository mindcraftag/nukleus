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
const router = express.Router();

module.exports = {
    path: "/api/attributetemplate",
    router: router,
    permissions: [
        { name: 'attributetemplate_admin', group: 'attributetemplate', description: 'Administrate attribute templates' }
    ]
};

// ############################################################################################################
// Get list of all attribute templates
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.attributeTemplatesAllowed) {
                res.json({
                    result: "failed",
                    error: "Attribute templates not enabled."
                });
                return;
            }

            const attributeTemplates = await nsvc.attributeTemplateService.getAttributeTemplates(req.user.client);

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(attributeTemplates, [
                    "_id", "name", "fields", "createdAt", "updatedAt"
                ])
            });
        });
    })

// ############################################################################################################
// Create attribute template
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['attributetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.attributeTemplatesAllowed) {
                res.json({
                    result: "failed",
                    error: "Attribute templates not enabled."
                });
                return;
            }

            const name = nsvc.verify.string(req, 'name');
            const fields = nsvc.verify.optionalArray(req, "fields", []);
            const attributeTemplate = await nsvc.attributeTemplateService.createAttributeTemplate(name, req.user.client, fields);
            res.status(201).json({
                result: "success",
                data: attributeTemplate._id
            });
        });
    })

// ############################################################################################################
// Modify attribute template
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['attributetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.attributeTemplatesAllowed) {
                res.json({
                    result: "failed",
                    error: "Attribute templates not enabled."
                });
                return;
            }

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, 'name');
            const fields = nsvc.verify.array(req, "fields");
            await nsvc.attributeTemplateService.updateAttributeTemplate(id, req.user.client, name, fields);
            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// Delete attribute template
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['attributetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.attributeTemplatesAllowed) {
                res.json({
                    result: "failed",
                    error: "Attribute templates not enabled."
                });
                return;
            }

            const id = nsvc.verify.objectId(req, "id");
            await nsvc.attributeTemplateService.deleteAttributeTemplate(id, req.user.client);
            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get specific attribute template
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.attributeTemplatesAllowed) {
                res.json({
                    result: "failed",
                    error: "Attribute templates not enabled."
                });
                return;
            }

            const id = nsvc.verify.toObjectId(req.params.id);
            const attributeTemplate = await nsvc.attributeTemplateService.getAttributeTemplate(id, req.user.client);
            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(attributeTemplate, [
                    "_id", "fields", "name", "createdAt", "updatedAt"
                ])
            });
        });
    })

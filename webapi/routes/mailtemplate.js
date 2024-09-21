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
const Busboy        = require("busboy");
const router        = express.Router();

module.exports = {
    path: "/api/mailtemplate",
    router: router,
    permissions: [
        { name: 'mailtemplate_admin', group: 'mailing', description: 'Administrate mail templates' }
    ]
};

// ############################################################################################################
// Get list of templates
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['mailtemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            if (!req.plan.mailingEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Mail templates not enabled."
                });
                return;
            }

            const templates = await nsvc.mailTemplateService.getTemplates(req.user.client);

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(templates, [
                    "_id", "name", "baseTemplate", "createdAt", "updatedAt", "createdBy", "updatedBy"
                ])
            });
        });
    })

// ############################################################################################################
// Create template
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['mailtemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.mailingEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Mail templates not enabled."
                });
                return;
            }

            const name = nsvc.verify.string(req, 'name');
            const subject = nsvc.verify.optionalString(req, 'subject', undefined, "");
            const text = nsvc.verify.optionalString(req, 'text', 100000, "");
            const baseTemplate = nsvc.verify.optionalObjectId(req, 'baseTemplate');

            const template = await nsvc.mailTemplateService.createTemplate(name, subject, text, baseTemplate, req.user.client, req.userObjectId);
            res.status(201).json({
                result: "success",
                data: template._id
            });
        });
    })

// ############################################################################################################
// Modify template
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['mailtemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.mailingEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Mail templates not enabled."
                });
                return;
            }

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, 'name');
            const subject = nsvc.verify.string(req, 'subject');
            const text = nsvc.verify.string(req, 'text', 100000);
            const baseTemplate = nsvc.verify.optionalObjectId(req, 'baseTemplate');

            await nsvc.mailTemplateService.updateTemplate(id, name, subject, text, baseTemplate, req.user.client, req.userObjectId);
            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// Delete template
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['mailtemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.mailingEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Mail templates not enabled."
                });
                return;
            }

            const id = nsvc.verify.objectId(req, "id");
            await nsvc.mailTemplateService.deleteTemplate(id, req.user.client, req.userObjectId);
            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Returns all mail templates that belong to the Nukleus client
// ############################################################################################################
router.route('/names')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            res.json({
                result: "success",
                data: await nsvc.mailTemplateService.getNukleusTemplateNames()
            });
        });
    });

// ############################################################################################################
// Get specific template
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['mailtemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.mailingEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Mail templates not enabled."
                });
                return;
            }

            const id = nsvc.verify.toObjectId(req.params.id);
            const template = await nsvc.mailTemplateService.getTemplate(id, req.user.client);

            const data = nsvc.common.ensureExactFieldsInObject(template,[
                "_id", "name", "subject", "text", "baseTemplate", "images", "createdAt", "updatedAt", "createdBy", "updatedBy"
            ]);

            // convert images map to array
            const images = [];
            if (data.images) {
                for (const key of data.images.keys()) {
                    const values = data.images.get(key).toObject();
                    values.name = key;
                    images.push(values);
                }
            }
            data.images = images;

            res.json({
                result: "success",
                data: data
            });
        });
    });

// ############################################################################################################
// Upload image
// ############################################################################################################
router.route('/image/:id/:name')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['mailtemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.mailingEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Mail templates not enabled."
                });
                return;
            }

            const id = nsvc.verify.toObjectId(req.params.id);
            const name = nsvc.verify.toString(req.params.name, "Name", 30);

            const busboy = new Busboy({ headers: req.headers, limits: {
                fileSize: 1024 * 1024,
                files: 1
            }});

            busboy.on('file', async function(fieldname, file, filename, encoding, mimetype) {

                const data = await nsvc.common.streamToBuffer(file);

                await nsvc.mailTemplateService.addImage(id, req.user.client, req.userObjectId, name, data);
                res.json({
                    result: "success"
                });

            });

            return req.pipe(busboy);
        });
    })

// ############################################################################################################
// Upload image
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['mailtemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.mailingEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Mail templates not enabled."
                });
                return;
            }

            const id = nsvc.verify.toObjectId(req.params.id);
            const name = nsvc.verify.toString(req.params.name, "Name", 30);

            await nsvc.mailTemplateService.removeImage(id, req.user.client, req.userObjectId, name);
            res.json({
                result: "success"
            });
        });
    })


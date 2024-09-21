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
    path: "/api/invoicetemplate",
    router: router,
    permissions: [
        { name: 'invoicetemplate_admin', group: 'payment', description: 'Administrate invoice templates' }
    ]
};

// ############################################################################################################
// Get list of templates
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoicetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            if (!req.plan.paymentEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Payment not enabled."
                });
                return;
            }

            const templates = await nsvc.invoiceTemplateService.getTemplates(req.user.client);

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
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoicetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.paymentEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Payment not enabled."
                });
                return;
            }

            const name = nsvc.verify.string(req, 'name');
            const text = nsvc.verify.string(req, 'text', 100000);
            const baseTemplate = nsvc.verify.optionalObjectId(req, 'baseTemplate');

            const template = await nsvc.invoiceTemplateService.createTemplate(name, text, baseTemplate, req.user.client, req.userObjectId);
            res.status(201).json({
                result: "success",
                data: template._id
            });
        });
    })

// ############################################################################################################
// Modify template
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoicetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.paymentEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Payment not enabled."
                });
                return;
            }

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, 'name');
            const text = nsvc.verify.string(req, 'text', 100000);
            const baseTemplate = nsvc.verify.optionalObjectId(req, 'baseTemplate');

            await nsvc.invoiceTemplateService.updateTemplate(id, name, text, baseTemplate, req.user.client, req.userObjectId);
            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// Delete template
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoicetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.paymentEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Payment not enabled."
                });
                return;
            }

            const id = nsvc.verify.objectId(req, "id");
            await nsvc.invoiceTemplateService.deleteTemplate(id, req.user.client, req.userObjectId);
            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get specific template
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoicetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.paymentEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Payment not enabled."
                });
                return;
            }

            const id = nsvc.verify.toObjectId(req.params.id);
            const template = await nsvc.invoiceTemplateService.getTemplate(id, req.user.client);

            const data = nsvc.common.ensureExactFieldsInObject(template,[
                "_id", "name", "text", "baseTemplate", "images", "createdAt", "updatedAt", "createdBy", "updatedBy"
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
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoicetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.paymentEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Payment not enabled."
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

                await nsvc.invoiceTemplateService.addImage(id, req.user.client, req.userObjectId, name, data);
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
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['invoicetemplate_admin'], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            if (!req.plan.paymentEnabled) {
                res.status(400).json({
                    result: "failed",
                    error: "Payment not enabled."
                });
                return;
            }

            const id = nsvc.verify.toObjectId(req.params.id);
            const name = nsvc.verify.toString(req.params.name, "Name", 30);

            await nsvc.invoiceTemplateService.removeImage(id, req.user.client, req.userObjectId, name);
            res.json({
                result: "success"
            });
        });
    })


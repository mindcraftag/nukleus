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
    path: "/api/page",
    router: router,
};


// ############################################################################################################
// Get list of all pages in the current client.
// Only accessible for page admins.
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["page_admin"], false), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Page = mongoose.model("Page");

            const pages = await Page.find({
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const returnedFields = ["_id", "title", "public"];

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(pages, returnedFields)
            });
        });
    })

    // ############################################################################################################
    // Create new page in current client. Only allowed for page admins.
    // ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["page_admin"], false), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const title = nsvc.verify.string(req, "title");
            const slug = nsvc.verify.string(req, "slug");

            const Page = mongoose.model("Page");

            const existingPage = await Page.findOne({
                client: req.user.client,
                deletedAt: {
                    $exists: false
                },
                $or: [{
                    title: title,
                }, {
                    slug: slug
                }]
            });

            if (existingPage) {
                res.status(400).json({
                    result: "failed",
                    error: "Page with this title or slug exists."
                });
                return;
            }

            await Page.create({
                title: title,
                slug: slug,
                client: req.user.client,
                content: "",
                public: false,
            });

            res.status(201).json({
                result: "success"
            });
        });
    })

    // ############################################################################################################
    // Modify page. Only allowed for page admins.
    // ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["page_admin"], false), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const id = nsvc.verify.objectId(req, "_id");
            const title = nsvc.verify.string(req, "title");
            const slug = nsvc.verify.string(req, "slug");
            const isPublic = nsvc.verify.boolean(req, "public");
            const content = nsvc.verify.optionalString(req, "content");

            const Page = mongoose.model("Page");

            const page = await Page.findOne({
                _id: id,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            if (!page) {
                res.status(404).json({
                    result: "failed",
                    error: "Page not found."
                });
                return;
            }

            const existingPage = await Page.findOne({
                _id: {
                    $ne: id
                },
                client: req.user.client,
                deletedAt: {
                    $exists: false
                },
                $or: [{
                    title: title,
                }, {
                    slug: slug
                }]
            });

            if (existingPage) {
                res.status(400).json({
                    result: "failed",
                    error: "Page with this title or slug exists."
                });
                return;
            }

            page.title = title;
            page.slug = slug;
            page.public = isPublic;
            page.content = content || "";

            await page.save();

            res.json({
                result: "success"
            });
        });
    })

    // ############################################################################################################
    // Delete page. Only allowed for page admins.
    // ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["page_admin", false]), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const id = nsvc.verify.objectId(req, "_id");

            const Page = mongoose.model("Page");

            const page = await Page.findOne({
                _id: id,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            if (!page) {
                res.status(404).json({
                    result: "failed",
                    error: "Page not found."
                });
                return;
            }

            page.deletedAt = new Date();
            await page.save();

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get a page by ID from a specific client.
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["page_admin"], false), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Page = mongoose.model("Page");

            const id = nsvc.verify.toObjectId(req.params.id);

            const page = await Page.findOne({
                _id: id,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            if (!page) {
                res.status(404).json({
                    result: "failed",
                    error: "Page not found."
                });
                return;
            }

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(page, ["_id", "title", "slug", "public", "content"])
            });
        });
    });


// ############################################################################################################
// Get a public page by slug from a specific client.
// ############################################################################################################
router.route('/public/:clientID/:slug')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Page = mongoose.model("Page");

            const clientID = nsvc.verify.toObjectId(req.params.clientID);
            const slug = nsvc.verify.toString(req.params.slug);

            const page = await Page.findOne({
                client: clientID,
                slug: slug,
                public: true,
                deletedAt: {
                    $exists: false
                }
            });

            if (!page) {
                res.status(404).json({
                    result: "failed",
                    error: "Page not found."
                });
                return;
            }

            const returnedFields = ["title", "slug", "content"];

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(page, returnedFields)
            });
        });
    });

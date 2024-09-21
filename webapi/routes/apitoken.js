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
    path: "/api/apitoken",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of all api tokens
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const apiTokens = await nsvc.accessTokenTools.getAccessTokens("Api", req.userObjectId);
            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(apiTokens, [
                    "_id", "name", "token", "enabled", "createdAt"
                ])
            });
        });
    })

// ############################################################################################################
// Create api token
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const name = nsvc.verify.string(req, 'name');
            const token = await nsvc.accessTokenTools.createAccessToken(name, "Api", null, req.userObjectId);
            res.status(201).json({
                result: "success",
                data: token._id
            });
        });
    })

// ############################################################################################################
// Delete token
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const id = nsvc.verify.objectId(req, "id");
            await nsvc.accessTokenTools.deleteAccessToken(id, "Api", req.userObjectId);
            res.json({
                result: "success"
            });
        });
    });

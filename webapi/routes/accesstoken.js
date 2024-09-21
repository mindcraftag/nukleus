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
const ValidationError = nsvc.exception.ValidationError;
const router = express.Router();

module.exports = {
    path: "/api/accesstoken",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of all access tokens of type JobAgent
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], {needsSuperAdmin: true}), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const accessTokens = await nsvc.accessTokenTools.getAccessTokens("JobAgent");
            res.json({
                result: "success",
                data: accessTokens
            });
        });
    })

// ############################################################################################################
// Create access token
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], {needsSuperAdmin: true}), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const name = nsvc.verify.string(req, 'name');
            const clientId = nsvc.verify.optionalObjectId(req, 'client');
            const token = await nsvc.accessTokenTools.createAccessToken(name, "JobAgent", clientId);
            res.status(201).json({
                result: "success",
                data: token._id
            });
        });
    })

// ############################################################################################################
// Delete token
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], {needsSuperAdmin: true}), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const id = nsvc.verify.objectId(req, "id");
            await nsvc.accessTokenTools.deleteAccessToken(id, "JobAgent");
            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Enable access token
// ############################################################################################################
router.route('/enable/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], {needsSuperAdmin: true}), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const id = nsvc.verify.toObjectId(req.params.id);
            await nsvc.accessTokenTools.enableAccessToken(id, "JobAgent");
            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Disable access token
// ############################################################################################################
router.route('/disable/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], {needsSuperAdmin: true}), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const id = nsvc.verify.toObjectId(req.params.id);
            await nsvc.accessTokenTools.disableAccessToken(id, "JobAgent");
            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get list of all access tokens of type JobAgent for a specific client
// ############################################################################################################
router.route('/client')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], {needsSuperAdmin: false}), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            let accessTokens = await nsvc.accessTokenTools.getAccessTokens("JobAgent");

            accessTokens = accessTokens.filter(token => token.client?.equals && token.client.equals(req.user.client));

            res.json({
                result: "success",
                data: accessTokens
            });
        });
    })

// ############################################################################################################
// Create access token for a specific client
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], {needsSuperAdmin: false}), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            console.log(req.user.client);
            if (!(await nsvc.clientService.hasFeature(req.user.client, "custom_jobagents"))) {
                throw new ValidationError("Client does not have the feature 'custom_jobagents' enabled");
            }

            const name = nsvc.verify.string(req, 'name');
            const token = await nsvc.accessTokenTools.createAccessToken(name, "JobAgent", req.user.client);
            res.status(201).json({
                result: "success",
                data: token._id
            });
        });
    })

// ############################################################################################################
// Delete an access token from a specific client
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], {needsSuperAdmin: false}), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            if (!(await nsvc.clientService.hasFeature(req.user.client, "custom_jobagents"))) {
                throw new ValidationError("Client does not have the feature 'custom_jobagents' enabled");
            }

            const id = nsvc.verify.objectId(req, "id");
            await nsvc.accessTokenTools.deleteAccessTokenInClient(id, "JobAgent", req.user.client);

            res.json({
                result: "success"
            });
        });
    });

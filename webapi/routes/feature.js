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
    path: "/api/feature",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of features for the user on the current client
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchClient: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let features;
            if (req.user.isAdmin()) {
                features = await nsvc.clientService.getEnabledFeatures(req.user.client);
            } else {
                // We only want the features that are enabled for the client and the user, but not the features that are only available
                // in certain groups, so we pass null as the groupId to getUserFeatures.
                const userFeatures = await nsvc.userService.getUserFeatures(req.user, null);
                features = await nsvc.clientService.getEnabledFeatures(req.user.client, true, userFeatures);
            }

            res.json({
                result: "success",
                data: features.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, ["name", "displayName"]);
                })
            });
        });
    })

// ############################################################################################################
// Get list of features for the current client
// ############################################################################################################
router.route('/onclient')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["user_admin"], { fetchClient: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const features = await nsvc.clientService.getEnabledFeatures(req.user.client);

            res.json({
                result: "success",
                data: features.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, ["name", "displayName"]);
                })
            });
        });
    })

// ############################################################################################################
// Get list of features for the current client
// ############################################################################################################
router.route('/onclientforall')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["user_admin"], { fetchClient: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const features = await nsvc.clientService.getEnabledFeatures(req.user.client, true, null, true);

            let mappedFeatures = null;
            if (features) {
                mappedFeatures = features.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, ["name", "displayName"]);
                })
            }

            res.json({
                result: "success",
                data: mappedFeatures
            });
        });
    })

// ############################################################################################################
// Get list of all features
// ############################################################################################################
router.route('/all')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const features = await nsvc.featureService.getFeatures();

            res.json({
                result: "success",
                data: features.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, ["name", "displayName"]);
                })
            });
        });
    })

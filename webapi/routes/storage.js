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
    path: "/api/storage",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of storages
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const storages = await nsvc.storageService.getStoragesInfo();
            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(storages, [
                    "_id", "name", "type", "location"
                ])
            });
        });
    })

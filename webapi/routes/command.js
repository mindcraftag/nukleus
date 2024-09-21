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
    path: "/api/command",
    router: router,
    permissions: []
};

// ############################################################################################################
// Create a new conversation
// ############################################################################################################
router.route('/')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const result = await nsvc.commandService.exec(req.body);

            res.json({
                result: "success",
                data: result
            });
        });
    })

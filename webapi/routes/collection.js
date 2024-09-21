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
    path: "/api/collection",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get my collections
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([]), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const collections = await nsvc.collectionService.getMyCollections(req.userObjectId, "user", req.client);

            res.json({
                result: "success",
                data: collections.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, [
                        "_id", "name", "public"
                    ]);
                })
            });
        });
    });


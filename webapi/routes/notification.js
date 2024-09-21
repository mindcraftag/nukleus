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
const mongoose      = nsvc.model.mongoose;
const router        = express.Router();

module.exports = {
    path: "/api/notification",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of my notifications
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const maxCount = req.query.maxCount ? parseInt(req.query.maxCount) : null;
            const notifications = await nsvc.notificationService.getMyNotifications(req.userObjectId, req.user.client, maxCount);
            res.json({
                result: "success",
                data: notifications
            });
        });
    })

// ############################################################################################################
// Mark notification as read
// ############################################################################################################
router.route('/markasread/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const notificationId = nsvc.verify.toObjectId(req.params.id);
            nsvc.notificationService.markAsRead(req.userObjectId, req.user.client, notificationId);
            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// Mark all notification as read
// ############################################################################################################
router.route('/markallasread')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            nsvc.notificationService.markAllAsRead(req.userObjectId, req.user.client);
            res.json({
                result: "success"
            });
        });
    })

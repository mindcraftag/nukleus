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
    path: "/api/conversation",
    router: router,
    permissions: []
};

const MAX_CONVERSATION_TEXT_LENGTH = 10000;

// ############################################################################################################
// Create a new conversation
// ############################################################################################################
router.route('/')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const parentId = nsvc.verify.objectId(req, "parentId");
            const parentType = nsvc.verify.string(req, "parentType");

            const conversation = await nsvc.conversationService.createConversation(req.client, req.plan, req.user, parentId, parentType);

            res.status(201).json({
                result: "success",
                data: conversation._id
            });
        });
    })

// ############################################################################################################
// Post message a specific conversation
// ############################################################################################################
router.route('/post')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "id");
            const replyTo = nsvc.verify.optionalObjectId(req, "replyTo");
            const text = nsvc.verify.string(req, "text", MAX_CONVERSATION_TEXT_LENGTH);

            const conversationEntry = await nsvc.conversationService.postMessage(id, req.client, req.plan, req.user, text, replyTo);

            res.json({
                result: "success",
                data: conversationEntry._id
            });
        });
    })

// ############################################################################################################
// Modify a message
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "id");
            const text = nsvc.verify.string(req, "text", MAX_CONVERSATION_TEXT_LENGTH);

            await nsvc.conversationService.editMessage(id, req.client, req.plan, req.user, text);

            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// delete a message
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "id");
            await nsvc.conversationService.deleteMessage(id, req.client, req.plan, req.user);

            res.json({
                result: "success"
            });
        });
    })

// ############################################################################################################
// Get a specific conversation
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const conversation = await nsvc.conversationService.getConversation(id, req.client, req.plan, req.user);

            if (conversation) {
                res.json({
                    result: "success",
                    data: conversation
                });
            } else {
                res.status(404).json({
                    result: "failed",
                    message: "conversation not found"
                });
            }
        });
    })

// ############################################################################################################
// Get a specific public conversation
// ############################################################################################################
router.route('/public/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const conversation = await nsvc.conversationService.getPublicConversation(id);

            if (conversation) {
                res.json({
                    result: "success",
                    data: conversation
                });
            } else {
                res.status(404).json({
                    result: "failed",
                    message: "conversation not found"
                });
            }
        });
    })

// ############################################################################################################
// Subscribe to a conversation
// ############################################################################################################
router.route('/subscribe')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.body.id);
            const success = await nsvc.conversationService.subscribeConversation(id, req.client._id, req.user._id);

            if (success) {
                res.json({
                    result: "success",
                });
            } else {
                res.status(404).json({
                    result: "failed",
                    error: "conversation not found"
                });
            }
        });
    });

// ############################################################################################################
// Unsubscribe from a conversation
// ############################################################################################################
router.route('/unsubscribe')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.body.id);
            const success = await nsvc.conversationService.unsubscribeConversation(id, req.client._id, req.user._id);

            if (success) {
                res.json({
                    result: "success",
                });
            } else {
                res.status(404).json({
                    result: "failed",
                    error: "conversation not found"
                });
            }
        });
    });

// ############################################################################################################
// Like a message
// ############################################################################################################
router.route('/like')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.body.id);
            await nsvc.conversationService.likeMessage(id, req.client, req.plan, req.user);

            res.json({
                result: "success",
            });
        });
    });

// ############################################################################################################
// Unlike a message
// ############################################################################################################
router.route('/unlike')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true}), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.body.id);
            await nsvc.conversationService.unlikeMessage(id, req.client, req.plan, req.user);

            res.json({
                result: "success",
            });
        });
    });

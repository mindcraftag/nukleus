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
    path: "/api/workflow",
    router: router,
    permissions: [
        { name: 'workflow_admin', group: 'client', description: 'Administrate workflows' }
    ]
};

const MAX_BPMN_LENGTH = 1024 * 1024 * 256; // 256KB should suffice for any Workflow

// ############################################################################################################
// Get list of workflows for that client
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const workflows = await nsvc.workflowService.listWorkflows(req.user.client, req.user.superadmin, "-bpmnXml");

            res.json({
                result: "success",
                data: workflows
            });
        });
    })

// ############################################################################################################
// Create workflow
// ############################################################################################################
.post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['workflow_admin']), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

        const name = nsvc.verify.string(req, "name");
        let global = nsvc.verify.optionalBoolean(req, "global", false);

        if (!req.user.superadmin)
            global = false;

        // Check for existence of other workflows with that name
        // -----------------------------------------------------
        if (await nsvc.workflowService.isNameConflict(name, global ? req.user.client : null)) {
            res.json({
                result: "failed",
                error: "Workflow with that name already exists"
            });
            return;
        }

        // Create new workflow
        // -----------------------------------------------------
        const Workflow = mongoose.model('Workflow');
        const workflow = new Workflow({
            name: name,
            client: global ? null : req.user.client
        });

        await workflow.save();

        res.status(201).json({
            result: "success",
            data: workflow._id
        });
    });
})

// ############################################################################################################
// Modify workflow
// ############################################################################################################
.put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['workflow_admin'], true), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

        const id = nsvc.verify.objectId(req, "_id");
        const name = nsvc.verify.string(req, "name");
        const bpmnXml = nsvc.verify.string(req, "bpmnXml", MAX_BPMN_LENGTH);

        const workflow = await nsvc.workflowService.findWorkflow(id, req.user.client, req.user.superadmin, "-bpmnXml");

        if (!workflow) {
            res.json({
                result: "failed",
                error: "Workflow not found"
            });
        }
        else {
            // Check for existence of other workflows with that name
            // -----------------------------------------------------
            if (workflow.name !== name && await nsvc.workflowService.isNameConflict(name, workflow.client)) {
                res.json({
                    result: "failed",
                    error: "Workflow with that name already exists"
                });
                return;
            }

            // Modify workflow
            // -----------------------------------------------------
            workflow.name = name;
            workflow.bpmnXml = bpmnXml;

            // Verify
            // -----------------------------------------------------
            await nsvc.workflowService.parseAndVerifyBpmnXml(workflow);

            await workflow.save();

            res.json({
                result: "success"
            });
        }
    });
})

// ############################################################################################################
// Delete workflow
// ############################################################################################################
.delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['workflow_admin'], true), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

        const id = nsvc.verify.objectId(req, "id");
        const workflow = await nsvc.workflowService.findWorkflow(id, req.user.client, req.user.superadmin, "-bpmnXml");

        if (!workflow) {
            res.json({
                result: "failed",
                error: "Workflow not found"
            });
        } else {

            workflow.deletedAt = new Date();
            await workflow.save();

            res.json({
                result: "success"
            });
        }
    });
});

// ############################################################################################################
// Get specific workflow
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["workflow_admin"], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const workflow = await nsvc.workflowService.findWorkflow(id, req.user.client, req.user.superadmin);

            if (!workflow) {
                res.json({
                    result: "failed",
                    error: "Workflow not found"
                });
            } else {
                res.json({
                    result: "success",
                    data: workflow
                });
            }
        });
    });

// ############################################################################################################
// Start workflow
// ############################################################################################################
router.route('/start')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "_id");
            const attachToItems = nsvc.verify.optionalObjectIdOrObjectIdArray(req, "attachToItems");
            const attachToFolders = nsvc.verify.optionalObjectIdOrObjectIdArray(req, "attachToFolders");

            const workflow = nsvc.workflowService.findWorkflow(id, req.user.client, req.user.admin, "");
            if (!workflow) {
                res.json({
                    result: "failed",
                    error: "Workflow not found"
                });
            } else {

                const workflowInstance = await nsvc.workflowService.createWorkflowInstance(workflow, attachToItems, attachToFolders, req.user);

                res.json({
                    result: "success",
                    data: workflowInstance._id
                });
            }
        });
    })

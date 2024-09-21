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
    path: "/api/datatype",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of datatypes for that client reduced to what the user may see
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let datatypes;
            if (req.user.isAdmin()) {
                datatypes = await nsvc.clientService.getEnabledDatatypes(req.user.client);
            } else {
                // We only want the datatypes that are enabled for the user, not the datatypes that are only available in certain groups.
                const userDatatypes = await nsvc.userService.getUserDatatypes(req.user, null);
                datatypes = await nsvc.clientService.getEnabledDatatypes(req.user.client, true, userDatatypes);
            }

            res.json({
                result: "success",
                data: datatypes.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, [
                        "_id", "name", "contentTypes", "fields", "createdAt", "updatedAt"
                    ]);
                })
            });
        });
    })

// ############################################################################################################
// Create datatype
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const name = nsvc.verify.string(req, "name");

            // Check for existence of other datatypes with that name
            // -----------------------------------------------------
            if (await nsvc.datatypeTools.isNameConflict(name)) {
                res.json({
                    result: "failed",
                    error: "Datatype with that name already exists"
                });
                return;
            }

            // Create new datatype
            // -----------------------------------------------------
            const DataType = mongoose.model('DataType');
            const dataType = new DataType({
                name: name,
                updateRequiresThumbRefresh: false
            });

            await dataType.save();

            res.status(201).json({
                result: "success",
                data: dataType._id
            });
        });
    })

// ############################################################################################################
// Modify datatype
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, "name");
            const contentTypes = nsvc.verify.stringArray(req, "contentTypes");
            const updateRequiresThumbRefresh = nsvc.verify.boolean(req, "updateRequiresThumbRefresh");
            const fields = req.body.fields;

            const DataType = mongoose.model('DataType');
            const dataType = await DataType.findOne({ _id: id }).exec();

            if (!dataType) {
                res.json({
                    result: "failed",
                    error: "Datatype not found"
                });
            }
            else {
                // Check for existence of other datatype with that name
                // -----------------------------------------------------
                if (dataType.name !== name && await nsvc.datatypeTools.isNameConflict(name)) {
                    res.json({
                        result: "failed",
                        error: "Datatype with that name already exists"
                    });
                    return;
                }

                // Verify the field definition
                // -----------------------------------------------------
                nsvc.datatypeTools.verifyFields(fields);

                // Modify datatype
                // -----------------------------------------------------
                dataType.name = name;
                dataType.contentTypes = contentTypes;
                dataType.fields = fields;
                dataType.updateRequiresThumbRefresh = updateRequiresThumbRefresh;

                await dataType.save();

                res.json({
                    result: "success"
                });
            }
        });
    })

// ############################################################################################################
// Delete datatype
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "id");

            const DataType = mongoose.model('DataType');
            await DataType.deleteMany({ _id: id }).exec();

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get list of datatypes for that client
// ############################################################################################################
router.route('/onclient')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["user_admin"]), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const datatypes = await nsvc.clientService.getEnabledDatatypes(req.user.client);

            res.json({
                result: "success",
                data: datatypes.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, [
                        "_id", "name", "contentTypes", "fields", "createdAt", "updatedAt"
                    ]);
                })
            });
        });
    })

// ############################################################################################################
// Get list of datatypes for that client which are enabled for all users/groups
// ############################################################################################################
router.route('/onclientforall')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["user_admin"]), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const datatypes = await nsvc.clientService.getEnabledDatatypes(req.user.client, true, null, true);

            let mappedDatatypes = null;
            if (datatypes) {
                mappedDatatypes = datatypes.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, [
                        "_id", "name", "contentTypes", "fields", "createdAt", "updatedAt"
                    ]);
                })
            }

            res.json({
                result: "success",
                data: mappedDatatypes
            });
        });
    })

// ############################################################################################################
// Get list of all datatypes
// ############################################################################################################
router.route('/all')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const DataType = mongoose.model("DataType");
            const dataTypes = await DataType.find().exec();

            const mappedDatatypes = dataTypes.map(function(i) {
                return {
                    _id: i._id,
                    name: i.name,
                    contentTypes: i.contentTypes,
                    updateRequiresThumbRefresh: i.updateRequiresThumbRefresh || false,
                    fieldCount: i.fields ? i.fields.length : 0,
                    createdAt: i.createdAt,
                    updatedAt: i.updatedAt
                };
            });

            res.json({
                result: "success",
                data: mappedDatatypes
            });
        });
    });

// ############################################################################################################
// Get specific datatype
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const DataType = mongoose.model("DataType");
            const dataType = await DataType.findOne({ _id: nsvc.verify.toObjectId(req.params.id)}).exec();

            if (!dataType) {
                res.json({
                    result: "failed",
                    error: "Datatype not found"
                });
            } else {
                res.json({
                    result: "success",
                    data: {
                        _id: dataType._id,
                        name: dataType.name,
                        contentTypes: dataType.contentTypes,
                        updateRequiresThumbRefresh: dataType.updateRequiresThumbRefresh || false,
                        fields: dataType.fields,
                        createdAt: dataType.createdAt,
                        updatedAt: dataType.updatedAt
                    }
                });
            }
        });
    });

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
    path: "/api/job",
    router: router,
    permissions: [
        { name: 'job_create', group: 'job', description: 'Create jobs' },
        { name: 'job_admin', group: 'job', description: 'Administrate jobs' }
    ]
};

// ############################################################################################################
// Get list of jobs
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let nextItem = null;

            if (req.query.nextItem !== undefined) {
                nextItem = nsvc.verify.toObjectId(req.query.nextItem);
            }

            let createdBy = null;
            if (!req.user.hasPermissions(['job_admin'])) {
                createdBy = req.userObjectId;
            }

            const data = await nsvc.jobService.getJobPaginated(req.user.client, createdBy, req.query.pageSize, nextItem);

            res.json({
                result: "success",
                data: data.jobs,
                next: data.nextObjectID
            });
        });
    })

// ############################################################################################################
// Create job
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['job_create']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const type = nsvc.verify.string(req, "type");
            const elements = nsvc.verify.array(req, "elements");
            const parameters = nsvc.verify.array(req, "parameters");

            const job = await nsvc.jobService.createJob(type, elements, parameters, req.user, req.user.client);

            res.status(201).json({
                result: "success",
                data: job._id
            });
        });
    });

// ############################################################################################################
// Get list of all job types
// ############################################################################################################
router.route('/types')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["job_admin"], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const JobType = mongoose.model('JobType');
            const jobTypes = await JobType.find().sort({ displayName: "asc" }).exec();

            const fields = [
                "_id", "name", "displayName", "elementMode", "client", "contentTypes", "types", "parameters",
                "manualStart", "interval"
            ];

            const mappedJobTypes = jobTypes.map(function(obj) {
                return nsvc.common.ensureExactFieldsInObject(obj, fields);
            });

            res.json({
                result: "success",
                data: mappedJobTypes
            });
        });
    });

// ############################################################################################################
// Get list of all job types
// ############################################################################################################
router.route('/manualtypes/all')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["job_admin"], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const JobType = mongoose.model('JobType');
            const jobTypes = await JobType.find({ manualStart: true }).sort({ displayName: "asc" }).exec();

            const fields = [
                "_id", "name", "displayName", "elementMode", "client", "contentTypes", "types", "parameters"
            ];

            const mappedJobTypes = jobTypes.map(function(obj) {
                return nsvc.common.ensureExactFieldsInObject(obj, fields);
            });

            res.json({
                result: "success",
                data: mappedJobTypes
            });
        });
    });

// ############################################################################################################
// Get list of all job types for a client
// ############################################################################################################
router.route('/manualtypes/all/:clientId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["job_admin"], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const clientId = nsvc.verify.toObjectId(req.params.clientId);
            const JobType = mongoose.model('JobType');
            const jobTypes = await JobType.find({
                manualStart: true,
                $or: [
                    { client: clientId },
                    { client: null },
                    { client: { $exists: false } },
                ]
            }).sort({ displayName: "asc" }).exec();

            const fields = [
                "_id", "name", "displayName", "elementMode", "client", "contentTypes", "types", "parameters"
            ];

            const mappedJobTypes = jobTypes.map(function(obj) {
                return nsvc.common.ensureExactFieldsInObject(obj, fields);
            });

            res.json({
                result: "success",
                data: mappedJobTypes
            });
        });
    });

// ############################################################################################################
// Get list of all job types on the client reduced to what the user can see
// ############################################################################################################
router.route('/manualtypes')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let jobTypes;
            if (req.user.isAdmin()) {
                jobTypes = await nsvc.clientService.getEnabledJobtypes(req.user.client);
            } else {
                // We only want the datatypes that are enabled for the user, not the datatypes that are only available in certain groups.
                const userJobtypes = await nsvc.userService.getUserDatatypes(req.user, null);
                jobTypes = await nsvc.clientService.getEnabledJobtypes(req.user.client, true, userJobtypes);
            }

            res.json({
                result: "success",
                data: jobTypes.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, [
                        "_id", "name", "displayName", "elementMode", "client", "contentTypes", "types", "parameters"
                    ])
                })
            });
        });
    });

// ############################################################################################################
// Get list of all manual job types on the client
// ############################################################################################################
router.route('/manualtypes/onclient')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["user_admin"]), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const jobTypes = await nsvc.clientService.getEnabledJobtypes(req.user.client);

            res.json({
                result: "success",
                data: jobTypes.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, [
                        "_id", "name", "displayName", "elementMode", "client", "contentTypes", "types", "parameters"
                    ])
                })
            });
        });
    });

// ############################################################################################################
// Get list of all manual job types on the client
// ############################################################################################################
router.route('/manualtypes/onclientforall')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["user_admin"]), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const jobTypes = await nsvc.clientService.getEnabledJobtypes(req.user.client, true, null, true);

            let mappedJobTypes = null;
            if (jobTypes) {
                mappedJobTypes = jobTypes.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, [
                        "_id", "name", "displayName", "elementMode", "client", "contentTypes", "types", "parameters"
                    ]);
                })
            }

            res.json({
                result: "success",
                data: mappedJobTypes
            });
        });
    });

// ############################################################################################################
// Get list of my jobs
// ############################################################################################################
router.route('/mine')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const Job = mongoose.model('Job');
            const jobs = await Job.aggregate()
                .match({ createdBy: req.userObjectId, client: req.user.client })
                .project({ type: 1, message: 1, state: 1, createdAt: 1, elementCount: { $size: '$elements'},
                    startedAt : 1, stoppedAt: 1 })
                .exec();

            res.json({
                result: "success",
                data: jobs
            });
        });
    });

// ############################################################################################################
// Get list of jobs
// ############################################################################################################
router.route('/aggregated')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let createdBy = null;

            if (!req.user.hasPermissions(['job_admin'])) {
                createdBy = req.userObjectId;
            }

            let nextItem = null;
            if (req.query.nextItem !== undefined) {
                nextItem = nsvc.verify.toObjectId(req.query.nextItem);
            }

            const data = await nsvc.jobService.getJobsAggregated(req.user.client, createdBy, req.query.pageSize, nextItem);

            res.json({
                result: "success",
                data: data.jobs,
                next: data.nextObjectID
            });
        });
    });

// ############################################################################################################
// Get list of all jobs including interval jobs in timerange
// ############################################################################################################
router.route('/all/:startDate/:endDate')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['job_admin'], { needsSuperAdmin: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const startDate = nsvc.verify.toDate(req.params.startDate);
            const endDate = nsvc.verify.toDate(req.params.endDate);

            const Job = mongoose.model('Job');
            const jobs = await Job.find({
                $and: [
                    { startedAt: { $gte: startDate }},
                    { startedAt: { $lte: endDate }}
                ],
                $or: [
                    { stoppedAt: { $exists: false }},
                    { $and: [
                            { stoppedAt: { $gte: startDate }},
                            { stoppedAt: { $lte: endDate }}
                        ]},
                ]
            }).exec();

            res.json({
                result: "success",
                data: jobs
            });
        });
    })

// ############################################################################################################
// Get list of all job types for a specific client
// ############################################################################################################
router.route('/clientTypes')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"]), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            res.json({
                result: "success",
                data: await nsvc.jobService.getClientJobTypes(req.user.client)
            });
        });
    });

// ############################################################################################################
// Get a specific job
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const jobId = nsvc.verify.toObjectId(req.params.id);

            const Job = mongoose.model('Job');
            const job = await Job.findOne({
                _id: jobId,
                client: req.user.client,
                createdBy: req.userObjectId
            }).exec();

            if (!job) {
                res.status(404).json({
                    result: "failed",
                    error: "Job not found"
                });
                return;
            }

            const fields = [
                "_id", "type", "state", "error", "log", "progress", "elements", "parameters", "startedAt",
                "stoppedAt", "attempts"
            ];

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(job, fields)
            });
        });
    });

// ############################################################################################################
// Get a specific job's state
// ############################################################################################################
router.route('/state/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const jobId = nsvc.verify.toObjectId(req.params.id);

            const Job = mongoose.model('Job');
            const job = await Job.findOne({
                _id: jobId,
                client: req.user.client,
                createdBy: req.userObjectId
            }).select("state error log progress startedAt stoppedAt attempts").exec();

            if (!job) {
                res.status(404).json({
                    result: "failed",
                    error: "Job not found"
                });
                return;
            }

            const fields = [
                "_id", "state", "error", "log", "progress", "startedAt", "stoppedAt", "attempts"
            ];

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(job, fields)
            });
        });
    });

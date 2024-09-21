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
  path: "/api/jobagent",
  router: router,
  permissions: [
    { name: 'job_admin', group: 'job', description: 'Administrate jobs' }
  ]
};

// ############################################################################################################
// Get list of all job agents
// ############################################################################################################
router.route('/')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["job_admin"], true), function (req, res) {
    nsvc.common.handleError(req, res,async function() {
      const JobAgent = mongoose.model('JobAgent');
      const jobAgents = await JobAgent.find().exec();

      res.json({
        result: "success",
        data: jobAgents
      });
    });
  });

// ############################################################################################################
// Get list of all job agents aggregated with job types
// ############################################################################################################
router.route('/aggregated')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["job_admin"], true), function (req, res) {
    nsvc.common.handleError(req, res,async function() {
      const JobAgent = mongoose.model('JobAgent');
      const aggregate = JobAgent.aggregate();

      aggregate.lookup({
        from: 'jobtypes', localField: 'jobTypes', foreignField: '_id', as: 'jobTypes'
      });
      aggregate.project("_id remoteHost name reconnects type version connectedAt disconnectedAt lastAlive usedToken sysinfo capabilities" +
      "totalJobCount successfulJobCount failedJobCount disabled connectCount location " +
      "jobTypes.name jobTypes.displayName jobTypes.elementMode jobTypes.manualStart jobTypes.interval jobTypes.watch jobTypes.contentTypes jobTypes.types ");

      const jobAgents = await aggregate.exec();

      res.json({
        result: "success",
        data: jobAgents
      });
    });
  });

// ############################################################################################################
// Enable job agent
// ############################################################################################################
router.route('/enable/:id')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["job_admin"], true), function (req, res) {
    nsvc.common.handleError(req, res,async function() {
      const JobAgent = mongoose.model('JobAgent');
      const jobAgent = await JobAgent.findOne({ _id: nsvc.verify.toObjectId(req.params.id) }).exec();

      if (jobAgent) {
        jobAgent.disabled = false;
        await jobAgent.save();

        res.json({
          result: "success"
        });
      }
      else {
        res.json({
          result: "failed",
          error: "jobagent not found"
        });
      }
    });
  });

// ############################################################################################################
// Disable job agent
// ############################################################################################################
router.route('/disable/:id')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["job_admin"], true), function (req, res) {
    nsvc.common.handleError(req, res,async function() {
      const JobAgent = mongoose.model('JobAgent');
      const jobAgent = await JobAgent.findOne({ _id: nsvc.verify.toObjectId(req.params.id) }).exec();

      if (jobAgent) {
        jobAgent.disabled = true;
        await jobAgent.save();

        res.json({
          result: "success"
        });
      }
      else {
        res.json({
          result: "failed",
          error: "jobagent not found"
        });
      }
    });
  });

// ############################################################################################################
// Restart job agent
// ############################################################################################################
router.route('/restart/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["job_admin"], true), function (req, res) {
      nsvc.common.handleError(req, res,async function() {
        const JobAgent = mongoose.model('JobAgent');
        const jobAgent = await JobAgent.findOne({ _id: nsvc.verify.toObjectId(req.params.id) }).exec();

        if (jobAgent) {
          jobAgent.restart = true;
          await jobAgent.save();

          res.json({
            result: "success"
          });
        }
        else {
          res.json({
            result: "failed",
            error: "jobagent not found"
          });
        }
      });
    });

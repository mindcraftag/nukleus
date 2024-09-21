"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;
const moment      = require('moment');

module.exports = {

    type: "Job",
    name: "Cleanup old jobs and agents",
    manualStart: false,
    interval: 'hourly',

    process: async function(tools, log) {
        const jobThreshold = moment().subtract(1, 'day');
        const agentThreshold = moment().subtract(30, 'minutes');

        // find all jobs and job agents that are older than the threshold and delete them
        // ----------------------------------------------------------------------------
        const Job = mongoose.model('Job');
        await Job.deleteMany({ createdAt: { $lt: jobThreshold }}).exec();

        const JobAgent = mongoose.model('JobAgent');
        await JobAgent.deleteMany({ $or: [
                { lastAlive: { $lt: agentThreshold } },
                { lastAlive: { $exists: false } }
        ]}).exec();

        // Make a list of all job Types that are in use
        // ----------------------------------------------------------------------------
        const jobAgents = await JobAgent.find().exec();
        const usedJobTypesMap = new Map();
        const usedJobTypes = [];
        for (const jobAgent of jobAgents) {
            for (const jobType of jobAgent.jobTypes) {
                if (!usedJobTypesMap.has(jobType.toString())) {
                    usedJobTypesMap.set(jobType.toString(), true);
                    usedJobTypes.push(jobType);
                }
            }
        }

        // find all jobtypes that do not have an agent anymore and delete them
        // ----------------------------------------------------------------------------
        const JobType = mongoose.model('JobType');
        JobType.deleteMany({ _id: { $nin: usedJobTypes }}).exec();

    }
};
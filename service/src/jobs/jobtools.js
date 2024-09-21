"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const config = require('../config');
const logger = require('../tools/logger');

let systemUserId = null;

// JOB PLUGIN FUNCTIONS
// --------------------------------------------------------------------------

function JobPluginFunctions(job, data) {
    this.job = job;
    this.data = data;
}

JobPluginFunctions.prototype.getApiToken = function() {
    return this.data ? this.data.api_token : null;
}

JobPluginFunctions.prototype.getApiUrl = function() {
    return this.data ? this.data.api_url : null;
}

JobPluginFunctions.prototype.getUserId = function() {
    return this.data ? this.data.user : null;
}

JobPluginFunctions.prototype.getClientId = function() {
    return this.data ? this.data.client : null;
}

JobPluginFunctions.prototype.getElements = function() {
    return this.data ? this.data.elements : null;
}

JobPluginFunctions.prototype.getParameters = function() {
    return this.data ? this.data.parameters : null;
}

JobPluginFunctions.prototype.getConfig = function() {
    return config;
}

JobPluginFunctions.prototype.getSystemUserId = function() {
    return this.job.createdBy;
}

JobPluginFunctions.prototype.getBatch = function() {
    return this.data ? this.data.batch : null;
}

JobPluginFunctions.prototype.sendProgress = function(percentage) {
    this.data.jobAgent.sendProgress(percentage);
}

// EXPORTS
// --------------------------------------------------------------------------

exports.setSystemUserId = function(id) {
    systemUserId = id;
};

exports.executeJobPluginNoCatch = async function(plugin, data) {
    const logLines = [];
    const jobPluginFunctions = new JobPluginFunctions({ createdBy: systemUserId }, data);
    await plugin.process(jobPluginFunctions, function (msg1, msg2) {
        const msg = msg2 !== undefined ? msg2 : msg1;
        const options = msg2 !== undefined ? msg1 : { severity: "info" };

        switch(options.severity) {
            case "jobLog":
                logLines.push(msg.toString());
                break;
            case "info":
                logger.info(`${plugin.name}: ${msg.toString()}`);
                break;
            case "warning":
                logger.warn(`${plugin.name}: ${msg.toString()}`);
                break;
            case "error":
                logger.error(`${plugin.name}: ${msg.toString()}`);
                break;
            case "debug":
                logger.debug(`${plugin.name}: ${msg.toString()}`);
                break;
            default:
                logger.info(`${plugin.name}: ${msg.toString()}`);
                break;
        }
    });

    return logLines.join('\n');
};

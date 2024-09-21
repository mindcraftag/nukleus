"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const ValidationError   = require('../exception.js').ValidationError;
const limiting          = require('../middleware/limiting');
const statsService      = require('./statsService');
const itemService       = require('./itemService');
const ensureDbContent   = require('../tools/ensureDbContent');

exports.exec = async function(params) {
    if (!params.command)
        throw new ValidationError("Missing command type");

    switch(params.command) {
        case "getDataConsistencyReport":
            return ensureDbContent.getDataConsistencyReport();

        case "getRateLimiterEntries":
            return limiting.getRedisEntries();

        case "getStats":
            return statsService.exec(params);

        case "getItemQuotaUser":
            return itemService.getQuotaUser(params.id);

        case "cleanAdditionalFilesFromBuckets":
            return ensureDbContent.cleanAdditionalFilesFromBuckets();

        default:
            throw new ValidationError("Unknown command type");
    }
}

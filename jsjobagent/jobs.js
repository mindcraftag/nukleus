"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fs        = require('fs');
const path      = require('path');
const logger    = require('@mindcraftgmbh/nukleus-service').logger;

const jobs = [];

exports.getList = function() {
    return jobs;
};

exports.init = function() {

    const jobsPath = __dirname + "/jobs";
    fs.readdirSync(jobsPath)
        .filter(function (file) {
            return (file.indexOf(".") !== 0) && (file !== "index.js");
        })
        .forEach(function (file) {
            jobs.push(require(path.join(jobsPath, file)));
        });

    logger.info("Found jobs:" + jobs.length);
};
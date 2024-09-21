"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fs = require("fs");

let config = {
    load: function(filePath, log) {
        filePath = filePath || "../config/config.json";

        try {
            if (fs.existsSync(filePath)) {
                if (log) log.info(`Configuration at ${filePath} found. Reading.`);
                const configJson = JSON.parse(fs.readFileSync(filePath).toString());
                Object.assign(this, configJson);
            } else {
                if (log) log.info(`Configuration at ${filePath} does not exist.`);
            }
        }
        catch(err) {
            if (log) log.error(`Error reading configuration from ${filePath}: ${err}`);
        }
    }
};

module.exports = config;
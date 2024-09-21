"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const logdna = require('@logdna/logger')

let hooks = [];
let logger;

function _log(severity, message, ...params) {
    if (hooks.length) {
        for(const hook of hooks) {
            hook(severity, message, ...params);
        }
    } else{
        switch(severity) {
            case "info": console.log(message, ...params); break;
            case "warn": console.warn(message, ...params); break;
            case "error": console.error(message, ...params); break;
            case "debug": console.debug(message, ...params); break;
        }
    }

    if (logger) {
        logger.log(message, {
            level: severity,
            meta: {
                params: [...params]
            }
        });
    }
}

exports.initLogDna = function(config) {
    logger = logdna.createLogger(config.key, config.options);
};

exports.hook = function(func) {
    hooks.push(func);
};

exports.info = function(message, ...params) {
    _log("info", message, ...params);
};

exports.warn = function(message, ...params) {
    _log("warn", message, ...params);
};

exports.error = function(message, ...params) {
    _log("error", message, ...params);
};

exports.debug = function(message, ...params) {
    _log("debug", message, ...params);
};
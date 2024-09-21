"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose      = require('@mindcraftgmbh/nukleus-model').mongoose;
const logger        = require('./tools/logger');
const exception     = require('./exception');
const Readable      = require('stream').Readable;
const config        = require('./config');

/**
 * Send an 401 error, meaning permission is denied
 * @param res
 */
exports.sendError403 = function(res) {
    res.status(403).json({
        result: "failed",
        error: "Permission denied"
    });
}

/**
 * Send a 403 error with quota exceeded message
 * @param res
 */
exports.sendError403QuotaExceeded = function(res) {
    res.status(403).json({
        result: "failed",
        error: "Quota exceeded"
    });
}

/**
 * Send a 400 error meaning the request the client sent was malformed
 * @param res
 * @param err
 */
exports.sendError400 = function(res, err) {
    const what = err ? err.toString() : "unknown error";
    res.status(400).json({
        result: "failed",
        error: what
    });
}

/**
 * Send a 500 error message, meaning it was an internal server error. Also log this error
 * @param req
 * @param res
 * @param err
 */
exports.sendError500 = function(req, res, err) {
    res.status(500).json({
        result: "failed",
        error: "internal server error"
    });

    const who = req.user ? req.user.account : "anonymous";
    const where = `${req.method} ${req.baseUrl}${req.route.path}`;
    const what = err ? err.toString() : "unknown error";

    // Collect some additional information about the error.
    // -------------------------------------------------------------
    let info = "";

    // If the error has a stacktrace, add it to the log.
    if (err?.stack) {
        info += "\nStack: " + err.stack;
    }
    
    // If we're running in a dev environment, add the first 10000 characters of the body of the request.
    if (config?.server?.environment === "DEV") {
        info += "\nRequest Body: " + JSON.stringify(req.body).substring(0, 10000);
    }

    logger.error(`${who} - ${where} - ${what}` + info);
}

/**
 * This method handles all errors that might be thrown by the submitted func when it is called
 * @param req
 * @param res
 * @param func
 * @returns {Promise<void>}
 */
exports.handleError = async function(req, res, func) {
    try {
        if ((req.method === 'POST' || req.method === "PUT" || req.method === 'DELETE') && (typeof req.body !== 'object'))
            exports.sendError400(res, "Body is undefined.");
        else
            await func();
    }
    catch(err) {
        if (err instanceof exception.PermissionDeniedError) {
            exports.sendError403(res);
        } else if (err instanceof exception.QuotaExceededError) {
            exports.sendError403QuotaExceeded(res);
        } else if (err instanceof exception.ValidationError) {
            exports.sendError400(res, err);
        } else {
            exports.sendError500(req, res, err);
        }
    }
};

exports.withTransaction = async function(func) {
    let session = await mongoose.startSession();
    return session.withTransaction(func);
};

function filterObjectInternal(obj, addKeys, removeKeys) {
    let result = {};

    if (addKeys.length > 0 && removeKeys.length > 0) {
        throw "Either exclude fields or specify which keys to copy. Not both!";
    } else if (addKeys.length > 0) {
        for (const key in obj) {
            if (obj.hasOwnProperty(key) && addKeys.includes(key)) {
                result[key] = obj[key];
            }
        }
    } else {
        for (const key in obj) {
            if (obj.hasOwnProperty(key) && !removeKeys.includes(key)) {
                result[key] = obj[key];
            }
        }
    }

    return result;
}

exports.filterObjects = function(arr, keys) {

    let result = [];

    const allKeys = keys.split(" ");
    if (allKeys.length === 0) {
        throw "No keys specified!";
    }

    const addKeys = allKeys.filter(x => !x.startsWith("-"));
    const removeKeys = allKeys.filter(x => x.startsWith("-"));

    for(const obj of arr) {
        result.push(filterObjectInternal(obj, addKeys, removeKeys));
    }

    return result;
};

exports.filterObject = function(obj, keys) {
    const allKeys = keys.split(" ");
    if (allKeys.length === 0) {
        throw "No keys specified!";
    }

    const addKeys = allKeys.filter(x => !x.startsWith("-"));
    const removeKeys = allKeys.filter(x => x.startsWith("-"));

    return filterObjectInternal(obj, addKeys, removeKeys);
};

exports.arrayRemove = function(arr, value) {
    return arr.filter(function(ele){
        return ele !== value;
    });
};

exports.sleep = function(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
};

exports.bufferToStream = function(buffer) {
    const stream = new Readable();
    stream._read = () => {};
    stream.push(buffer);
    stream.push(null);
    return stream;
}

exports.streamToBuffer = async function(stream) {
    return new Promise(((resolve, reject) => {
        const bufs = [];
        stream.on('data', function(d) {
            bufs.push(d);
        });
        stream.on('end', function(){
            resolve(Buffer.concat(bufs));
        });
        stream.on('error', function(err){
            reject(err);
        });
    }));
}

exports.ensureExactFieldsInArray = function(array, fields, isRecursiveItem) {
    return array.map((object) => {
        return exports.ensureExactFieldsInObject(object, fields, isRecursiveItem);
    });
}

exports.ensureExactFieldsInObject = function(object, fields, isRecursiveItem) {
    const result = {};
    for (const field of fields) {
        let value = object[field];
        if (isRecursiveItem && field === "links" && Array.isArray(value)) {
            for (const link of value) {
                if (link.item) {
                    link.item = exports.ensureExactFieldsInObject(link.item, fields, true);
                }
            }
        }
        result[field] = value === undefined ? null : value;
    }
    return result;
}

Array.prototype.removeObject = function(object) {
    const index = this.indexOf(object);
    if (index > -1) {
        this.splice(index, 1);
        return true;
    }
    return false;
};

Array.prototype.clone = function() {
    const clone = [];
    for (const entry of this) {
        clone.push(entry);
    }
    return clone;
};

Array.prototype.alphabeticSort = function() {
    this.sort(function(a, b) { return a.localeCompare(b); });
    return this;
}

Array.prototype.unique = function() {
    const m = new Map();
    for (const entry of this) {
        m.set(entry, true);
    }
    return Array.from(m.keys());
}

String.prototype.isAlphaNumeric = function() {
    return this.match(/^[0-9A-Za-z]+$/);
}

String.prototype.camelize = function () {
    return this.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word) {
        return word.toUpperCase();
    }).replace(/\s+/g, '');
}

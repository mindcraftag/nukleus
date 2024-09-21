"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const { EJSON } = require('bson');

function isObject(v) {
    return '[object Object]' === Object.prototype.toString.call(v);
}

exports.parseEjson = function(str) {
    return EJSON.parse(str);
}

exports.sortJson = function(o) {
    if (!o)
        return o;

    if (isObject(o)) {
        const keys = Object.keys(o);
        keys.sort()
        o = keys.reduce(function (a, k) {
            a[k] = exports.sortJson(o[k]);
            return a;
        }, {});
    }
    else if (Array.isArray(o)) {
        for (const prop in o) {
            o[prop] = exports.sortJson(o[prop]);
        }
    }

    return o;
}

exports.exportEjsonDocument = function(obj, sortFields, indent, filterTimestamps, convertNumberStringsToNumbers) {

    const ejson = EJSON.stringify(obj, undefined, indent, { relaxed: true });

    if (!filterTimestamps && !sortFields)
        return ejson;

    let newObj = JSON.parse(ejson);

    if (filterTimestamps) {
        exports.filterExcludeFields(newObj, ['updatedAt', "createdAt"]);
    }

    if (sortFields) {
        newObj = exports.sortJson(newObj);
    }

    if (convertNumberStringsToNumbers) {
        exports.convertNumberStringsToNumbers(newObj);
    }

    return JSON.stringify(newObj, null, indent);

}

exports.convertNumberStringsToNumbers = function(obj) {
    if (!obj)
        return;

    if (typeof obj !== "object")
        return;

    for (let prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            if (typeof obj[prop] === 'string') {
                const str = obj[prop];

                if(str.match(/^-?\d+$/)) {
                    obj[prop] = parseInt(str);
                } else if(str.match(/^\d+\.\d+$/)) {
                    obj[prop] = parseFloat(str);
                }
            }

            if (isObject(obj[prop]) || Array.isArray(obj[prop]))
                exports.convertNumberStringsToNumbers(obj[prop]);
        }
    }
}

exports.filterExcludeFields = function(obj, fieldsArray) {

    if (!obj)
        return;

    if (typeof obj !== "object")
        return;

    for (const field of fieldsArray) {
        if (obj[field])
            delete obj[field];
    }

    for (let prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            const p = obj[prop];
            exports.filterExcludeFields(p, fieldsArray);
        }
    }

}

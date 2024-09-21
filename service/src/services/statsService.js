"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose            = require('@mindcraftgmbh/nukleus-model').mongoose;
const { ValidationError } = require('../exception');

exports.exec = async function(params) {
    switch(params.type) {
        case "callsAndTransfers":
            return exports.getCallsAndTransfers(params.year, params.month);

        case "requestLocations":
            return exports.getRequestLocations(params.year, params.month);

        default:
            throw new ValidationError("Unknown stat type: " + params.type);
    }
}

exports.getCallsAndTransfers = async function(year, month) {

    const ApiRequest = mongoose.model('ApiRequest');
    const result = await ApiRequest.aggregate([
        {
            "$match": {
                "year": year,
                "month": month
            }
        },
        {
            "$group": {
                "_id": {
                    "year": "$year",
                    "month": "$month",
                    "day": "$day"
                },
                "calls": {
                    "$sum": 1.0
                },
                "bytes": {
                    "$sum": "$bytes"
                }
            }
        },
        {
            "$sort": {
                "_id.day": 1.0
            }
        }
    ]).exec();

    return result;
}

exports.getRequestLocations = async function(year, month) {

    const ApiRequest = mongoose.model('ApiRequest');
    const result = await ApiRequest.aggregate([
        {
            "$match": {
                "year": year,
                "month": month
            }
        },
        {
            "$group": {
                "_id" : "$location.country",
                "calls" : {
                    "$sum" : 1.0
                },
                "bytes" : {
                    "$sum" : "$bytes"
                }
            }
        },
        {
            "$sort": {
                "calls": -1
            }
        }
    ]).exec();

    return result;
}

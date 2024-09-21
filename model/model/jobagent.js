"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose = require('mongoose');

exports.init = function(log) {
    const collectionName = "JobAgent";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        name: String,
        remoteHost: String,
        type: String,
        version: String,
        sysinfo: mongoose.Schema.Types.Mixed,
        capabilities: mongoose.Schema.Types.Mixed,
        reconnects: Number,

        usedToken: { type: mongoose.Schema.Types.ObjectId, ref: 'AccessToken' },
        jobTypes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JobType' }],

        allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        allocatedFor: String,
        allocatedAt: Date,

        connectedAt: Date,
        disconnectedAt: Date,
        lastAlive: Date,

        totalJobCount: Number,
        successfulJobCount: Number,
        failedJobCount: Number,
        disabled: Boolean,
        connectCount: Number,
        connectionId: String,
        restart: Boolean,

        location: {
            longitude: Number,
            latitude: Number,
            country: String,
            region: String
        }
    }, {
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({remoteHost: 1}, {unique: true});
    };

    // -----------------------------------------------------------------------
    //  Eventhandler
    // -----------------------------------------------------------------------
    mongoose.model(collectionName, schema).on('index', function(err) {
        if (err) {
            log.error(`Indexing error: ${collectionName}: ${err}`);
        } else {
            log.info(`Indexing complete: ${collectionName}`);
        }
    });
}


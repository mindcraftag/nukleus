"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose  = require('mongoose');

exports.JobState = {
    Pending: 0,
    Running: 1,
    Failed: 2,
    Succeeded: 3
}

exports.init = function(log) {
    const collectionName = "Job";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        type: String,
        state: Number, //  0 = pending, 1 = running, 2 = failed, 3 = succeeded
        error: String,
        log: String,
        progress: Number,
        elements: [mongoose.Schema.Types.Mixed],
        parameters: {
            type: Map,
            of: String
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
        startedAt: Date,
        stoppedAt: Date,
        runningTimeMs: Number,
        attempts: Number,
        jobAgent: String,
        batchData: mongoose.Schema.Types.Mixed
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({client: 1});
        schema.index({createdBy: 1});
        schema.index({startedAt: 1});
        schema.index({stoppedAt: 1});
        schema.index({jobAgent: 1});
        schema.index({state: 1});
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


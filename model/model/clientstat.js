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

exports.init = function(log) {
    const collectionName = "ClientStat";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
        plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
        year: Number,
        month: Number,
        day: Number,
        hour: Number,
        metrics: {
            publicDownloadCount: { type: Number, default: 0 },
            publicDownloadBytes: { type: Number, default: 0 },
            secureDownloadCount: { type: Number, default: 0 },
            secureDownloadBytes: { type: Number, default: 0 },
            uploadCount: { type: Number, default: 0 },
            uploadBytes: { type: Number, default: 0 },
            storedCount: { type: Number, default: 0 },
            storedBytes: { type: Number, default: 0 },
            jobExecutions: { type: Map, of: mongoose.Schema.Types.Mixed }
        }
    }, {
        timestamps: false,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({client: 1, year: 1, month: 1, day: 1, hour: 1}, {unique: true});
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


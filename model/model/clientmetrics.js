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
    const collectionName = "ClientMetrics";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },

        // Metrics
        // ----------------------------------------------------------------------
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
        },
        refMetrics: {
            trafficBytes: { type: Number, default: 0 },
            trafficCount: { type: Number, default: 0 }
        },

    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({client: 1}, {unique: true});
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


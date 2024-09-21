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
    const collectionName = "ApiRequest";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({

        // Origin and destination
        // -----------------------------------------------------------------
        ip: String,
        path: String,
        method: String,
        status: Number,

        // When
        // -----------------------------------------------------------------
        year: Number,
        month: Number,
        day: Number,
        hour: Number,
        minute: Number,
        date: Date,

        // Location
        // -----------------------------------------------------------------
        location: {
          longitude: Number,
          latitude: Number,
          country: String,
          region: String
        },

        // Who
        // -----------------------------------------------------------------
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

        // Traffic assigned to
        // -----------------------------------------------------------------
        requestedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        quotaUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        quotaGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
        trafficProcessed: Boolean,

        // How much
        // -----------------------------------------------------------------
        bytes: Number,
        timeMs: Number

    }, {
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({ip: 1});
        schema.index({path: 1});
        schema.index({method: 1});
        schema.index({status: 1});
        schema.index({date: 1});
        schema.index({year: 1});
        schema.index({month: 1});
        schema.index({day: 1});
        schema.index({hour: 1});
        schema.index({minute: 1});
        schema.index({client: 1});
        schema.index({user: 1});
        schema.index({requestedItem: 1});
        schema.index({quotaUser: 1});
        schema.index({quotaGroup: 1});
        schema.index({location: 1});
        schema.index({trafficProcessed: 1});
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


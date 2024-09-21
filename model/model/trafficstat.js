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
    const collectionName = "TrafficStat";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({

        // What are we storing the traffic for. Client always needs to be set and one of item/user/group
        // -----------------------------------------------------------------------------
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: false },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
        group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: false },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },

        // For when are we storing the traffic. We store per hour
        // -----------------------------------------------------------------------------
        year: Number,
        month: Number,
        day: Number,
        hour: Number,

        // How much traffic did we get and also how many requests
        // -----------------------------------------------------------------------------
        bytes: Number,
        calls: Number

    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({item: 1});
        schema.index({user: 1});
        schema.index({group: 1});
        schema.index({client: 1});

        schema.index({year: 1});
        schema.index({month: 1});
        schema.index({day: 1});
        schema.index({hour: 1});
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


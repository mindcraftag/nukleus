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
    const collectionName = "Conversation";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        internal: Boolean,
        // The conversation should be saved in the same location as the item it's attached to.
        location: { type: String, required: true, default: "CHE" },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
        parent: mongoose.Schema.Types.ObjectId,
        parentType: String,
        subscribedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        deletedAt: Date
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({client: 1});
        schema.index({subscribedUsers: 1});
        schema.index({deletedAt: 1});
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


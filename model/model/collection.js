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
    const collectionName = "Collection";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        name: String,
        public: Boolean,
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
        ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        ownerGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
        items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
        deletedAt: Date
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({name: 1, client: 1, deletedAt: 1}, {unique: true});
        schema.index({client: 1});
        schema.index({ownerUser: 1});
        schema.index({ownerGroup: 1});
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


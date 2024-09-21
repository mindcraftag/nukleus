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
    const collectionName = "Purchasable";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        name: String,
        description: String,
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
        public: { type: Boolean, default: false },
        pricesContainVat: { type: Boolean, default: false },

        options: [{
            name: String,
            prices: {
                type: Map,
                of: Number
            },
            interval: String
        }],

        groupId: String,
        activationActions: [mongoose.Schema.Types.Mixed],
        deactivationActions: [mongoose.Schema.Types.Mixed],

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: Date
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({name: 1});
        schema.index({client: 1});
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


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
    const collectionName = "Purchase";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        purchasable: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchasable' },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
        option: { type: mongoose.Schema.Types.ObjectId },
        // Purchases should be saved in the same location as their user.
        location: { type: String, required: true, default: "CHE" },
        active: Boolean,
        canceledAt: Date,
        cancellationReason: String,
        remainingNetValue: Number,
        cancelGracePeriodUntil: Date,
        paidUntil: Date,
        paymentHistory: [{
            date: Date,
            invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
        }]
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({purchasable: 1});
        schema.index({user: 1});
        schema.index({option: 1});
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


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
    const collectionName = "Audit";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        objectType: String,
        objectId: { type: mongoose.Schema.Types.ObjectId },
        changes: [mongoose.Schema.Types.Mixed],
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({objectType: 1});
        schema.index({objectId: 1});
        schema.index({client: 1});
    }

    module.exports = mongoose.model(collectionName, schema);
}


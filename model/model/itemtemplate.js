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
    const collectionName = "ItemTemplate";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        name: { type: String, required: true },
        type: { type: String, required: true },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
        rootItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
        folders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Folder' }]
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({ name: 1, type: 1 }, {unique: true});
        schema.index({ client: 1 });
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


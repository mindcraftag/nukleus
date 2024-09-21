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

// By default, an empty string is not allowed for a required string field.
// But for the content an empty string is a valid value.
function requireStringType() {
    return typeof this.content === 'string' ? false : true;
}

exports.init = function (log) {
    const collectionName = "Page";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        title: { type: String, required: true },
        slug: { type: String, required: true },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
        content: { type: String, required: requireStringType },
        public: { type: Boolean, required: true },
        deletedAt: Date,
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Eventhandler
    // -----------------------------------------------------------------------
    mongoose.model(collectionName, schema).on('index', function (err) {
        if (err) {
            log.error(`Indexing error: ${collectionName}: ${err}`);
        } else {
            log.info(`Indexing complete: ${collectionName}`);
        }
    });
}

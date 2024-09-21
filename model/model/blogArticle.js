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
    return typeof this.myField === 'string' ? true : false;
}

exports.init = function (log) {
    const collectionName = "BlogArticle";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        title: { type: String, required: true },
        blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true },
        tags: { type: [String], required: true },
        content: { type: String, required: requireStringType },
        public: { type: Boolean, required: true },
        conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
        slug: String,
        // A BSON document can be at most 16MB in size, an ObjectID is 12 bytes, so this array can hold 1.3M user views.
        viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        deletedAt: Date,
        publishedAt: Date,
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

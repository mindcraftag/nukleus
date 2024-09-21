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
    const collectionName = "ConversationEntry";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
        // The conversation entry should be saved in the same location as the user that created it.
        location: { type: String, required: true, default: "CHE" },
        replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ConversationEntry' },
        text: String,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        deletedAt: Date,
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({conversation: 1});
        schema.index({createdBy: 1});
        schema.index({taggedUsers: 1});
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


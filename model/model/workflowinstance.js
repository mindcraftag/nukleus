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
    const collectionName = "WorkflowInstance";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
        attachedToItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
        attachedToFolders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Folder' }],
        state: Number, // 0 = started, 1 = waiting for user, 2 = waiting for processing, 3 = done, 4 = failed
        graph: mongoose.Schema.Types.Mixed,
        currentStep: String
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({workflow: 1});
        schema.index({client: 1});
        schema.index({state: 1});
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


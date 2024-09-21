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
    const collectionName = "Workflow";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        name: String,
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
        deletedAt: Date,
        bpmnXml: String,
        graph: mongoose.Schema.Types.Mixed,
        parameters: [mongoose.Schema.Types.Mixed]
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({name: 1, client: 1}, {unique: true});
        schema.index({client: 1});
        schema.index({name: 1});
    };

    // -----------------------------------------------------------------------
    //  Statics
    // -----------------------------------------------------------------------
    schema.statics.existsByNameAndClient = async function(name, client) {
        return await this.model(collectionName).find({ name: name, client: client }).limit(1).count(true) > 0;
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


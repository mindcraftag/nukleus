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
    const collectionName = "Folder";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        name: String,
        parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
        // Normal folders should be saved in the same location as their parent folder,
        // user and group folders should be in the location of the user or group.
        location: { type: String, required: true, default: "CHE" },
        nextLocation: { type: String, required: false },

        // If set, then only admins and superadmins will be able to see the size of this folder.
        hideSize: { type: Boolean, default: false, required: false },

        hidden: { type: Boolean, default: false },
        immutable: { type: Boolean, default: false },
        contentSize: Number,
        recalculateContentSize: Boolean,

        acl: [{
            group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            can: [String]
        }],

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
        schema.index({parent: 1, name: 1, client: 1, deletedAt: 1}, {unique: true});
        schema.index({name: 1});
        schema.index({parent: 1});
        schema.index({client: 1});
        schema.index({deletedAt: 1});
    };

    // -----------------------------------------------------------------------
    //  Statics
    // -----------------------------------------------------------------------
    schema.statics.existsById = async function(id) {
        return await this.model(collectionName).find({ _id: id }).limit(1).count(true) > 0;
    };

    schema.statics.existsByIdAndClient = async function(id, client) {
        return await this.model(collectionName).find({ _id: id, client: client, deletedAt: { $exists: false } }).limit(1).count(true) > 0;
    };

    schema.statics.existsByNameFolderAndClient = async function(name, parent, client) {
        return await this.model(collectionName).find({ name: name, parent: parent, client: client, deletedAt: { $exists: false } }).limit(1).count(true) > 0;
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


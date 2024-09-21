"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose              = require('mongoose');
const fs                    = require('fs');
const path                  = require('path');
const { ItemVisibility }    = require("./model/item");
const { JobState }          = require("./model/job");
const { ConversationMode, DraftMode }  = require("./model/client");
const ReadPreference        = require('mongodb-core').ReadPreference;

let _log = null, folderChangeStream = null, itemChangeStream = null;

exports.mongoose = mongoose;

exports.ReadPreference = ReadPreference;

exports.ItemVisibility = ItemVisibility;
exports.JobState = JobState;
exports.ConversationMode = ConversationMode;
exports.DraftMode = DraftMode;

exports.watchChanges = function(name, func) {
    if (_log) _log.info(`Watching changes in model ${name}`);
    const Model = mongoose.model(name);
    return Model.watch().on('change', function(data) {
        func(data);
    });
};

exports.init = async function(config, log) {

    _log = log;

    //mongoose.set('debug', true);

    if (!config.database.url) {
        if (_log) _log.error("No database connection specified!");
        return;
    }

    let isConnectedBefore = false;

    // Create Mongoose Hooks
    // ----------------------------------------------------------
    mongoose.connection.on('error', function() {
        if (_log) _log.error('Could not connect to MongoDB');
    });

    mongoose.connection.on('disconnected', function(){
        if (_log) _log.error('Lost MongoDB connection...');
        if (!isConnectedBefore)
            connect();
    });
    mongoose.connection.on('connected', function() {
        isConnectedBefore = true;
        if (_log) _log.info('Connection established to MongoDB');
    });

    mongoose.connection.on('reconnected', function() {
        if (_log) _log.info('Reconnected to MongoDB');
    });

    process.on('SIGINT', function() {
        mongoose.connection.close(true);
    });

    // Connect to database
    // ----------------------------------------------------------
    const connect = async function() {
        return mongoose.connect(config.database.url, {
            tlsInsecure: true
        });
    };

    try {
        await connect();
    }
    catch(err) {
        // make sure the reconnects do not happen and throw the error
        isConnectedBefore = true;
        throw err;
    }

    // Scan for model
    // ----------------------------------------------------------
    if (_log) _log.info("Scanning for model");

    const modelPath = __dirname + "/model";
    fs.readdirSync(modelPath)
        .filter(function (file) {
            return (file.indexOf(".") !== 0) && (file !== "index.js");
        })
        .forEach(function (file) {
            if (_log) _log.info("Loading model from file " + file);
            const module = require(path.join(modelPath, file));
            module.init(log);
        });

    // List connections
    // ----------------------------------------------------------
    for (const connection of mongoose.connections) {
        if (_log) _log.info("Connected to MongoDB: " + connection.host);
    }

    if (config.database.propagateChanges) {
        exports.startPropagatingChanges();
    }
};

exports.startPropagatingChanges = function() {
    const Folder = mongoose.model("Folder");
    const Item = mongoose.model("Item");

    // First stop any existing change streams, otherwise this would create an infinte loop.
    exports.stopPropagatingChanges();

    // When a folder was changed, propagate the new updatedAt time to the parent folder.
    folderChangeStream = Folder.watch(undefined, {fullDocument: "updateLookup" }).on("change", async function(data) {
        // Get the new updatedAt time from the updateDescription or the fullDocument (if the document was inserted).
        let newUpdatedAtTime = data?.updateDescription?.updatedFields?.updatedAt || data?.fullDocument?.updatedAt;

        // The only two relevant operations are update and insert, since folders don't get deleted from the database, but only marked as deleted.
        if ((data.operationType === "update" || data.operationType === "insert") && newUpdatedAtTime) {
            if (data?.fullDocument.parent) {
                await Folder.findOneAndUpdate({
                    _id: data.fullDocument.parent,
                }, {
                    $set: {
                        updatedAt: newUpdatedAtTime
                    }
                }, {
                    timestamps: false
                });
            }
        }
    });

    // When an item was changed, propagate the new updatedAt time to the parent folder.
    itemChangeStream = Item.watch(undefined, {fullDocument: "updateLookup"}).on("change", async function(data) {
        // Get the new updatedAt time from the updateDescription or the fullDocument (if the document was inserted).
        let newUpdatedAtTime = data?.updateDescription?.updatedFields?.updatedAt || data?.fullDocument?.updatedAt;

        // The only two relevant operations are update and insert, since items don't get deleted from the database, but only marked as deleted.
        if ((data.operationType === "update" || data.operationType === "insert") && newUpdatedAtTime) {
            if (data?.fullDocument.folder) {
                await Folder.findOneAndUpdate({
                    _id: data.fullDocument.folder,
                }, {
                    $set: {
                        updatedAt: newUpdatedAtTime
                    }
                }, {
                    timestamps: false
                });
            }
        }
    });
}

exports.stopPropagatingChanges = function() {
    if (folderChangeStream) folderChangeStream.close();
    if (itemChangeStream) itemChangeStream.close();
}

exports.installIndices = function() {
    for (const modelName in mongoose.models) {
        const model = mongoose.model(modelName);
        if (typeof model.installIndices === 'function') {
            try {
                model.installIndices();
            } catch (err) {
                console.error(err);
            }
        }
    }
};

exports.shutdown = function() {
    // Make sure to close the change streams before disconnecting.
    exports.stopPropagatingChanges();

    mongoose.disconnect();
};

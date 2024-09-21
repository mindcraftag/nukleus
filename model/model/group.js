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
  const collectionName = "Group";

  // -----------------------------------------------------------------------
  //  Schema
  // -----------------------------------------------------------------------
  const schema = new mongoose.Schema({
    name: String,
    description: String,

    // Location
    location: { type: String, required: true, default: "CHE" },
    lastLocationSwitchAt: Date,

    // Amount of items and folders that have been moved between locations
    lastMovedElementsAt: Date,
    movedElementsCount: Number,

    hasFolder: { type: Boolean, default: false },

    // Storage quota
    storageQuotaGb: Number,
    usedStorageQuotaGb: Number,

    // Traffic quota
    trafficQuotaGb: Number,
    usedTrafficQuotaBytes: Number,

    // Allowed stuff
    allowedJobtypes: [String],
    allowedDatatypes: [String],
    allowedFeatures: [String],

    avatar: {
      type: [{
        size: Number,
        data: String
      }],
      default: undefined
    },

    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    deletedAt: Date
  }, {
    timestamps: true,
    read: 'primary'
  });

  // -----------------------------------------------------------------------
  //  Indices
  // -----------------------------------------------------------------------
  schema.statics.installIndices = function() {
    schema.index({name: 1, client: 1, deletedAt: 1}, {unique: true});
  };

  // -----------------------------------------------------------------------
  //  Statics
  // -----------------------------------------------------------------------
  schema.statics.existsByNameAndClient = async function(name, client) {
    return await this.model(collectionName).find({ name: name, client: client, deletedAt: { $exists: false } }).limit(1).count(true) > 0;
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


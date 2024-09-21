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
  const collectionName = "Plugin";

  // -----------------------------------------------------------------------
  //  Schema
  // -----------------------------------------------------------------------
  const schema = new mongoose.Schema({
    name: String,
    alwaysEnabled: Boolean,
    needsSuperadmin: Boolean,
    needsPlanFeatures: [String],
    permissionsRequired: [String],
    mounts: [mongoose.Schema.Types.Mixed]
  }, {
    read: 'primary'
  });

  // -----------------------------------------------------------------------
  //  Indices
  // -----------------------------------------------------------------------
  schema.statics.installIndices = function() {
    schema.index({name: 1}, {unique: true});
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


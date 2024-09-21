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

exports.init = function(log) {
  const collectionName = "AclCache";

  // -----------------------------------------------------------------------
  //  Schema
  // -----------------------------------------------------------------------
  const schema = new mongoose.Schema({
    // The element is usually the _id of the item or folder, however it can also be "0" for the root folder.
    element: { type: String, required: true },
    type: {
        type: String,
        enum: ["item", "folder"],
        required: true
    },
    acl: [{
        group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        can: [{ type: String, required: true}],
        source: { type: String, required: true},
        level: { type: Number, require: true }
    }]
  }, {
    timestamps: true,
    read: 'primary'
  });

  // -----------------------------------------------------------------------
  //  Indices
  // -----------------------------------------------------------------------
  schema.statics.installIndices = function() {
    schema.index({element: 1, type: 1}, {unique: true});
  }

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

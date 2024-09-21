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
  const collectionName = "Mail";

  // -----------------------------------------------------------------------
  //  Schema
  // -----------------------------------------------------------------------
  const schema = new mongoose.Schema({
    address: String,
    template: String,
    fields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    },
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    processedAt: Date,
    success: Boolean,
    admin: Boolean,
    result: mongoose.Schema.Types.Mixed
  }, {
    timestamps: true,
    read: 'primary'
  });

  // -----------------------------------------------------------------------
  //  Indices
  // -----------------------------------------------------------------------
  schema.statics.installIndices = function() {
    schema.index({sentAt: 1});
    schema.index({createdAt: 1});
    schema.index({processedAt: 1});
    schema.index({success: 1});
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


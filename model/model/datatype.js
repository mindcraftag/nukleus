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
  const collectionName = "DataType";

  // -----------------------------------------------------------------------
  //  Schema
  // -----------------------------------------------------------------------
  const schema = new mongoose.Schema({
    name: String,
    contentTypes: [String],
    fields: [mongoose.Schema.Types.Mixed],
    fieldSets: [mongoose.Schema.Types.Mixed],
    updateRequiresThumbRefresh: Boolean,
    recursiveLoadStopsHere: Boolean,
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }
  }, {
    timestamps: true,
    read: 'primary'
  });

  // -----------------------------------------------------------------------
  //  Indices
  // -----------------------------------------------------------------------
  schema.statics.installIndices = function() {
    schema.index({name: 1}, {unique: true});
    schema.index({client: 1});
    schema.index({contentTypes: 1});
  };

  // -----------------------------------------------------------------------
  //  Statics
  // -----------------------------------------------------------------------
  schema.statics.existsByName = async function(name) {
    return await this.model(collectionName).find({ name: name }).limit(1).count(true) > 0;
  };

  // -----------------------------------------------------------------------
  //  Eventhandler
  // -----------------------------------------------------------------------
  mongoose.model(collectionName, schema).on('index', function(err) {
    if (err) {
      log.error('Indexing error: DataType: %s', err);
    } else {
      log.info('Indexing complete: DataType');
    }
  });
}


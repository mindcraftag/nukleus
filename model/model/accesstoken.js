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
  const collectionName = "AccessToken";

  // -----------------------------------------------------------------------
  //  Schema
  // -----------------------------------------------------------------------
  const schema = new mongoose.Schema({
    token: String,
    name: String,
    type: String,
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    enabled: Boolean
  }, {
    timestamps: true,
    read: 'primary'
  });

  // -----------------------------------------------------------------------
  //  Indices
  // -----------------------------------------------------------------------
  schema.statics.installIndices = function() {
    schema.index({token: 1}, {unique: true});
    schema.index({name: 1, user: 1}, {unique: true});
    schema.index({client: 1});
    schema.index({type: 1});
    schema.index({enabled: 1});
  }

  // -----------------------------------------------------------------------
  //  Statics
  // -----------------------------------------------------------------------
  schema.statics.existsByName = async function(name, user) {
    return await this.model(collectionName).find({ name: name, user: user }).limit(1).count(true) > 0;
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


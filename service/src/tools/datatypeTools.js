"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose = require('@mindcraftgmbh/nukleus-model').mongoose;

const FIELD_TYPES = ["Link", "Attribute", "Separator", "Tree", "List"];

exports.isNameConflict = async function(name) {
  const DataType = mongoose.model('DataType');
  const exists = await DataType.existsByName(name);
  return exists;
};

exports.verifyFields = function(fields) {
  if (!Array.isArray(fields))
    throw "Fields must be an array!";

  for (const field of fields) {
    if (typeof field !== "object")
      throw "Fields must be an array of objects.";

    if (!FIELD_TYPES.includes(field.type))
      throw "Field type must be one of " + FIELD_TYPES.join(', ');
  }
};
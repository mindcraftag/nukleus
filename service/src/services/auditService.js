"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose  = require('@mindcraftgmbh/nukleus-model').mongoose;
const diff      = require('deep-diff').diff;

exports.createAuditLog = async function(object, select) {
    const model = object.constructor;
    const objectType = model.modelName;
    const query = model.findById(object._id);

    if (select)
        query.select(select);

    const oldObject = await query.exec();

    const oldPlainObject = JSON.parse(JSON.stringify(oldObject));
    const newPlainObject = JSON.parse(JSON.stringify(object));

    const changes = diff(oldPlainObject, newPlainObject);
    const Audit = mongoose.model('Audit');
    const audit = new Audit({
        objectId: oldObject._id,
        objectType: objectType,
        changes: changes,
        client: oldObject.client
    });

    await audit.save();
}

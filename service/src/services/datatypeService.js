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

exports.getDatatypes = async function() {
    const DataType = mongoose.model('DataType');
    return DataType.find().exec();
}

exports.getDatatype = async function(name) {
    const DataType = mongoose.model('DataType');
    return DataType.findOne({ name: name }).exec();
}

exports.existsDatatypeInClient = async function(name) {
    const DataType = mongoose.model('DataType');
    return DataType.findOne({ name: name }).exec();
}

exports.getDatatypesMap = async function() {
    const datatypes = await exports.getDatatypes();
    const map = new Map();

    for (const datatype of datatypes) {
        map.set(datatype.name, datatype);
    }

    return map;
}

exports.findFieldInFields = function(fields, fieldnameParts) {
    for (const field of fields) {
        switch(field.type) {
            case "Link":
                if (fieldnameParts.length === 1 && field.usageAs === fieldnameParts[0])
                    return field;
                break;
            case "Attribute":
                if (fieldnameParts.length === 1 && field.name === fieldnameParts[0])
                    return field;
                break;
            case "Tree":
                if (fieldnameParts.length >= 1 && field.name === fieldnameParts[0]) {
                    for (const type of field.childTypes) {
                        const result = exports.findFieldInFields(type.fields, fieldnameParts.splice(1));
                        if (result)
                            return result;
                    }
                }
                break;
            case "List":
                if (fieldnameParts.length >= 1 && field.name === fieldnameParts[0]) {
                    const result = exports.findFieldInFields(field.fields, fieldnameParts.splice(1));
                    if (result)
                        return result;
                }
                break;
        }
    }
}

exports.splitFieldName = function(fieldname) {
    const parts = fieldname.split("->");
    const result = [];

    for (let part of parts) {
        const i = part.indexOf('[')
        if (i > 0)
            result.push(part.substr(0, i));
        else
            result.push(part);
    }

    return result;
}

exports.findField = function(datatype, fieldname) {
    const fieldnameParts = exports.splitFieldName(fieldname);
    return exports.findFieldInFields(datatype.fields, fieldnameParts);
}

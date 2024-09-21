"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose          = require('@mindcraftgmbh/nukleus-model').mongoose;
const ValidationError   = require('../exception').ValidationError;

exports.createAttributeTemplate = async function(name, client, fields) {

    const AttributeTemplate = mongoose.model('AttributeTemplate');
    if (await AttributeTemplate.existsByName(name, client)) {
        throw new ValidationError("Name already exists.");
    }

    exports.validateFields(fields);

    const attributeTemplate = new AttributeTemplate();
    attributeTemplate.name = name;
    attributeTemplate.client = client;
    attributeTemplate.fields = fields;

    await attributeTemplate.save();

    return attributeTemplate;
}

exports.getAttributeTemplates = async function(client) {
    const AttributeTemplate = mongoose.model('AttributeTemplate');
    const attributeTemplates = await AttributeTemplate.find({ client: client }).exec();
    return attributeTemplates;
}

exports.getAttributeTemplate = async function(id, client) {
    const AttributeTemplate = mongoose.model('AttributeTemplate');
    const attributeTemplate = await AttributeTemplate.findOne({ _id: id, client: client }).exec();
    return attributeTemplate;
}

exports.existsAttributeTemplate = async function(id, client) {
    const AttributeTemplate = mongoose.model('AttributeTemplate');
    const attributeTemplate = await AttributeTemplate.findOne({ _id: id, client: client }).select("_id").exec();
    return !!attributeTemplate;
}

exports.updateAttributeTemplate = async function(id, client, name, fields) {
    const AttributeTemplate = mongoose.model('AttributeTemplate');
    const attributeTemplate = await AttributeTemplate.findOne({ _id: id, client: client }).exec();
    if (!attributeTemplate) {
        throw new ValidationError("Attribute Template not found!");
    }

    if (attributeTemplate.name !== name) {
        if (await AttributeTemplate.existsByName(name, client)) {
            throw new ValidationError("Attribute Template with that name already exists.");
        }
    }

    exports.validateFields(fields);

    attributeTemplate.name = name;
    attributeTemplate.fields = fields;
    await attributeTemplate.save();
}

exports.deleteAttributeTemplate = async function(id, client) {
    const AttributeTemplate = mongoose.model('AttributeTemplate');
    const Item = mongoose.model('Item');

    const item = await Item.findOne({ userAttributeTemplate: id, client: client }).exec();
    if (item) {
        throw new ValidationError("Cannot delete this attribute template. It is in use.");
    }

    await AttributeTemplate.deleteOne({ _id: id, client: client });
}

exports.validateFields = function(fields) {
    if (!Array.isArray(fields)) {
        throw new ValidationError("Fields has to be an array");
    }

    for (const field of fields) {

    }
}

exports.validateAttributes = function(attributes, fields) {

}


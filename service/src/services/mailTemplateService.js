"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const model             = require('@mindcraftgmbh/nukleus-model');
const mongoose          = model.mongoose;
const ValidationError   = require('../exception').ValidationError;
const imageTools        = require('../tools/imageTools');
const limits            = require('../limits');
const clientService     = require('./clientService');

/**
 * Creates a template name for the user defined name that only contains alphanumeric lower case characters
 * @param name
 * @returns {string}
 */
exports.createTemplateName = function(name) {
    name = name.toLowerCase();

    let result = "";
    for (let i=0; i<name.length; i++) {
        if (name[i].isAlphaNumeric())
            result += name[i];
    }

    return result;
}

/**
 * Get list of all mail templates
 * @param client
 * @returns {Promise<*>}
 */
exports.getTemplates = async function(client) {
    const MailTemplate = mongoose.model('MailTemplate');

    const templates = await MailTemplate.find({
        client: client,
        deletedAt: { $exists: false }
    }).select("name baseTemplate createdAt updatedAt createdBy updatedBy").exec();

    return templates;
}

/**
 * Get a single mail template
 * @param id
 * @param client
 * @returns {Promise<*>}
 */
exports.getTemplate = async function(id, client) {
    const MailTemplate = mongoose.model('MailTemplate');

    const template = await MailTemplate.findOne({
        _id: id,
        client: client,
        deletedAt: { $exists: false }
    }).select("name subject text baseTemplate createdAt updatedAt images").exec();

    return template;
}

/**
 * Checks if a template exists already
 * @param name
 * @param client
 * @returns {Promise<Boolean>}
 */
exports.existsTemplate = async function(name, client) {
    const MailTemplate = mongoose.model('MailTemplate');

    const template = await MailTemplate.findOne({
        name: name,
        client: client,
        deletedAt: { $exists: false }
    }).select("_id").exec();

    return !!template;
}

/**
 * Returns image counts and sizes for a mail template
 * @param id
 * @param client
 * @returns {Promise<void>}
 */
exports.getTemplateImageStats = async function(id, client) {
    const MailTemplate = mongoose.model('MailTemplate');

    const template = await MailTemplate.findOne({
        _id: id,
        client: client,
        deletedAt: { $exists: false }
    }).select("images").exec();

    let images = [];
    if (template.images)
        images = Array.from(template.images.values());

    const count = images.length;
    const size = images.reduce((total, image) => {
        return total + image.size;
    }, 0);

    return {
        count: count,
        size: size
    }
}

/**
 * Create a new mail template
 * @param name
 * @param subject
 * @param client
 * @param text
 * @param baseTemplate optional template to use as a base for this one
 * @returns {Promise<void>}
 */
exports.createTemplate = async function(name, subject, text, baseTemplate, client, userId) {
    const MailTemplate = mongoose.model('MailTemplate');

    if (await exports.existsTemplate(name, client)) {
        throw new ValidationError("Template with that name exists already");
    }

    if (baseTemplate) {
        baseTemplate = await MailTemplate.findOne({
            _id: baseTemplate,
            client: client,
            deletedAt: {$exists: false}
        }).select("_id").exec();

        if (!baseTemplate) {
            throw new ValidationError("Base template not found.");
        }
    } else {
        baseTemplate = null;
    }

    const mailTemplate = new MailTemplate({
        name: name,
        templateName: exports.createTemplateName(name),
        client: client,
        subject: subject,
        text: text,
        baseTemplate: baseTemplate,
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await mailTemplate.save();

    return mailTemplate;
}

/**
 * Update a mail template
 * @param id
 * @param name
 * @param subject
 * @param client
 * @param text
 * @param baseTemplate optional template to use as a base for this one
 * @returns {Promise<void>}
 */
exports.updateTemplate = async function(id, name, subject, text, baseTemplate, client, userId) {
    const MailTemplate = mongoose.model('MailTemplate');

    if (baseTemplate) {
        baseTemplate = await MailTemplate.findOne({
            _id: baseTemplate,
            client: client,
            deletedAt: {$exists: false}
        }).select("_id").exec();

        if (!baseTemplate) {
            throw new ValidationError("Base template not found.");
        }
    }

    await MailTemplate.updateOne({
        _id: id,
        client: client,
        deletedAt: { $exists: false }
    }, {
        $set: {
            name: name,
            templateName: exports.createTemplateName(name),
            subject: subject,
            text: text,
            baseTemplate: baseTemplate,
            updatedBy: userId,
            updatedAt: new Date()
        }
    });
}

/**
 * Delete a mail template
 * @param id
 * @param client
 * @returns {Promise<void>}
 */
exports.deleteTemplate = async function(id, client, userId) {
    const MailTemplate = mongoose.model('MailTemplate');
    await MailTemplate.updateOne({
        _id: id,
        client: client
    }, {
        $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
            updatedBy: userId
        }
    });
}

/**
 * Adds an image to the template
 * @param id
 * @param client
 * @param userId
 * @param imageName
 * @param imageData
 * @returns {Promise<void>}
 */
exports.addImage = async function(id, client, userId, imageName, imageData) {
    const MailTemplate = mongoose.model('MailTemplate');

    imageName = imageName.trim();
    if (!imageName.isAlphaNumeric()) {
        throw new ValidationError("Image name must be alphanumeric");
    }

    const stats = await exports.getTemplateImageStats(id, client);
    stats.size += imageData.length;
    stats.count++;

    if (stats.size > limits.MAX_MAILTEMPLATE_TOTAL_IMAGESIZE) {
        throw new ValidationError(`Images are too large: ${stats.size} bytes. Max allowed: ${limits.MAX_MAILTEMPLATE_TOTAL_IMAGESIZE} bytes.`);
    }

    if (stats.count > limits.MAX_MAILTEMPLATE_IMAGECOUNT) {
        throw new ValidationError(`Image count exceeded: ${stats.count}. Max allowed: ${limits.MAX_MAILTEMPLATE_IMAGECOUNT}.`);
    }

    let data = await imageTools.convertToDataURL(imageData);
    data.size = imageData.length;

    const set = {}
    set[`images.${imageName}`] = data;
    set['updatedAt'] = new Date();
    set['updatedBy'] = userId;

    await MailTemplate.updateOne({
        _id: id,
        client: client,
        deletedAt: { $exists: false }
    }, {
        $set: set
    });
}

/**
 * Removes an image from the template
 * @param id
 * @param client
 * @param userId
 * @param imageName
 * @returns {Promise<void>}
 */
exports.removeImage = async function(id, client, userId, imageName) {
    const MailTemplate = mongoose.model('MailTemplate');

    imageName = imageName.trim();
    if (!imageName.isAlphaNumeric()) {
        throw new ValidationError("Image name must be alphanumeric");
    }

    const unset = {}
    unset[`images.${imageName}`] = 1

    await MailTemplate.updateOne({
        _id: id,
        client: client,
        deletedAt: { $exists: false }
    }, {
        $unset: unset,
        $set: {
            updatedAt: new Date(),
            updatedBy: userId
        }
    });
}

exports.getNukleusTemplateNames = async function() {
    const MailTemplate = mongoose.model('MailTemplate');
    const templates = await MailTemplate.find().where({ client: await clientService.getNukleusClient() }).exec();
    return templates.map(template => template.name);
}

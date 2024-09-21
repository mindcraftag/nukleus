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
 * Get list of all invoice templates
 * @param client
 * @returns {Promise<*>}
 */
exports.getTemplates = async function(client) {
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');

    const templates = await InvoiceTemplate.find({
        client: client,
        deletedAt: { $exists: false }
    }).select("name baseTemplate createdAt updatedAt createdBy updatedBy").exec();

    return templates;
}

/**
 * Get a single invoice template
 * @param id
 * @param client
 * @returns {Promise<*>}
 */
exports.getTemplate = async function(id, client) {
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');

    const template = await InvoiceTemplate.findOne({
        _id: id,
        client: client,
        deletedAt: { $exists: false }
    }).select("name text baseTemplate createdAt updatedAt images").exec();

    return template;
}

/**
 * Checks if a template exists already
 * @param name
 * @param client
 * @returns {Promise<Boolean>}
 */
exports.existsTemplate = async function(name, client) {
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');

    const template = await InvoiceTemplate.findOne({
        name: name,
        client: client,
        deletedAt: { $exists: false }
    }).select("_id").exec();

    return !!template;
}

/**
 * Returns image counts and sizes for a invoice template
 * @param id
 * @param client
 * @returns {Promise<void>}
 */
exports.getTemplateImageStats = async function(id, client) {
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');

    const template = await InvoiceTemplate.findOne({
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
 * Create a new invoice template
 * @param name
 * @param client
 * @param text
 * @param baseTemplate optional template to use as a base for this one
 * @returns {Promise<void>}
 */
exports.createTemplate = async function(name, text, baseTemplate, client, userId) {
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');

    if (await exports.existsTemplate(name, client)) {
        throw new ValidationError("Template with that name exists already");
    }

    if (baseTemplate) {
        baseTemplate = await InvoiceTemplate.findOne({
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

    const invoiceTemplate = new InvoiceTemplate({
        name: name,
        templateName: exports.createTemplateName(name),
        client: client,
        text: text,
        baseTemplate: baseTemplate,
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await invoiceTemplate.save();

    return invoiceTemplate;
}

/**
 * Update a invoice template
 * @param id
 * @param name
 * @param client
 * @param text
 * @param baseTemplate optional template to use as a base for this one
 * @returns {Promise<void>}
 */
exports.updateTemplate = async function(id, name, text, baseTemplate, client, userId) {
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');

    if (baseTemplate) {
        baseTemplate = await InvoiceTemplate.findOne({
            _id: baseTemplate,
            client: client,
            deletedAt: {$exists: false}
        }).select("_id").exec();

        if (!baseTemplate) {
            throw new ValidationError("Base template not found.");
        }
    }

    await InvoiceTemplate.updateOne({
        _id: id,
        client: client,
        deletedAt: { $exists: false }
    }, {
        $set: {
            name: name,
            templateName: exports.createTemplateName(name),
            text: text,
            baseTemplate: baseTemplate,
            updatedBy: userId,
            updatedAt: new Date()
        }
    });
}

/**
 * Delete a invoice template
 * @param id
 * @param client
 * @returns {Promise<void>}
 */
exports.deleteTemplate = async function(id, client, userId) {
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');
    await InvoiceTemplate.updateOne({
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
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');

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

    await InvoiceTemplate.updateOne({
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
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');

    imageName = imageName.trim();
    if (!imageName.isAlphaNumeric()) {
        throw new ValidationError("Image name must be alphanumeric");
    }

    const unset = {}
    unset[`images.${imageName}`] = 1

    await InvoiceTemplate.updateOne({
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

exports.generateInvoice = async function(templateName, client) {
    const InvoiceTemplate = mongoose.model('InvoiceTemplate');
    const invoiceTemplate = await InvoiceTemplate.findOne({
        templateName: templateName,
        client: client,
        deletedAt: { $exists: false }
    }).populate('baseTemplate').exec();

    if (!invoiceTemplate) {
        return null;
    }

    let templateSrc = invoiceTemplate.text;

    if (invoiceTemplate.images) {
        const cssAdditions = [];
        for (const key of invoiceTemplate.images.keys()) {
            const image = invoiceTemplate.images.get(key);
            cssAdditions.push(`.image-${key} { background-image: url(${image.data}); width: ${image.width}px; height: ${image.height}px; }`);
        }

        let cssAddition = "\n" + cssAdditions.join('\n') + "\n";

        const stylePos = templateSrc.toLowerCase().indexOf('<style>');
        if (stylePos >= 0) {
            templateSrc = templateSrc.slice(0, stylePos+7) + cssAddition + templateSrc.slice(stylePos+7);
        } else {
            cssAddition = `<style>${cssAddition}</style>`;
            const bodyPos = templateSrc.toLowerCase().indexOf('<body>');
            if (bodyPos >= 0) {
                templateSrc = templateSrc.slice(0, bodyPos+6) + cssAddition + templateSrc.slice(bodyPos+6);
            } else {
                templateSrc = cssAddition + templateSrc;
            }
        }
    }

    return templateSrc;
}

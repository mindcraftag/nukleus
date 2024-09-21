"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const {ValidationError} = require("../exception");
const mongoose = require('@mindcraftgmbh/nukleus-model').mongoose;
const limits = require('../limits');

/**
 * Get list of all mail templates
 * @param client
 * @param onlyPublic
 * @returns {Promise<*>}
 */
exports.getPurchasables = async function (client, onlyPublic) {
    const Purchasable = mongoose.model('Purchasable');

    let query = {
        client: client,
        deletedAt: {$exists: false}
    };

    if (onlyPublic) {
        query.public = true;
    }

    const purchasables = await Purchasable.find(query)
        .select("name description options createdAt updatedAt createdBy updatedBy groupId pricesContainVat")
        .exec();

    return purchasables;
}

/**
 * Get a single purchasable
 * @param id
 * @param clientId
 * @returns {Promise<*>}
 */
exports.getPurchasable = async function (id, clientId) {
    const Purchasable = mongoose.model('Purchasable');

    const purchasable = await Purchasable.findOne({
        _id: id,
        client: clientId,
        deletedAt: {$exists: false}
    }).exec();

    return purchasable;
}

/***
 * Get purchasable and option by their IDs
 * @param id
 * @param clientId
 * @param optionId
 * @returns {Promise<{purchasable: *, option}>}
 */
exports.getPurchasableAndOption = async function (id, clientId, optionId) {
    const purchasable = await exports.getPurchasable(id, clientId);
    if (!purchasable) {
        throw new ValidationError("Purchasable does not exist.");
    }

    let option;
    for (const opt of purchasable.options) {
        if (opt._id.equals(optionId)) {
            option = opt;
            break;
        }
    }

    if (!option) {
        throw new ValidationError("Option does not exist.");
    }

    return {purchasable, option};
}

/**
 * Checks if a purchasable exists already
 * @param name
 * @param client
 * @returns {Promise<Boolean>}
 */
exports.existsPurchasable = async function (name, client) {
    const Purchasable = mongoose.model('Purchasable');

    const purchasable = await Purchasable.findOne({
        name: name,
        client: client,
        deletedAt: {$exists: false}
    }).select("_id").exec();

    return !!purchasable;
}

/**
 * Verify if options have correct format
 * @param options
 */
exports.verifyOptions = async function (options) {
    if (!Array.isArray(options)) {
        throw new ValidationError("Options must be an array!");
    }

    if (options.length < 1) {
        throw new ValidationError("Options must contain at least one element!");
    }

    for (const option of options) {
        if (option.interval) {
            if (!limits.PURCHASE_OPTION_INTERVALS.includes(option.interval)) {
                throw new ValidationError("Option interval must be one of: " + limits.PURCHASE_OPTION_INTERVALS.join(","));
            }
        }

        if (!option.prices) {
            throw new ValidationError("Option must contain prices!");
        }

        const KeyValuePair = mongoose.model("KeyValuePair");
        const keyValuePair = await KeyValuePair.findOne({ key: 'supportedcurrencies' });

        if (!keyValuePair) throw new ValidationError("KeyValuePair 'supportedcurrencies' not found.");
        if (!Array.isArray(keyValuePair.value)) throw new ValidationError("KeyValuePair 'supportedcurrencies' must be an array.");

        // We expect that "option.prices" has a key for each supported currency with the price as the value.
        for (const currency of keyValuePair.value) {
            if (!currency || typeof currency !== 'string') {
                throw new ValidationError("KeyValuePair 'supportedcurrencies' must contain only strings. Found value: " + currency);
            }

            if (!option.prices[currency]) {
                throw new ValidationError(`Option must contain prices.${currency}!`);
            } else {
                option.prices[currency] = parseInt(option.prices[currency]);

                if (!Number.isInteger(option.prices[currency])) {
                    throw new ValidationError(`Option must contain prices.${currency} with integer type!`);
                }

                if (option.prices[currency] < limits.PURCHASE_MINIMUM_PRICE) {
                    throw new ValidationError(`Invalid price for ${currency}: must be at least ${limits.PURCHASE_MINIMUM_PRICE}!`);
                }
            }
        }

        if (typeof option.name !== 'string') {
            throw new ValidationError("Option must contain name of type string!");
        }

        option.name = option.name.trim();

        if (!option.name.length) {
            throw new ValidationError("Option name must not be empty!");
        }
    }
}

/**
 * Verifies the deactivation or activation actions
 * @param actions
 */
exports.verifyActions = function (actions) {
    if (!actions)
        return;

    if (!Array.isArray(actions)) {
        throw new ValidationError("Actions must be an array!");
    }

    for (const action of actions) {
        if (!action.type || typeof action.type !== 'string') {
            throw new ValidationError("Action must have a field 'type' of type string!");
        }
    }
}

/**
 * Create a new purchasable
 * @param name
 * @param description
 * @param options
 * @param groupId
 * @param activationActions
 * @param deactivationActions
 * @param client
 * @param userId
 * @param isPublic
 * @param pricesContainVat
 * @returns {Promise<void>}
 */
exports.createPurchasable = async function (name, description, options, groupId, activationActions, deactivationActions,
                                            client, userId, isPublic, pricesContainVat) {

    // Verify options and actions arrays
    // --------------------------------------------------
    await exports.verifyOptions(options);
    exports.verifyActions(activationActions);
    exports.verifyActions(deactivationActions);

    // Check if purchasable exists already
    // --------------------------------------------------
    const Purchasable = mongoose.model('Purchasable');

    if (await exports.existsPurchasable(name, client)) {
        throw new ValidationError("Purchasable with that name exists already");
    }

    // Create new purchasable
    // --------------------------------------------------
    const purchasable = new Purchasable({
        name: name,
        client: client,
        description: description,
        options: options,
        groupId: groupId,
        public: isPublic,
        pricesContainVat: pricesContainVat,
        activationActions: activationActions,
        deactivationActions: deactivationActions,
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await purchasable.save();

    return purchasable;
}

/**
 * Update a purchasable
 * @param id
 * @param name
 * @param description
 * @param options
 * @param groupId
 * @param activationActions
 * @param deactivationActions
 * @param client
 * @param userId
 * @param isPublic
 * @param pricesContainVat
 * @returns {Promise<void>}
 */
exports.updatePurchasable = async function (id, name, description, options, groupId, activationActions, deactivationActions,
                                            client, userId, isPublic, pricesContainVat) {

    // Verify the options and actions arrays
    // --------------------------------------------------
    await exports.verifyOptions(options);
    exports.verifyActions(activationActions);
    exports.verifyActions(deactivationActions);

    // Get the purchasable
    // --------------------------------------------------
    const Purchasable = mongoose.model('Purchasable');
    const purchasable = await Purchasable.findOne({_id: id}).select("options").exec();

    if (!purchasable) {
        throw new ValidationError("Purchasable not found!");
    }

    // Make a list of all removed options
    // --------------------------------------------------
    const removedOptions = [];
    for (const oldOption of purchasable.options) {
        let found = false;
        for (const newOption of options) {
            if (oldOption._id.equals(newOption._id)) {
                found = true;
                break;
            }
        }
        if (!found)
            removedOptions.push(oldOption);
    }

    // Check if any of those options are active in a purchase
    // --------------------------------------------------
    const Purchase = mongoose.model('Purchase');
    for (const removedOption of removedOptions) {
        const purchase = await Purchase.findOne({purchase: id, option: removedOption._id, active: true}).exec();
        if (purchase) {
            throw new ValidationError(`Option ${removedOption.name} is still used in an active purchase. Cannot remove!`);
        }
    }

    // Update the purchasable
    // --------------------------------------------------
    await Purchasable.updateOne({
        _id: id,
        client: client,
        deletedAt: {$exists: false}
    }, {
        $set: {
            name: name,
            options: options,
            groupId: groupId,
            public: isPublic,
            pricesContainVat: pricesContainVat,
            activationActions: activationActions,
            deactivationActions: deactivationActions,
            description: description,
            updatedBy: userId,
            updatedAt: new Date()
        }
    });
}

/**
 * Delete a purchasable
 * @param id
 * @param client
 * @param userId
 * @returns {Promise<void>}
 */
exports.deletePurchasable = async function (id, client, userId) {
    const Purchase = mongoose.model('Purchase');
    const purchase = await Purchase.findOne({purchasable: id, active: true}).exec();

    if (purchase) {
        throw new ValidationError('Cannot delete purchasable while there is an active purchase of it.');
    }

    const Purchasable = mongoose.model('Purchasable');
    await Purchasable.updateOne({
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

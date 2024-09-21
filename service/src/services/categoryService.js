// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose = require('@mindcraftgmbh/nukleus-model').mongoose;

/**
 * Check for existance of a category
 * @param id
 * @param clientId
 * @returns {Promise<boolean>}
 */
exports.existsCategory = async function(id, clientId) {
    const Category = mongoose.model('Category');
    const category = await Category.findOne({ _id: id, client: clientId, deletedAt: { $exists: false } }).select("_id").exec();
    return !!category;
}

/**
 * Accepts an array of category IDs and checks them against the given client. Returns a new array with only the existing IDs
 * @param idArray
 * @param clientId
 * @return {Promise<Types.ObjectId[]>}
 */
exports.filterCategories = async function(idArray, clientId) {
    const Category = mongoose.model('Category');
    const categories = await Category.find({ _id: idArray, client: clientId, deletedAt: { $exists: false } }).select("_id").exec();
    return categories.map(x => x._id);
}


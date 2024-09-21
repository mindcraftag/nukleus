"use strict";

const { ValidationError } = require("../exception");

//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const DEFAULT_PAGE_SIZE = 1000;
const MIN_PAGE_SIZE = 2;
const MAX_PAGE_SIZE = 1000;

function constrainPageSize(pageSize) {
    if (pageSize < MIN_PAGE_SIZE) return MIN_PAGE_SIZE;
    if (pageSize > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
    return pageSize;
}

exports.parseItemsPerPage = function(itemsPerPageStr) {
    let itemsPerPage = DEFAULT_PAGE_SIZE;
    if (typeof itemsPerPageStr === "string") {
        itemsPerPage = parseInt(itemsPerPageStr);
        if (isNaN(itemsPerPage)) {
            throw new ValidationError("pageSize is not a number.");
        }
    } else if (typeof itemsPerPageStr === "number") {
        itemsPerPage = itemsPerPageStr;
    }

    return constrainPageSize(itemsPerPage);
}

/**
 * This function takes in a base64 encoded cursor string and decodes it.
 * @param {string} value 
 * @returns an object with the values key and search that indicate the cursor position
 */
function decodeQuery(value) {
    const str = Buffer.from(value, "base64").toString("ascii");
    const next = str.substring(0, str.indexOf(":"));
    const search = str.substring(str.indexOf(":") + 1);

    if (next.length < 1 || search.length < 1) {
        throw new ValidationError("Invalid cursor.");
    }

    return {
        next, search
    }
}

/**
 * This function takes in data and produces a base64 encoded cursor string.
 * @param {string} search 
 * @param {string} next 
 */
function buildEncodedQuery(search, next) {
    return Buffer.from(next + ":" + search).toString("base64");
}

/**
 * This function takes in a mongoose query and applies filtering based on the values passed as arguments.
 * It returns an object that can be used for pagination.
 * @param {*} query the mongoose query to be used
 * @param {ObjectId | null} clientID if not null, only return entries that match this client
 * @param {boolean} clientAsMembership if true, the clientID will be filtered for in the memberships of every entry, otherwise it will be a direct member
 * @param {*} searchQuery if not null, only return entries whose name matches the searchQuery
 * @param {*} cursor if not null, the base64 encoded cursor from where to continue searching
 * @param {*} itemsPerPageStr how many items should be returned per page, if this is undefined, a default is used
 * @returns an object consisting of the queries data and (if applicable) the cursor for the next page
 */
exports.paginateQuery = async function(query, clientID, clientAsMembership, searchQuery, cursor, itemsPerPageStr) {
    const itemsPerPage = exports.parseItemsPerPage(itemsPerPageStr);

    // always sort by name and _id
    query.sort({ name: "ascending", _id: "descending" });
    query.limit(itemsPerPage + 1);

    // if an argument is not null, apply it to the query
    if (clientID) {
        if (clientAsMembership) {
            query.where("memberships.client", clientID);
        } else {
            query.where("client", clientID);
        }
    }

    if (searchQuery) {
        query.where({ name: {
            $regex: searchQuery,
            $options: "i"
        } });
    }

    if (cursor) {
        const q = decodeQuery(cursor);

        // since we're not only sorting by _id, but also by name, we need to query for both of these keys
        // for more info: https://web.archive.org/web/20230228080329/https://engage.so/blog/a-deep-dive-into-offset-and-cursor-based-pagination-in-mongodb/
        query.where({
            $or: [{
                name: {$gt: q.search}
            },{
                name: q.next,
                _id: {$lt: q.next}
            }]
        })
    }

    const data = await query.exec();

    // calculate the position of the cursor for the next page
    let nextID = null;
    let nextName = null;
    if (data.length === itemsPerPage + 1) {
        nextID = data[itemsPerPage - 1]._id;
        nextName = data[itemsPerPage - 1].name;
        data.length = itemsPerPage;
    }

    return {
        data: data,
        next: nextID ? buildEncodedQuery(nextName, nextID) : null
    }
}

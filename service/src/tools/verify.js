"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment            = require('moment');
const mongoose          = require('@mindcraftgmbh/nukleus-model').mongoose;
const ValidationError   = require('../exception').ValidationError;
const iso3166           = require('iso-3166-1');

const DEFAULT_MAX_STRING_LENGTH = 100;
const RESERVED_ITEM_AND_FOLDER_NAMES = ["lost+found", "system"];

const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const PASSWORD_REGEX = /(?=^.{6,}$)(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).*/;

function getFieldValue(req, field) {
    const fields = field.split(".");
    if (fields.length === 1)
        return req.body[field];

    let body = req.body;
    for (const f of fields) {
        if (body === undefined || body === null)
            return body;

        body = body[f];
    }

    return body;
}

exports.emailAddress = function(req, field) {

    const value = (getFieldValue(req, field) || "").toString().trim().toLowerCase();

    if (value.length === 0) {
        throw new ValidationError(`${field} is empty`, field);
    }

    if (!EMAIL_REGEX.test(value)) {
        throw new ValidationError(`${field} is invalid email address`, field);
    }

    return value;
};

exports.optionalEmailAddress = function(req, field, defaultValue) {

    const value = (getFieldValue(req, field) || "").toString().trim().toLowerCase();

    if (value.length === 0) {
        return defaultValue;
    }

    if (!EMAIL_REGEX.test(value)) {
        throw new ValidationError(`${field} is invalid email address`, field);
    }

    return value;
};

exports.password = function(req, field) {

    const value = (getFieldValue(req, field) || "").toString().trim();

    if (value.length === 0) {
        throw new ValidationError(`${field} is empty`, field);
    }

    if (!PASSWORD_REGEX.test(value)) {
        throw new ValidationError(`${field} is not a strong password. Must be at least 6 characters and contain lower/upper case, numbers and one special character`, field);
    }

    return value;
};

exports.optionalPassword = function(req, field) {

    const value = (getFieldValue(req, field) || "").toString().trim();

    if (value.length === 0) {
        return null;
    }

    if (!PASSWORD_REGEX.test(value)) {
        throw new ValidationError(`${field} is not a strong password. Must contain lower/upper case, numbers and one special character: !"§/@#$%&*()`, field);
    }

    return value;
};

exports.verifyItemOrFolderName = function(value) {
    value = value.trim();

    if (value.length === 0) {
        throw new ValidationError("Invalid name. It's empty.");
    }

    if (RESERVED_ITEM_AND_FOLDER_NAMES.includes(value.toLowerCase())) {
        throw new ValidationError("Invalid name. Name is reserved.");
    }

    if (value.includes('/') || value.includes('\\')) {
        throw new ValidationError("Invalid name. May not contain slashes.");
    }

    const maxlength = DEFAULT_MAX_STRING_LENGTH;
    if (value.length > maxlength) {
        throw new ValidationError(`Name is too long. A maximum of ${maxlength} characters are allowed.`);
    }
}

exports.itemOrFolderName = function(req, field) {
    const value = (getFieldValue(req, field) || "").toString().trim();
    exports.verifyItemOrFolderName(value);
    return value;
};

exports.string = function(req, field, maxlength) {

    const value = (getFieldValue(req, field) || "").toString().trim();

    if (value.length === 0) {
        throw new ValidationError(`${field} is empty`, field);
    }

    maxlength = maxlength || DEFAULT_MAX_STRING_LENGTH;
    if (value.length > maxlength) {
        throw new ValidationError(`${field} is too long. A maximum of ${maxlength} characters are allowed.`, field);
    }

    return value;
};

exports.optionalString = function(req, field, maxlength, defaultValue) {
    let value = getFieldValue(req, field);
    if (value === undefined || value === null)
        return defaultValue;

    value = value.toString().trim();

    maxlength = maxlength || DEFAULT_MAX_STRING_LENGTH;
    if (value.length > maxlength) {
        throw new ValidationError(`${field} is too long. A maximum of ${maxlength} characters are allowed.`, field);
    }

    return value;
};

exports.optionalStringOrNull = function(req, field, maxlength) {
    let value = getFieldValue(req, field);
    if (value === undefined || value === null)
        return value;

    value = value.toString().trim();

    maxlength = maxlength || DEFAULT_MAX_STRING_LENGTH;
    if (value.length > maxlength) {
        throw new ValidationError(`${field} is too long. A maximum of ${maxlength} characters are allowed.`, field);
    }

    return value;
};

exports.stringArray = function(req, field, maxlength) {

    const value = getFieldValue(req, field);

    if (value === null || value === undefined) {
        throw new ValidationError(`${field} is empty`, field);
    }

    if (!Array.isArray(value)) {
        throw new ValidationError(`${field} is not an array`, field);
    }

    maxlength = maxlength || DEFAULT_MAX_STRING_LENGTH;

    for (const str of value) {
        if (typeof str !== 'string') {
            throw new ValidationError(`${field} is not a string array`, field);
        }

        if (str.length > maxlength) {
            throw new ValidationError(`${field} has entries which are too long. A maximum of ${maxlength} characters are allowed.`, field);
        }
    }

    return value;
};

exports.optionalStringArray = function(req, field, maxlength, maxArrayLength) {

    const value = getFieldValue(req, field);

    if (value !== null && value !== undefined) {
        if (!Array.isArray(value)) {
            throw new ValidationError(`${field} is not an array`, field);
        }

        if (maxArrayLength) {
            if (value.length > maxArrayLength) {
                throw new ValidationError(`${field} has too many elements. Max ${maxArrayLength} entries allowed.`, field);
            }
        }

        maxlength = maxlength || DEFAULT_MAX_STRING_LENGTH;

        for (const str of value) {
            if (typeof str !== 'string') {
                throw new ValidationError(`${field} is not a string array`, field);
            }

            if (str.length > maxlength) {
                throw new ValidationError(`${field} has entries which are too long. A maximum of ${maxlength} characters are allowed.`, field);
            }
        }
    }

    return value;
};

exports.optionalVersion = function(req, field, defaultValue) {
    const value = getFieldValue(req, field);
    if (!value) {
        return defaultValue;
    }

    return exports.version(req, field);
}

exports.version = function(req, field) {
    const value = getFieldValue(req, field);

    for (const key in value) {
        if (!['major', 'minor', 'revision'].includes(key)) {
            throw new ValidationError(`${field} has invalid property ${key}`);
        }

        if (typeof value[key] !== 'number')
            throw new ValidationError(`${field}'s ${key} property is not of type number.`);
    }

    return value;
}

function versionToInt(version) {
    return version.major * 1000000 + version.minor * 1000 + version.revision
}

exports.verifyVersionIncrement = function(oldVersion, newVersion) {
    const o = versionToInt(oldVersion);
    const n = versionToInt(newVersion);

    if (n < o)
        throw new ValidationError("Version number may not decrease.");

    if (n === o)
        newVersion.revision++;

    return newVersion;
}

exports.toDate = function(value, format) {
    let date;

    if (typeof value !== 'string') {
        throw new ValidationError(`${value} is not a string`, value);
    }

    if (format) {
        date = moment.utc(value, format);

        if (!date.isValid()) {
            throw new ValidationError(`Date does not have valid format: ${value}. Must be ${format}`);
        }
    } else {
        if (value.length === 14)
            date = moment.utc(value, "YYYYMMDDHHmmss");
        else if (value.length === 8)
            date = moment.utc(value, "YYYYMMDD");

        if (!date || !date.isValid()) {
            throw new ValidationError(`Date does not have valid format: ${value}. Must bei either 'YYYYMMDDHHmmss' or 'YYYYMMDD'`);
        }
    }

    return date.toDate();
}

exports.toString = function(value, name, maxlength) {
    name = name || "Value";

    if (!value) {
        throw new ValidationError(`${name} must be supplied`);
    }

    value = value.toString();

    if (maxlength) {
        if (value.length > maxlength) {
            throw new ValidationError(`${name} is too long. Max alowed: ${maxlength} characters`)
        }
    }

    return value;
}

exports.toObjectId = function(value, fieldName) {
    try {
        return new mongoose.Types.ObjectId(value);
    }
    catch(err) {
        throw new ValidationError(`Field must be an ID. Passed value: ${value}`, fieldName);
    }
}

exports.toObjectIdArray = function(value, name) {
    name = name || "Value";

    if (!Array.isArray(value))
        throw new ValidationError(`${name} is not an array!`);

    try {
        return value.map(x => new mongoose.Types.ObjectId(x));
    }
    catch(err) {
        throw new ValidationError(err.toString());
    }
}

exports.toObjectIdOrNull = function(value) {
    try {
        if (!value)
            return null;

        return new mongoose.Types.ObjectId(value);
    }
    catch(err) {
        throw new ValidationError(err.toString());
    }
}

exports.optionalObjectId = function(req, field) {
    const value = getFieldValue(req, field);
    if (value === undefined || value === null)
        return value;

    return exports.toObjectId(value, field);
};

exports.objectId = function(req, field) {
    const value = getFieldValue(req, field);
    if (!value) {
        throw new ValidationError(`${field} is empty`, field);
    }
    return exports.toObjectId(value, field);
};

exports.objectIdArray = function(req, field) {
    const value = getFieldValue(req, field);
    if (!value) {
        throw new ValidationError(`${field} is empty`, field);
    }

    if (!Array.isArray(value)) {
        throw new ValidationError(`${field} has to be an array`, field);
    }

    return value.map(id => exports.toObjectId(id, field));
};

exports.optionalObjectIdArray = function(req, field) {
    const value = getFieldValue(req, field);
    if (Array.isArray(value))
        return value.map(id => exports.toObjectId(id, field));

    return [];
};

exports.objectIdOrObjectIdArray = function(req, field) {
    if (Array.isArray(getFieldValue(req, field))) {
        return exports.objectIdArray(req, field);
    }
    return [exports.objectId(req, field)];
};

exports.optionalObjectIdOrObjectIdArray = function(req, field) {
    if (Array.isArray(getFieldValue(req, field))) {
        return exports.optionalObjectIdArray(req, field);
    }
    return [exports.optionalObjectId(req, field)];
};

exports.boolean = function(req, field) {
    const value = getFieldValue(req, field);
    if (value === null || value === undefined) {
        throw new ValidationError(`${field} is empty`, field);
    }

    if (value === true || value === 'true')
        return true;

    if (value === false || value === 'false')
        return false;

    throw new ValidationError(`${field} is not boolean. Must be either 'true' or 'false'.`, field);
};

exports.optionalBoolean = function(req, field, defaultValue) {
    const value = getFieldValue(req, field);
    if (value === null || value === undefined) {
        return defaultValue;
    }

    if (value === true || value === 'true')
        return true;

    if (value === false || value === 'false')
        return false;

    throw new ValidationError(`${field} is not boolean. Must be either 'true' or 'false'.`, field);
};

exports.array = function(req, field) {
    const value = getFieldValue(req, field);

    if (!Array.isArray(value)) {
        throw new ValidationError(`${field} is not an array`, field);
    }

    return value;
};

exports.optionalArray = function(req, field, defaultValue) {
    const value = getFieldValue(req, field);
    if (!Array.isArray(value)) {
        return defaultValue;
    }
    return value;
};

exports.object = function(req, field) {
    const value = getFieldValue(req, field);

    if (!value || typeof value !== "object" || value.constructor !== Object) {
        throw new ValidationError(`${field} is not an object`, field);
    }

    return value;
};

exports.floatNumber = function(req, field) {

    const value = getFieldValue(req, field);

    if (value === null || value === undefined) {
        throw new ValidationError(`${field} is empty`, field);
    }

    const number = parseFloat(value);

    if (isNaN(number)) {
        throw new ValidationError(`${field} is not a float number`, field);
    }

    return number;
};

exports.integerNumber = function(req, field) {

    const value = getFieldValue(req, field);

    if (value === null || value === undefined) {
        throw new ValidationError(`${field} is empty`, field);
    }

    const number = parseInt(value);

    if (isNaN(number)) {
        throw new ValidationError(`${field} is not an integer number`, field);
    }

    return number;
};

exports.optionalIntegerNumber = function(req, field, defaultValue) {

    const value = getFieldValue(req, field);

    if (value === null || value === undefined) {
        return defaultValue;
    }

    const number = parseInt(value);

    if (isNaN(number)) {
        throw new ValidationError(`${field} is not an integer number`, field);
    }

    return number;
};

exports.optionalIntegerNumberOrNull = function(req, field) {
    const value = getFieldValue(req, field);
    if (value === null || value === undefined)
        return value;

    const number = parseInt(value);

    if (isNaN(number)) {
        throw new ValidationError(`${field} is not an integer number`, field);
    }

    return number;
};

exports.optionalIntegerNumberRange = function(req, field, min, max, defaultValue) {
    const value = getFieldValue(req, field);

    if (value === null || value === undefined) {
        return defaultValue;
    }

    return exports.integerNumberRange(req, field, min, max);
}

exports.integerNumberRange = function(req, field, min, max) {

    const value = getFieldValue(req, field);

    if (value === null || value === undefined) {
        throw new ValidationError(`${field} is empty`, field);
    }

    const number = parseInt(value);

    if (isNaN(number)) {
        throw new ValidationError(`${field} is not an integer number`, field);
    }

    if (number < min || number > max) {
        throw new ValidationError(`${field} is out of range. ${min} to ${max} expected.`, field);
    }

    return number;
};

exports.path = function(req, field) {
    let path = exports.string(req, field);
    if (!path.startsWith("/"))
        throw new ValidationError("Path needs to start with a slash", field);

    if (path.endsWith("/"))
        path = path.substring(0, path.length-1);

    return path;
};

exports.date = function(req, field) {
    let dateString = exports.string(req, field);
    let date = exports.toDate(dateString);
    if (!date) {
        throw new ValidationError(`${field} is not an date value`, field);
    }
    return date;
}

exports.optionalDate = function(req, field, defaultValue) {
    let dateString = exports.optionalString(req, field);
    if (!dateString)
        return defaultValue;

    let date = exports.toDate(dateString);
    if (!date) {
        throw new ValidationError(`${field} is not an date value`, field);
    }
    return date;
}

exports.countryCode = function(req, field) {
    const invalidError = new ValidationError(`${field} is not a ISO 3166-1 alpha-3 country code`, field);

    try {
        const string = exports.string(req, field, 3);

        const country = iso3166.whereAlpha3(string.toUpperCase());
        if (country === undefined) {
            throw invalidError;
        } else {
            return country.alpha3.toUpperCase();
        }
    } catch (err) {
        // We don't want to "leak" error messages from the exports.string function.
        // Instead we return the more relevant "not a country code" error message.
        throw invalidError;
    }
};

exports.optionalCountryCode = function(req, field) {
    const invalidError = new ValidationError(`${field} is not a ISO 3166-1 alpha-3 country code`, field);

    try {
        let string = exports.optionalString(req, field, 3);
        if (!string)
            return null;

        const country = iso3166.whereAlpha3(string.toUpperCase());
        if (country === undefined) {
            throw invalidError;
        } else {
            return country.alpha3.toUpperCase();
        }
    } catch (err) {
        // We don't want to "leak" error messages from the exports.optionalString function.
        // Instead we return the more relevant "not a country code" error message.
        throw invalidError;
    }
};


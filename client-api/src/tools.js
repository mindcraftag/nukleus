"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import lodash from 'lodash'

export default {

    createGUID: function () {
        var S4 = function () {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };
        return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
    },

    toUserFriendlyName: function(variableName) {
        // Replace underscores with spaces and convert to camelCase
        const camelCaseName = variableName.replace(/_./g, match => match.charAt(1).toUpperCase());

        // Add spaces before uppercase letters and capitalize the first letter
        const friendlyName = camelCaseName
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/^(.)/, match => match.toUpperCase());

        return friendlyName;
    },

    assert: function(value, msg) {
        if (!value) {
            console.error(`ASSERTION FAILED: '${value}' is untrue: ${msg}`);
            debugger;
        }
    },

    matchItemIdAndObject(value1, value2) {
        if (!value1 || !value2)
            return false;

        return value1._id === value2 || value1 === value2._id;
    },

    areValuesEqual(value1, value2) {
        if (typeof value1 !== typeof value2)
            return false;

        if (typeof value1 === 'object' || typeof value2 === 'object') {
            const v1IsNull = value1 === null;
            const v2IsNull = value2 === null;

            if (v1IsNull !== v2IsNull)
                return false;

            if (v1IsNull && v2IsNull)
                return true;

            if (Object.is(value1, value2))
                return true;

            if (value1 && value1._id && value2 && value2._id)
                return value1._id === value2._id;

            lodash.isEqual(value1, value2);
        }

        return value1 === value2;
    }

}

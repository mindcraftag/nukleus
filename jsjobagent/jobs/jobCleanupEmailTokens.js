"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;
const moment      = require('moment');

module.exports = {

    type: "Job",
    name: "Cleanup old email tokens",
    manualStart: false,
    interval: 'hourly',

    process: async function(tools, log) {
        const threshold = moment().subtract(1, 'day');

        // find all users and clients that contain old email confirmation tokens
        // ----------------------------------------------------------------------------
        const User = mongoose.model('User');
        const usersResult = await User.updateMany({
            confirmEmailToken: { $exists: true },
            confirmEmailDate: { $lt: threshold }
        }, {
            $unset: {
                confirmEmailToken: 1,
                confirmEmailDate: 1,
                emailToConfirm: 1
            }
        }).exec();
        log("Updated users: " + usersResult.nModified);

        const Client = mongoose.model('Client');
        const clientsResult = await Client.updateMany({
            "address.confirmEmailToken": { $exists: true },
            "address.confirmEmailDate": { $lt: threshold }
        }, {
            $unset: {
                "address.confirmEmailToken": 1,
                "address.confirmEmailDate": 1,
                "address.emailToConfirm": 1
            }
        }).exec();
        log("Updated clients: " + clientsResult.nModified);
    }
};
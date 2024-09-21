"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment      = require('moment');
const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;

module.exports = {

    type: "Job",
    name: "Inactive users cleanup",
    manualStart: false,
    cronExp: "30 * * * *",

    process: async function(tools, log) {
        const threshold = moment().subtract(1, 'hours');

        const User = mongoose.model('User');
        await User.deleteMany({
            active: false,
            clientInvitationToken: { $exists: true },
            createdAt: { $lt: threshold }
        }).exec();
    }
};

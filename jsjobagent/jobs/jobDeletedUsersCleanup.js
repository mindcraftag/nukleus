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
  name: "Deleted users cleanup",
  manualStart: false,
  cronExp: "30 * * * *",

  process: async function(tools, log) {
    const threshold = moment().subtract(1, 'days');

    const User = mongoose.model('User');
    await User.deleteMany({
      deletedAt: { $lt: threshold },
      "memberships.0": { $exists: false },
      "removedMemberships.0": { $exists: false }
    }).exec();
  }
};

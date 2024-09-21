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

function millisToHours(ms) {
    return Math.floor(ms / 1000 / 60 / 60);
}

function locationSwitchAllowed(user) {
    if (user.lastLocationSwitchAt) {
        const hoursSinceLastSwitch = millisToHours((new Date()).getTime() - user.lastLocationSwitchAt.getTime());

        // We allow switching the location once per day.
        if (hoursSinceLastSwitch >= 24) {
            return true;
        } else {
            return false;
        }
    } else {
        // The user has never switched their location before, so we allow it.
        return true;
    }
}

module.exports = {

    type: "Job",
    name: "Set user location",
    manualStart: false,
    cronExp: "*/10 * * * *",

    process: async function(tools, log) {
        // Find all Users that have requested a location switch.
        const User = mongoose.model('User');
        const users = await User.find({
            nextLocation: { $exists: true },
            deletedAt: { $exists: false }
        });

        for (const user of users) {
            // If this user has recently changed their location, we do not switch it again.
            // The switch will eventually happen when this job runs again at a later date when
            // a location switch is allowed again.
            if (!locationSwitchAllowed(user)) {
                continue;
            }

            log(`Switching location of user ${user._id} from ${user.location} to ${user.nextLocation}`);
            await nsvc.locationService.setUserLocation(user._id, user.nextLocation);
        }
    }
};

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

const gracePeriodDays = 7;
const blockAfterSwitchDays = 2;

function millisToDays(ms) {
    return Math.floor(ms / 1000 / 60 / 60 / 24);
}

function locationSwitchAllowed(group) {
    const daysSinceCreation = millisToDays((new Date()).getTime() - group.createdAt.getTime());

    // Allow switching if still in the grace period.
    if (daysSinceCreation < gracePeriodDays) {
        return true;
    }

    if (group.lastLocationSwitchAt) {
        const daysSinceLastSwitch = millisToDays((new Date()).getTime() - group.lastLocationSwitchAt.getTime());

        // If the last switch was more than (or equal to) "blockAfterSwitchDays" ago, allow switching again.
        return daysSinceLastSwitch >= blockAfterSwitchDays;
    } else {
        // Allow switching if the group has never been switched before.
        return true;
    }
}

module.exports = {

    type: "Job",
    name: "Set group location",
    manualStart: false,
    cronExp: "*/10 * * * *",

    process: async function(tools, log) {
        // Assuming that a lot of members are added to a group right after it was created, we implement a "grace period" during which we will always switch the groups location if required.
        // After the grace period has ended we only switch the groups location at most once every 2 days.
        const Group = mongoose.model('Group');
        const groups = await Group.find({
            deletedAt: { $exists: false }
        });

        for (const group of groups) {
            if (!locationSwitchAllowed(group)) {
                continue;
            }

            try {
                const bestLocation = await nsvc.groupService.determineBestLocation(group._id);

                if (bestLocation !== group.location) {
                    log(`Switching location of group ${group._id} from ${group.location} to ${bestLocation}`);
                    await nsvc.locationService.setGroupLocation(group._id, bestLocation);
                }
            } catch (err) {
                // An error can occur when it's not possible to determine a best location, for example because the group has no members.
            }
        }
    }
};

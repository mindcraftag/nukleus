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
    name: "Deleted groups cleanup",
    manualStart: false,
    cronExp: "13 * * * *",

    process: async function(tools, log) {
        const threshold = moment().subtract(1, 'hour');

        const Group = mongoose.model('Group');
        const groups = await Group.find({
            deletedAt: { $lt: threshold }
        }).exec();

        if (groups.length) {

            const systemUserId = tools.getSystemUserId();
            nsvc.security.setSystemUserId(systemUserId);
            const User = mongoose.model('User');
            const systemUser = await User.findOne({_id: systemUserId}).exec();

            for (const group of groups) {
                try {
                    // Remove any users in this group
                    // ----------------------------------------------------
                    const users = await nsvc.groupService.getUsersOfGroup(group._id);
                    for (const user of users) {
                        let changed = false;

                        for (const membership of user.memberships) {
                            for (const mgroup of membership.groups) {
                                if (mgroup.equals(group._id)) {
                                    membership.groups.removeObject(mgroup);
                                    changed = true;
                                    break;
                                }
                            }
                        }

                        if (changed)
                            await user.save();
                    }

                    // Remove group folder if it exists
                    // ----------------------------------------------------
                    if (group.hasFolder) {
                        const folder = await nsvc.groupService.getGroupFolder(group.client, group._id);
                        if (folder) {
                            systemUser.setActiveMembership(group.client);
                            await nsvc.folderService.recursiveDelete(folder._id, group.client, systemUser, false);
                        }
                    }

                    await Group.deleteOne({ _id: group._id }).exec();

                } catch (err) {
                    log({severity: "error"}, `Error deleting group ${group._id}: ${err}`);
                }
            }
        }
    }
};

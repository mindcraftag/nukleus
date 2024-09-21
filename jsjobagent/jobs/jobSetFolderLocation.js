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

async function processFolder(folder, userLimit, groupLimit, log) {
    let limit;

    // Determine the new owner of the folder.
    const quotaUserId = await nsvc.folderService.getFolderQuotaUser(folder._id, folder.client);
    const quotaGroupId = await nsvc.folderService.getFolderQuotaGroup(folder._id, folder.client);

    // We get the date here to prevent issues with the date calculation when the job starts before
    // midnight but ends after midnight.
    const newModifiedDate = new Date();
    let owner = null;

    if (quotaUserId && quotaGroupId) {
        log.error(`Can't move folder ${folder._id} because it has both a quota user and a quota group.`);
    } else if (!quotaUserId && !quotaGroupId) {
        log.error(`Can't move folder ${folder._id} because it has neither a quota user nor a quota group.`);
    } else if (quotaUserId) {
        // The folder currently belongs to a user.

        // Calculate how many elements the user can move.
        const User = mongoose.model('User');
        const user = await User.findOne({
            _id: quotaUserId,
        }).exec();

        const lastDay = new Date();
        lastDay.setDate(lastDay.getDate() - 1);

        if (user.lastMovedElementsAt < lastDay || !user.movedElementsCount) {
            user.movedElementsCount = 0;
        }

        owner = user;
        limit = userLimit - user.movedElementsCount;
    } else {
        // The folder currently belongs to a group.

        // Calculate how many elements the user can move.
        const Group = mongoose.model('Group');
        const group = await Group.findOne({
            _id: quotaGroupId,
        }).exec();

        const lastDay = new Date();
        lastDay.setDate(lastDay.getDate() - 1);

        if (group.lastMovedElementsAt < lastDay || !group.movedElementsCount) {
            group.movedElementsCount = 0;
        }

        owner = group;
        limit = groupLimit - group.movedElementsCount;
    }

    if (limit <= 0) {
        // The User / Group has exhausted their limit of allowed moves per day.
        return;
    }

    // Actually move the folder.

    // We do not check beforehand if the moving folder would result in exceeding the limit, because then we always
    // allow the user to move at least one folder per day, regardless of size.
    await nsvc.locationService.setFolderLocation(folder, folder.nextLocation);
    const movedItems = await nsvc.folderService.getFolderItemsRecursive(folder._id, [], folder.client);
    const movedFolders = await nsvc.locationService.findAllFolders(folder._id);

    folder.nextLocation = undefined;
    await folder.save();

    owner.movedElementsCount += movedItems.length;
    owner.movedElementsCount += movedFolders.length + 1; // We need to add one to account for the parent folder.
    owner.lastMovedElementsAt = newModifiedDate;

    await owner.save();
}

module.exports = {

    type: "Job",
    name: "Set folder location",
    manualStart: false,
    cronExp: "*/10 * * * *",

    userLimit: 1000,
    groupLimit: 10000,

    process: async function(tools, log) {
        // Find all folder that should be moved to a new location.
        const Folder = mongoose.model('Folder');
        const folders = await Folder.find({
            deletedAt: { $exists: false },
            nextLocation: { $exists: true }
        });

        for (const folder of folders) {
            await processFolder(folder, this.userLimit, this.groupLimit, log);
        }
    }
};

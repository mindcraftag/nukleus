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

// This function returns a list of users in the specified client which do not have the permission to create private items.
async function findPublicOnlyUsersInClient(clientId) {
    const User = mongoose.model("User");
    const usersWithoutPrivateItems = [];

    const users = await User.find({}).exec();

    for (const user of users) {
        // Skip over system accounts
        if (user.isSystemUser()) {
            continue;
        }

        // We need to scan every client the user is in separately, because the different clients
        // might have different features enabled.
        for (const membership of user.memberships) {
            if (membership.client.toString() !== clientId.toString()) {
                continue;
            }
            user.setActiveMembership(membership.client);

            // Does this user have the permission to have private items?
            if (await nsvc.clientService.isFeatureAllowed(membership.client, "private_items", user)) {
                continue;
            }

            usersWithoutPrivateItems.push(user);
        }
    }

    return usersWithoutPrivateItems;
}

// This function returns a list of groups that do not have the permission to create private items.
async function findPublicOnlyGroupsInClient(clientId) {
    const Group = mongoose.model('Group');

    const groupsWithoutPrivateItems = [];
    const groups = await Group.find({
        client: clientId
    }).exec();

    for (const group of groups) {
        if (await nsvc.clientService.isGroupFeatureAllowed(group.client, "private_items", group)) {
            continue;
        }

        groupsWithoutPrivateItems.push(group);
    }

    return groupsWithoutPrivateItems;
}

module.exports = {

  type: "Job",
  name: "Force public",
  manualStart: false,
  interval: 'hourly',

  process: async function(tools, log) {
    const Client = mongoose.model("Client");
    const Item = mongoose.model("Item");

    const clients = await Client.find({});

    // Go over all clients.
    for (const client of clients) {
        // Find the users and groups that are not allowed to have private items.
        const usersWithoutPrivateItems = await findPublicOnlyUsersInClient(client._id);
        const groupsWithoutPrivateItems = await findPublicOnlyGroupsInClient(client._id);

        // In a single MongoDB update query:
        // - find all items that belong to the "public only" users and groups
        // - make them public
        await Item.updateMany({
            $or: [
                {
                    quotaUser: {
                        $in: usersWithoutPrivateItems.map(user => user._id)
                    },
                },
                {
                    quotaGroup: {
                        $in: groupsWithoutPrivateItems.map(group => group._id)
                    },
                }
            ],
            client: client._id,
            visibility: nsvc.model.ItemVisibility.Private
        }, {
            visibility: nsvc.model.ItemVisibility.Public
        })
    }
  }
};

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

// When both the client and the plan have a draft mode, we need to determine which one to use.
// This function returns the mode with the highest priority. In this case the priority is:
// 1. Forever
// 2. Public after grace
// 3. Delete after grace
function prefferedDraftMode(modeA, modeB) {
    if (modeA === modeB) {
        return modeA;
    }

    if (modeA === nsvc.model.DraftMode.FOREVER || modeB === nsvc.model.DraftMode.FOREVER) {
        return nsvc.model.DraftMode.FOREVER;
    }

    if (modeA === nsvc.model.DraftMode.PUBLIC_AFTER_GRACE || modeB === nsvc.model.DraftMode.PUBLIC_AFTER_GRACE) {
        return nsvc.model.DraftMode.PUBLIC_AFTER_GRACE;
    }

    return modeA;
}

module.exports = {

    type: "Job",
    name: "Handle draft items",
    manualStart: false,
    interval: 'daily',

    process: async function(tools, log) {
        // Since both the client and the plan decide how drafts are handled, we need to compute the effective draft mode and grace period for each client.
        const Client = mongoose.model('Client');
        const clients = await Client.find({}).populate("currentPlan").exec();

        const draftInfo = new Map();
        clients.forEach(client => {
            draftInfo[client._id] = {
                mode: prefferedDraftMode(client.draftMode, client.currentPlan.draftMode),
                gracePeriod: Math.max(client.draftGracePeriodDays, client.currentPlan.draftGracePeriodDays),
            }
        });

        // We can skip processing all items that belong to a client with draftMode = FOREVER,
        // since they won't be modified anyway.
        const relevantClients = clients
                                .map(client => client._id)
                                .filter(clientID => draftInfo[clientID].mode !== nsvc.model.DraftMode.FOREVER);

        // Find all non-deleted draft items that we might need to handle.
        const Item = mongoose.model('Item');
        const items = await Item.find({
            visibility: nsvc.model.ItemVisibility.Draft,
            client: {
                $in: relevantClients
            },
            deletedAt: {
                $exists: false
            }
        }).exec();

        // Go over all items and handle them according to the draft rules.
        for (const item of items) {
            const draftRules = draftInfo[item.client];
            const isGracePeriodOver = item.createdAt < new Date(Date.now() - draftRules.gracePeriod * 24 * 60 * 60 * 1000);

            // If the grace period is not over yet, we can skip this item.
            if (!isGracePeriodOver) {
                continue;
            }

            // If the item is allowed to be a draft forever, we also can skip this item.
            if (draftRules.mode === nsvc.model.DraftMode.FOREVER) {
                continue;
            }

            // If the item is supposed to become public after the grace period, we change it's visibility.
            if (draftRules.mode === nsvc.model.DraftMode.PUBLIC_AFTER_GRACE) {
                item.visibility = nsvc.model.ItemVisibility.Public;
                await item.save();
            }

            // If the item is supposed to be deleted after the grace period, we set the "deletedAt" field.
            if (draftRules.mode === nsvc.model.DraftMode.DELETE_AFTER_GRACE) {
                item.deletedAt = new Date();
                await item.save();
            }
        }
    }
};

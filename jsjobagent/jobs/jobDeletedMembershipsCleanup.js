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

async function removeUserMemberships(user, systemUserId, log) {
    for (const membership of user.removedMemberships) {
        await removeMembership(user, membership, systemUserId, log);
    }

    user.removedMemberships = [];
    await user.save();
}

async function removeMembership(user, membership, systemUserId, log) {

    const User = mongoose.model('User');
    const Item = mongoose.model('Item');
    const Folder = mongoose.model('Folder');
    const Client = mongoose.model('Client');
    const Purchase = mongoose.model('Purchase');

    const clientId = membership.client;

    log(`Deleting membership after grace period: ${user.account}/${clientId} (${user._id})`);

    const promises = [];

    // Check if the client still exists
    // -------------------------------------------------------------------------
    const client = await Client.findOne({
        _id: clientId,
        deletedAt: { $exists: false }
    }).exec();
    const clientExists = !!client;

    // Remove user's home folder
    // -------------------------------------------------------------------------
    if (clientExists) {
        nsvc.security.setSystemUserId(systemUserId);
        const systemUser = await User.findOne({_id: systemUserId}).exec();
        systemUser.setActiveMembership(clientId);
        const userHomeFolder = await nsvc.clientService.createUserHomeFolder(clientId, user._id);
        await nsvc.folderService.recursiveDelete(userHomeFolder._id, clientId, systemUser, false);
    }

    // Remove user's access tokens
    // -------------------------------------------------------------------------
    const AccessToken = mongoose.model('AccessToken');
    await AccessToken.deleteMany({ client: clientId, user: user }).exec();

    // Remove user's notifications
    // -------------------------------------------------------------------------
    const Notification = mongoose.model('Notification');
    await Notification.deleteMany({ client: clientId, user: user }).exec();

    // Remove the user from any ACL in items
    // -------------------------------------------------------------------------
    if (clientExists) {
        const items = await Item.find({
            client: clientId,
            "acl.user": user._id,
            deletedAt: {$exists: false}
        }).exec();

        for (const item of items) {
            for (const acl of item.acl) {
                if (acl.user && acl.user.equals(user._id)) {
                    item.acl.removeObject(acl);
                    promises.push(item.save());
                    break;
                }
            }
        }
    }

    // Remove the user from any ACL in folders
    // -------------------------------------------------------------------------
    if (clientExists) {
        const folders = await Folder.find({
            client: clientId,
            "acl.user": user._id,
            deletedAt: {$exists: false}
        }).exec();

        for (const folder of folders) {
            for (const acl of folder.acl) {
                if (acl.user && acl.user.equals(user._id)) {
                    folder.acl.removeObject(acl);
                    promises.push(folder.save());
                    break;
                }
            }
        }
    }

    // Remove the user from any ACL in clients
    // -------------------------------------------------------------------------
    if (clientExists) {
        for (const acl of client.acl) {
            if (acl.user && acl.user.equals(user._id)) {
                client.acl.removeObject(acl);
                promises.push(client.save());
                break;
            }
        }
    }

    // Deactivate user's purchases
    // ------------------------------------------------------------------------
    await Purchase.updateMany({
        user: user._id,
        client: clientId,
        active: true
    }, {
        $set: {
            active: false
        }
    });

    // Remove payment setup and customer
    // ------------------------------------------------------------------------
    if (membership.paymentSetup) {
        const PaymentSetup = mongoose.model('PaymentSetup');
        const paymentSetup = await PaymentSetup.findOne({ _id: membership.paymentSetup }).exec();

        if (paymentSetup.customerId) {
            await nsvc.paymentService.deleteCustomer(paymentSetup.customerId);
        }

        await PaymentSetup.deleteOne({ _id: membership.paymentSetup });
    }

    await Promise.all(promises);
}

module.exports = {

    type: "Job",
    name: "Cleanup removed memberships",
    manualStart: false,
    cronExp: "3 * * * *",

    process: async function(tools, log) {
        const threshold = moment().subtract(1, 'hours');
        const systemUserId = tools.getSystemUserId();

        const User = mongoose.model('User');
        const users = await User.find({
            $or: [
                { deletedAt: { $lt: threshold } },
                { deletedAt: { $exists: false } }
            ],
            "removedMemberships.0": { $exists: true }
        }).exec();

        const promises = [];
        for (const user of users) {
            promises.push(removeUserMemberships(user, systemUserId, log));
        }

        await Promise.all(promises);
    }
};

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
    name: "Deleted Clients cleanup",
    manualStart: false,
    interval: 'hourly',

    _deleteClientData: async function(clientId, userId) {
        const Item = mongoose.model('Item');
        const Folder = mongoose.model('Folder');
        const User = mongoose.model('User');
        const Job = mongoose.model('Job');
        const Group = mongoose.model('Group');

        const promises = [];

        // Mark all the clients items as deleted
        // ---------------------------------------------------------
        promises.push(Item.updateMany({
            client: clientId,
            deletedAt: { $exists: false }
        }, {
            $set: {
                deletedAt: new Date()
            }
        }, {
            __user: userId
        }).exec());

        // Mark all the clients folders as deleted
        // ---------------------------------------------------------
        promises.push(Folder.updateMany({
            client: clientId,
            deletedAt: { $exists: false }
        }, {
            $set: {
                deletedAt: new Date()
            }
        }, {
            __user: userId
        }).exec());

        // Mark groups as deleted
        // ---------------------------------------------------------
        promises.push(Group.updateMany({
            client: clientId,
            deletedAt: { $exists: false }
        }, {
            $set: {
                deletedAt: new Date()
            }
        }, {
            __user: userId
        }).exec());

        // Remove membership from users
        // ---------------------------------------------------------
        const users = await User.find({"memberships.client": clientId}).exec();
        for (const user of users) {
            for (const membership of user.memberships) {
                if (membership.client.equals(clientId)) {
                    user.memberships.removeObject(membership);
                    user.removedMemberships.push(membership);
                    if (user.memberships.length === 0) {
                        user.deletedAt = new Date();
                    }
                    promises.push(user.save());
                    break;
                }
            }
        }

        // Delete jobs directly
        // ---------------------------------------------------------
        promises.push(Job.deleteMany({ client: clientId }, { __user: userId }));

        // Delete access tokens
        // ---------------------------------------------------------
        const AccessToken = mongoose.model('AccessToken');
        promises.push(AccessToken.deleteMany({ client: clientId }).exec());

        // Delete attribute templates
        // ---------------------------------------------------------
        const AttributeTemplate = mongoose.model('AttributeTemplate');
        promises.push(AttributeTemplate.deleteMany({ client: clientId }).exec());

        // Delete categories
        // ---------------------------------------------------------
        const Category = mongoose.model('Category');
        promises.push(Category.deleteMany({ client: clientId }).exec());

        // Delete client stats
        // ---------------------------------------------------------
        const ClientStat = mongoose.model('ClientStat');
        promises.push(ClientStat.deleteMany({ client: clientId }).exec());

        // Delete collections
        // ---------------------------------------------------------
        const Collection = mongoose.model('Collection');
        promises.push(Collection.deleteMany({ client: clientId }).exec());

        // Delete conversations and conversation entries
        // ---------------------------------------------------------
        const Conversation = mongoose.model('Conversation');
        const ConversationEntry = mongoose.model('ConversationEntry');
        promises.push(new Promise(async (resolve, reject) => {
            const conversations = await Conversation.find({ client: clientId }).select("_id").exec();
            const conversationIds = conversations.map(x => x._id);
            await ConversationEntry.deleteMany({ conversation: conversationIds }).exec()
            await Conversation.deleteMany({ client: clientId }).exec()
            resolve();
        }));

        // Delete invoices and templates
        // ---------------------------------------------------------
        const Invoice = mongoose.model('Invoice');
        const InvoiceTemplate = mongoose.model('InvoiceTemplate');
        promises.push(InvoiceTemplate.deleteMany({ client: clientId }).exec());
        promises.push(Invoice.deleteMany({ client: clientId }).exec());

        // Delete licenses
        // ---------------------------------------------------------
        const License = mongoose.model('License');
        promises.push(License.deleteMany({ client: clientId }).exec());

        // Delete mails and templates
        // ---------------------------------------------------------
        const MailTemplate = mongoose.model('MailTemplate');
        const Mail = mongoose.model('Mail');
        promises.push(MailTemplate.deleteMany({ client: clientId }).exec());
        promises.push(Mail.deleteMany({ client: clientId }).exec());

        // Delete purchasables
        // ---------------------------------------------------------
        const Purchasable = mongoose.model('Purchasable');
        promises.push(Purchasable.deleteMany({ client: clientId }).exec());

        // Delete workflows and instances
        // ---------------------------------------------------------
        const Workflow = mongoose.model('Workflow');
        const WorkflowInstance = mongoose.model('WorkflowInstance');
        promises.push(WorkflowInstance.deleteMany({ client: clientId }).exec());
        promises.push(Workflow.deleteMany({ client: clientId }).exec());

        // Wait for all promises to resolve
        // ---------------------------------------------------------
        await Promise.all(promises);
    },

    _processDeadClientIds: function(refClientIds, foundClientIds, deadClientIds) {
        for (const foundClientId of foundClientIds) {
            if (!foundClientId._id)
                continue;

            let found = false;
            for (const refClientId of refClientIds) {
                if (foundClientId._id.equals(refClientId._id)) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                let alreadyInList = false;
                for (const id of deadClientIds) {
                    if (id.equals(foundClientId._id)) {
                        alreadyInList = true;
                        break;
                    }
                }

                if (!alreadyInList) {
                    deadClientIds.push(foundClientId._id);
                }
            }
        }
    },

    process: async function(tools, log) {
        const threshold = moment().subtract(1, 'hour');

        const Client = mongoose.model('Client');
        const Item = mongoose.model('Item');
        const Folder = mongoose.model('Folder');
        const Job = mongoose.model('Job');
        const PaymentSetup = mongoose.model('PaymentSetup');

        // Find all deleted clients in the database and remove all of their data
        // ----------------------------------------------------------------------------
        const clients = await Client.find({ deletedAt: { $lt: threshold }}).populate('paymentSetup').exec();

        for (const client of clients) {
            log("Deleting client after grace period: " + client._id);

            if (client.paymentSetup) {
                if (client.paymentSetup.customerId) {
                    await nsvc.paymentService.deleteCustomer(client.paymentSetup.customerId);
                }
                await PaymentSetup.deleteOne({ _id: client.paymentSetup });
            }

            await module.exports._deleteClientData(client._id, tools.job.createdBy);
            await Client.deleteOne({ _id: client._id }, { __user: tools.job.createdBy });
            log("Done deleting client.");
        }

        // Now look for any dead data that we might find in the database. This
        // should not be neccessary but in case any cleanups in the past went wrong, there might be
        // anything left in the database
        // ----------------------------------------------------------------------------
        const deadClientIds = [];
        const clientIds = await Client.find().select("_id").exec();
        const itemClientIds = await Item.aggregate([
            {$match: {deletedAt: {$exists: false}}},
            {$group: { _id: '$client' }}
        ]).exec();
        const folderClientIds = await Folder.aggregate([
            {$match: {deletedAt: {$exists: false}}},
            {$group: { _id: '$client' }}
        ]).exec();
        const jobClientIds = await Job.aggregate([
            {$group: { _id: '$client' }}
        ]).exec();

        module.exports._processDeadClientIds(clientIds, itemClientIds, deadClientIds);
        module.exports._processDeadClientIds(clientIds, folderClientIds, deadClientIds);
        module.exports._processDeadClientIds(clientIds, jobClientIds, deadClientIds);

        for (const deadClientId of deadClientIds) {
            log("Found dead client. Deleting its data: " + deadClientId);
            await module.exports._deleteClientData(deadClientId, tools.job.createdBy);
            log("Done deleting client data");
        }
    }
};

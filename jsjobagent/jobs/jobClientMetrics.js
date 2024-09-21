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

module.exports = {

    type: "Job",
    name: "Client metrics",
    manualStart: false,
    interval: 'hourly',

    process: async function(tools, log) {
        const Client = mongoose.model('Client');
        const ClientMetrics = mongoose.model('ClientMetrics');
        const ClientStat = mongoose.model('ClientStat');
        const Item = mongoose.model('Item');
        const Plan = mongoose.model('Plan');

        // First collect information about all stored items (count and filesize)
        // ----------------------------------------------------------------------------------
        const aggregate = Item.aggregate();
        aggregate.match({ deletedAt: { $exists: false }});
        aggregate.group({ _id: "$client", count: { $sum: 1 }, bytes: { $sum: "$filesize" }});

        const results = await aggregate.exec();
        let promises = [];

        // Do another aggregate for attachment sizes
        // ----------------------------------------------------------------------------------
        const aggregateAttachments = Item.aggregate();
        aggregateAttachments.match({ deletedAt: { $exists: false }});
        aggregateAttachments.unwind("$attachments");
        aggregateAttachments.group({ _id: "$client", bytes: { $sum: "$attachments.filesize" }});

        const resultsAttachments = await aggregateAttachments.exec();
        const resultsAttachmentsMap = new Map();
        for (const r of resultsAttachments) {
            resultsAttachmentsMap.set(r._id.toString(), r.bytes);
        }

        // Update metrics with those values
        // ----------------------------------------------------------------------------------
        for (const result of results) {
            const id = result._id.toString();
            let bytes = result.bytes;

            if (resultsAttachmentsMap.has(id))
                bytes += resultsAttachmentsMap.get(id);

            promises.push(ClientMetrics.updateOne({ client: result._id }, {
                "metrics.storedCount": parseInt(result.count),
                "metrics.storedBytes": parseInt(bytes)
            }));
        }

        await Promise.all(promises);

        // Now store all clients metrics in the clientstat collection for history
        // ----------------------------------------------------------------------------------
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth()+1;
        const day = now.getDate();
        const hour = now.getHours();

        promises = [];
        const clients = await Client.find({ deletedAt: { $exists: false }}).select("name metrics currentPlan nextPlan").populate("paymentSetup").exec();
        for (const client of clients) {
            const metrics = await ClientMetrics.findOne({ client: client._id });
            promises.push(ClientStat.create({
                client: client._id,
                plan: client.currentPlan,
                year: year,
                month: month,
                day: day,
                hour: hour,
                metrics: metrics.metrics
            }));
        }

        await Promise.all(promises);

        // In case clients wanted to switch their plan, do that now
        // ----------------------------------------------------------------------------------
        const plans = await Plan.find().select("name").exec();
        const plansMap = new Map();
        for (const plan of plans) {
            plansMap.set(plan._id.toString(), plan.name);
        }

        promises = [];
        for (const client of clients) {
            if (client.nextPlan) {
                const oldPlan = plansMap.get(client.currentPlan.toString());
                const newPlan = plansMap.get(client.nextPlan.toString());

                try {
                    nsvc.mailService.createPlanSwitchedMail(client.paymentSetup.address.email, client.name, oldPlan, newPlan)
                        .catch(function (err) {
                            log({severity: "error"}, err);
                        });
                }
                catch(err) {
                    log({ severity: error }, err.toString());
                }

                client.currentPlan = client.nextPlan;
                client.nextPlan = undefined;
                promises.push(client.save());
            }
        }

        await Promise.all(promises);
    }
};

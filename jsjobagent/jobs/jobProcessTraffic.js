"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc      = require('@mindcraftgmbh/nukleus-service');
const mongoose  = nsvc.model.mongoose;

module.exports = {

    type: "Job",
    name: "Process Traffic",
    manualStart: false,
    interval: "minutely",

    process: async function(tools, log) {
        const ApiRequest = mongoose.model('ApiRequest');
        const TrafficStat = mongoose.model('TrafficStat');
        const User = mongoose.model('User');
        const Group = mongoose.model('Group');
        const ItemStat = mongoose.model('ItemStat');

        // First get a list of all relevant api requests which were not processed already
        // -----------------------------------------------------------------------------------
        const requestObjs = await ApiRequest.find({ trafficProcessed: { $ne: true }}).select("_id").limit(100000).exec();
        const requestIds = requestObjs.map(x => x._id);

        // Aggregate all the traffic information of the found entries
        // -----------------------------------------------------------------------------------
        const aggregatedRequests = await ApiRequest.aggregate([
            {
                "$match": {
                    "_id": { $in: requestIds }
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": "$year",
                        "month": "$month",
                        "day": "$day",
                        "hour": "$hour",
                        "client": "$client",
                        "item": "$requestedItem",
                        "group": "$quotaGroup",
                        "user": "$quotaUser"
                    },
                    "calls": {
                        "$sum": 1.0
                    },
                    "bytes": {
                        "$sum": "$bytes"
                    }
                }
            }
        ]).exec();

        const aggregatedRequestsByUserGroup = await ApiRequest.aggregate([
            {
                "$match": {
                    "_id": { $in: requestIds }
                }
            },
            {
                "$group": {
                    "_id": {
                        "group": "$quotaGroup",
                        "user": "$quotaUser",
                        "client": "$client",
                    },
                    "bytes": {
                        "$sum": "$bytes"
                    }
                }
            }
        ]).exec();

        const aggregatedRequestsByItem = await ApiRequest.aggregate([
            {
                "$match": {
                    "_id": { $in: requestIds }
                }
            },
            {
                "$group": {
                    "_id": {
                        "item": "$requestedItem"
                    },
                    "bytes": {
                        "$sum": "$bytes"
                    }
                }
            }
        ]).exec();

        // Write the resulting information to TrafficStat collection
        // -----------------------------------------------------------------------------------
        for (const result of aggregatedRequestsByItem) {
            if (!result._id.item)
                continue;

            await ItemStat.findOneAndUpdate({
                item: result._id.item
            }, {
                $inc: {
                    "counts.trafficBytes": result.bytes
                }
            }, { upsert: true, useFindAndModify: true });
        }

        for (const result of aggregatedRequestsByUserGroup) {
            if (!result._id.client)
                continue;

            if (result._id.user) {
                await User.findOneAndUpdate({
                    _id: result._id.user,
                    "memberships.client": result._id.client
                }, {
                    $inc: { "memberships.$.usedTrafficQuotaBytes": result.bytes }
                });
            } else if (result._id.group) {
                await Group.findOneAndUpdate({
                    _id: result._id.group,
                    client: result._id.client
                }, {
                    $inc: { usedTrafficQuotaBytes: result.bytes }
                });
            }
        }

        for (const result of aggregatedRequests) {
            const filter = {
                item: result._id.item,
                user: result._id.user,
                group: result._id.group,
                client: result._id.client,

                year: result._id.year,
                month: result._id.month,
                day: result._id.day,
                hour: result._id.hour,
            };

            const data = {
                calls: result.calls,
                bytes: result.bytes
            }

            await TrafficStat.findOneAndUpdate(filter, { $inc: data }, { upsert: true, useFindAndModify: true });
        }

        // Set all the api request entries as processed
        // -----------------------------------------------------------------------------------
        await ApiRequest.updateMany({ _id: { $in: requestIds }}, { $set: { trafficProcessed: true }} );

        log({ severity: "info"}, `Processed traffic for ${requestIds.length} requests`);
    }
};

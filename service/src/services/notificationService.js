"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const model       = require('@mindcraftgmbh/nukleus-model');
const mongoose    = model.mongoose;
const logger      = require('../tools/logger');

exports.createNotification = async function(userId, clientId, text, attachedObjects) {
    const Notification = mongoose.model('Notification');
    const notification = new Notification({
        user: userId,
        client: clientId,
        text: text,
        attachedObjects: attachedObjects
    });

    await notification.save();
};

exports.getMyNotifications = async function(userId, clientId, maxCount) {
    if (!userId)
        throw "No user specified!";

    if (!clientId)
        throw "No client specified";

    const Item = mongoose.model('Item');
    const Notification = mongoose.model('Notification');
    const query = Notification.find({
        user: userId,
        client: clientId
    }).sort({ createdAt: 'desc' });

    if (maxCount)
        query.limit(maxCount);

    const notifications = await query.exec();
    const result = [];

    for (const notification of notifications) {
        const attachedObjects = [];

        if (Array.isArray(notification.attachedObjects)) {
            for (const id of notification.attachedObjects) {

                const item = await Item.findOne({
                    _id: id,
                    deletedAt: { $exists: false },
                    client: clientId
                }).select("name autoDestructAt").exec();

                attachedObjects.push({
                    _id: id,
                    exists: item !== null,
                    name: item ? item.name : null,
                    autoDestructAt: item ? item.autoDestructAt : null
                });
            }
        }

        result.push({
            _id: notification._id,
            text: notification.text,
            readAt: notification.readAt,
            attachedObjects: attachedObjects,
            createdAt: notification.createdAt
        });
    }

    return result;
};

exports.markAsRead = async function(userId, clientId, notificationId) {
    const Notification = mongoose.model('Notification');
    await Notification.updateOne({
        user: userId,
        client: clientId,
        _id: notificationId,
        readAt: { $exists: false }
    }, {
        readAt: new Date()
    });
}

exports.markAllAsRead = async function(userId, clientId) {
    const Notification = mongoose.model('Notification');
    await Notification.updateOne({
        user: userId,
        client: clientId,
        readAt: { $exists: false }
    }, {
        readAt: new Date()
    });
}

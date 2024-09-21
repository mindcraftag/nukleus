"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const logger    = require('../tools/logger');
const aclTools  = require('../tools/aclTools');
const model     = require('@mindcraftgmbh/nukleus-model');
const mongoose  = model.mongoose;

// This is the amount of listeners a user may register per instance. Because there might be multiple
// instances of the API running (for example on Kubernetes), this limit can only be checked for a single pod!
// Therefore it might be possible for a user to have more listeners than this, but since WebSockets are relatively
// cheap, it's not enough to cause performance issues.
const MAX_LISTENERS_PER_USER_AND_POD = 5;

let listeners = new Map();
let listenersByClient = new Map();

function sendTo(map, clientId, folderId, jsonData, eventType) {
    if (map.has(clientId)) {
        const listeners = map.get(clientId);
        for (const listener of listeners.values()) {
            try {
                //console.log("Listener: ", listener.userId, listener.user.account, listener);
                if (listener.listenToFolders.includes(folderId) && listener.subscriptions.includes(eventType)) {
                    //console.log("Sending event...");
                    listener.ws.send(jsonData);
                }
            } catch (err) {
                logger.error(err);
            }
        }
    }
}

function addToMap(map, clientId, listener) {
    removeFromMap(map, clientId, listener.ws.id);

    if (!map.has(clientId)) {
        map.set(clientId, new Map());
    }

    const list = map.get(clientId);
    list.set(listener.ws.id, listener);
}

function removeFromMap(map, clientId, wsID) {
    if (map.has(clientId)) {
        const listeners = map.get(clientId);

        if (listeners.has(wsID)) {
            listeners.delete(wsID);
        }

        if (listeners.size === 0) {
            map.delete(clientId);
        }
    }
}

async function getUser(userId, clientId) {
    const User = mongoose.model("User");
    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(userId) }).select("name client acl superadmin memberships").exec();

    if (!user.setActiveMembership(clientId))
        throw `User ${userId} is not member of client ${clientId}`;

    return user;
}

async function getFolders(folderIds, clientId) {

    // Get the client
    // ---------------------------------------------------------------
    clientId = new mongoose.Types.ObjectId(clientId);
    const Client = mongoose.model('Client');
    const client = await Client.findOne({ _id: clientId }).select("acl").exec();

    // Convert folderIds to objectIds
    // ---------------------------------------------------------------
    const folderObjectIds = [];
    let includesRootFolder = false;

    for (const folderId of folderIds) {
        if (folderId !== "0")
            folderObjectIds.push(new mongoose.Types.ObjectId(folderId));
        else
            includesRootFolder = true;
    }

    // Get the folders
    // ---------------------------------------------------------------
    const Folder = mongoose.model("Folder");
    const aggregate = Folder.aggregate();

    aggregate.match({_id: { $in: folderObjectIds } });
    aggregate.match({"client": clientId});
    aggregate.match({"deletedAt": { $exists: false }});

    let folders = await aggregate.exec();

    // Get ACL information for all folders
    // ---------------------------------------------------------------
    await aclTools.getAclForAll(folders);

    if (includesRootFolder) {
        folders.push({
            _id: 0,
            acl: client.acl
        })
    }

    return folders;
}

exports.switchFolders = async function(wsID, clientId, folders) {
    if (listeners.has(wsID)) {
        const listener = listeners.get(wsID);
        const user = await getUser(listener.user._id, clientId);
        if (user) {
            // Get the folders from the database including ACL. Then filter those
            // by what the user may actually see and thus subscribe to
            // ---------------------------------------------------------------------------
            let folderObjects = await getFolders(folders, clientId);
            folderObjects = await aclTools.filterElements(folderObjects, user, "read");
            let folderIdArray = folderObjects.map(x => x._id.toString());

            // Store this array of folder IDs as listened folders
            // ---------------------------------------------------------------------------
            listener.listenToFolders = folderIdArray;
            logger.info(`User ${user.name} (${user._id}) with WebSocket ${wsID} switched folders to [${folderIdArray.join(',')}] of client ${clientId}`);
        }
        else {
            console.error("switchFolders(): User not found: " + listener.user._id);
        }
    } else {
        console.error("switchFolders(): WebSocket not found: " + wsID);
    }
}

exports.subscribe = function(user, ws, subscriptions) {
    const clients = [];

    if (!Array.isArray(subscriptions))
        throw "Subscriptions must be an array";

    // Check in which clients the user may write items and thus has permission
    // to see draft state items and in which he doesn't
    // ------------------------------------------------------------------------
    for (const membership of user.memberships) {
        clients.push(membership.client.toString());
    }

    // Create listener object and subscribe it
    // ------------------------------------------------------------------------
    const listener = {
        userId: user._id.toString(),
        userObjectId: user._id,
        user: user,
        ws: ws,
        clients: clients,
        listenToFolders: [],
        subscriptions: subscriptions
    };

    // Use the unique ID of the WebSocket to identify it's listener
    listeners.set(ws.id, listener);

    for (const clientId of listener.clients) {
        addToMap(listenersByClient, clientId, listener);
    }

    // To limit the amount of open websocket connections and listeners a single
    // user can have, we check if there are more than MAX_LISTENERS_PER_USER_AND_POD
    // listeners for the user. If there are, then we'll remove the oldest ones.

    // Start by making a list of all listeners that belong to this user
    const listenerIDs = [];
    listeners.forEach((listener, listenerID) => {
        if (listener.userId === user._id.toString()) {
            listenerIDs.push(listenerID);
        }
    });

    const numToRemove = listenerIDs.length - MAX_LISTENERS_PER_USER_AND_POD;

    // Note: If there are no listeners to remove, then the for-loop will never start
    for (let i = 0; i < numToRemove; i++) {
        const listener = listeners.get(listenerIDs[i]);
        // Terminate the WebSocket connection
        listener.ws.terminate();

        // Remove the listener from the listenersByClient map
        for (const clientId of listener.clients) {
            removeFromMap(listenersByClient, clientId, listener.ws.id);
        }

        // Finally remove it from the listeners map
        listeners.delete(listenerIDs[i]);
    }

    logger.info(`New listener with ${clients.length} clients subscribed to ${subscriptions.join(',')}. Total: ${listeners.size}`);
};

exports.unsubscribe = function(wsID) {
    if (listeners.has(wsID)) {
        const listener = listeners.get(wsID);

        for (const clientId of listener.clients) {
            removeFromMap(listenersByClient, clientId, wsID);
        }

        listeners.delete(wsID);
        logger.info("Listener removed. Total: " + listeners.size);
    }
};

let ItemChangeStream, FolderChangeStream, JobChangeStream, UserChangeStream, NotificationChangeStream;

// This function will call the specified callback for every listener that belongs
// to the specified user and is subscribed to the event type.
const forEachListenerOfUser = async (userID, eventType, callback) => {
    for (const listener of listeners.values()) {
        if (listener.userId === userID && listener.subscriptions.includes(eventType)) {
            await callback(listener);
        }
    }
}

exports.init = function() {
    logger.info("Starting update service.");

    const Item = mongoose.model("Item");
    const Folder = mongoose.model("Folder");
    const Job = mongoose.model("Job");
    const User = mongoose.model("User");
    const Notification = mongoose.model("Notification");

    // ----------------------------------------------------------------------------
    // Watch items
    // ----------------------------------------------------------------------------
    ItemChangeStream = model.watchChanges('Item', async function(data) {
        if (listeners.size > 0) {
            const updatedFields = data?.updateDescription?.updatedFields
                ? Object.keys(data.updateDescription.updatedFields)
                : [];

            // If the only updated fields are "updatedAt" and "uploadHeartbeat", then we ignore
            // this event and don't send an update to the clients.
            if (updatedFields.length === 2 && updatedFields.includes("updatedAt") && updatedFields.includes("uploadHeartbeat")) {
                return;
            }

            const id = data.documentKey._id;
            const op = data.operationType;
            const item = await Item.findOne({ _id: id }).select("folder client published").exec();
            const folderId = (item && item.folder) ? item.folder.toString() : "0";

            const event = {
                type: 'Item',
                id: id ? id.toString() : null,
                folder: folderId,
                operation: op
            };

            //console.log(event);

            const jsonData = JSON.stringify(event);
            const clientId = item ? item.client.toString() : "";
            sendTo(listenersByClient, clientId, folderId, jsonData, "item");
        }
    });

    // ----------------------------------------------------------------------------
    // Watch folders
    // ----------------------------------------------------------------------------
    FolderChangeStream = model.watchChanges('Folder', async function(data) {
        if (listeners.size > 0) {

            const id = data.documentKey._id;
            const op = data.operationType;
            const folder = await Folder.findOne({ _id: id }).select("parent client").exec();
            const folderId = (folder && folder.parent) ? folder.parent.toString() : "0";

            const event = {
                type: 'Folder',
                id: id ? id.toString() : null,
                folder: folderId,
                operation: op
            };

            //console.log(event);

            const jsonData = JSON.stringify(event);
            const clientId = folder ? folder.client.toString() : "";
            sendTo(listenersByClient, clientId, folderId, jsonData, "folder");
        }
    });

    // ----------------------------------------------------------------------------
    // Watch jobs
    // ----------------------------------------------------------------------------
    JobChangeStream = model.watchChanges('Job', async function(data) {
        if (listeners.size > 0) {

            const id = data.documentKey._id;
            const job = await Job.findOne({ _id: id }).select("type state progress createdBy").exec();
            if (job && job.createdBy) {
                const userId = job.createdBy.toString();

                forEachListenerOfUser(userId, "job", (listener) => {
                    const op = data.operationType;

                    const jsonData = JSON.stringify({
                        type: 'Job',
                        id: id,
                        job: job,
                        operation: op
                    });

                    try {
                        listener.ws.send(jsonData);
                    } catch (err) {
                        logger.error(err);
                    }
                });
            }
        }
    });

    // ----------------------------------------------------------------------------
    // Watch notifications
    // ----------------------------------------------------------------------------
    NotificationChangeStream = model.watchChanges('Notification', async function(data) {
        if (listeners.size > 0) {

            const id = data.documentKey._id;
            const notification = await Notification.findOne({ _id: id }).select("user").exec();
            if (notification && notification.user) {
                const userId = notification.user.toString();

                forEachListenerOfUser(userId, "notification", (listener) => {
                    const op = data.operationType;

                    const jsonData = JSON.stringify({
                        type: 'Notification',
                        id: id,
                        operation: op
                    });

                    try {
                        listener.ws.send(jsonData);
                    } catch (err) {
                        logger.error(err);
                    }
                });
            }
        }
    });

    // ----------------------------------------------------------------------------
    // Watch users
    // ----------------------------------------------------------------------------
    UserChangeStream = model.watchChanges('User', async function(data) {
        if (listeners.size > 0) {

            const id = data.documentKey._id;
            const userId = id.toString();

            await forEachListenerOfUser(userId, "user", async (listener) => {
                const user = await User.findOne({ _id: id }).exec();

                const jsonData = JSON.stringify({
                    type: 'User',
                    id: id,
                    user: user,
                    operation: data.operationType
                });

                try {
                    listener.ws.send(jsonData);
                } catch (err) {
                    logger.error(err);
                }
            });
        }
    });
};

exports.reset = function() {
    listeners.clear();
    listenersByClient?.clear();
    JobChangeStream?.close();
    ItemChangeStream?.close();
    FolderChangeStream?.close();
    NotificationChangeStream?.close();
    UserChangeStream?.close();
};

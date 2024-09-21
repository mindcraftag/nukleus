"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const express       = require('express');
const nsvc          = require('@mindcraftgmbh/nukleus-service');
const mongoose      = nsvc.model.mongoose;
const log           = require("log4js").getLogger();
const router        = express.Router();
const { randomUUID } = require("crypto");

module.exports = {
    path: "/api/ws",
    router: router,
    permissions: [ ]
};

// ############################################################################################################
//  Updates websocket connection
// ############################################################################################################
router.ws('/', function(ws, req) {

    ws.isAlive = true;

    log.info("Websocket: new connection");

    // create a timeout after which the socket will be terminated if no authentication is made
    const timeout = setTimeout(function() {
        log.warn("Websocket: timed out before authenticating");
        ws.terminate();
    }, 30000);

    ws.on('message', async function(m) {
        try {
            ws.isAlive = true;
            const msg = JSON.parse(m);
            switch(msg.type) {
                case "ping": {
                    break;
                }
                case "auth": {
                    const decoded = nsvc.security.verifyToken(msg.token);
                    if (decoded) {
                        const userId = decoded.id;
                        const User = mongoose.model('User');
                        const user = await User.findById(userId, {password: 0}).exec();
                        if (!user) {
                            ws.terminate();
                            log.error("Websocket: user not found");
                        } else {
                            log.info("Websocket: authenticated");
                            // clear the disconnect timeout
                            clearTimeout(timeout);

                            // get the users default client
                            for (const membership of user.memberships) {
                                if (membership.primary) {
                                    ws.defaultClient = membership.client;
                                }
                            }

                            if (!ws.defaultClient)
                                log.error("Could not determine users default client: " + userId);

                            ws.send(JSON.stringify({type: "authenticated", message: "Welcome " + user.name }));
                            ws.userId = userId;
                            // Assign this WebSocket a unique ID to identify it
                            ws.id = randomUUID();
                            nsvc.updateService.subscribe(user, ws, msg.subscriptions);
                        }
                    } else {
                        log.warn("Websocket: jwt invalid");
                        ws.terminate();
                    }

                    break;
                }

                case "switchFolders": {
                    if (ws.id) {
                        if (Array.isArray(msg.folders)) {
                            const client = msg.client || ws.defaultClient;
                            await nsvc.updateService.switchFolders(ws.id, client, msg.folders);
                        } else {
                            log.warn("Websocket: trying to switch folders but folders is not an array");
                            ws.terminate();
                        }
                    } else {
                        log.warn("Websocket: trying to switch folder but not authenticated yet!");
                        ws.terminate();
                    }
                    break;
                }
            }
        }
        catch(err) {
            log.error("Websocket: " + err.toString());
        }
    });

    ws.on('close', function() {
        nsvc.updateService.unsubscribe(ws.id);
        log.info("Websocket: closed");
    })
});

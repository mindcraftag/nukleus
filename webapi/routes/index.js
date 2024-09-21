"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fs        = require("fs");
const path      = require("path");
const log4js    = require("log4js");
const nsvc      = require('@mindcraftgmbh/nukleus-service');
const mongoose  = nsvc.model.mongoose;
const log       = log4js.getLogger();

module.exports = {
    setupRoutes: async function(app) {
        log.info("Creating routes...");

        let permissions = [];

        // Scan all routers, use them with express and collect their permissions
        // ---------------------------------------------------------------------------
        fs.readdirSync(__dirname)
        .filter(function(file) {
            return (file.indexOf(".") !== 0) && (file !== "index.js");
        })
        .forEach(function(file) {
            var routerModule = require(path.join(__dirname, file));
            log.info("Creating routes for path '" + routerModule.path + "'");
            routerModule.router.path = routerModule.path;
            app.use(routerModule.path, routerModule.router);

            if (Array.isArray(routerModule.permissions)) {
                for (const rp of routerModule.permissions) {
                    let found = false;
                    for (const p of permissions) {
                        if (p.name === rp.name) {
                            found = true;
                            break;
                        }
                    }
                    if (!found)
                        permissions.push(rp);
                }
            }
        });

        // Save the collected permissions in the db
        // ---------------------------------------------------------------------------
        try {
            await nsvc.permissionService.addPermissions(permissions);
        }
        catch(err) {
            log.error(err);
        }

    }
};

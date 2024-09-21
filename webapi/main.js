"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const helmet        = require('helmet');
const cluster       = require('cluster');
const compression   = require('compression');
const express       = require('express');
const expressWs     = require('express-ws');
const bodyParser    = require('body-parser');
const log4js        = require("log4js");
const morgan        = require("morgan");
const cors          = require("cors");
const routes        = require('./routes');
const nsvc          = require('@mindcraftgmbh/nukleus-service');

let app = null;
let server = null;

exports.run = async function(configFile) {

    // init logging
    // -----------------------------------------------------
    const isWorker = cluster.isWorker;
    log4js.configure({
        pm2: isWorker,
        appenders: {
            filelog: { type: 'file', filename: `logs/app.log`, maxLogSize: 10485760, backups: 3, compress: true },
            consolelog: { type: 'console' }
        },
        categories: {
            default: { appenders: ['filelog', 'consolelog'], level: 'debug' }
        }
    });

    const appLog = log4js.getLogger();
    morgan.token('username', function (req, res) { return req.user ? req.user.account : "anonymous"; });
    morgan.token('ip', function (req, res) { return req.headers["x-forwarded-for"] || `${req.connection.remoteAddress}:${req.connection.remotePort}`; });
    const httpLog = morgan(":ip - :username - \":method :url HTTP/:http-version\" :status :res[content-length] :response-time ms \":referrer\" \":user-agent\"", {
        "stream": {
            "write": function(str) { appLog.debug(str.trim()); }
        }
    });

    nsvc.logger.hook(function(severity, message, ...params) {
        switch(severity) {
            case "info": appLog.info(message, ...params); break;
            case "debug": appLog.debug(message, ...params); break;
            case "warn": appLog.warn(message, ...params); break;
            case "error": appLog.error(message, ...params); break;
        }
    });

    // initialize and read config
    // -----------------------------------------------------
    appLog.info('Starting up...');
    appLog.info('This processor architecture is ' + process.arch);
    appLog.info('This process is pid ' + process.pid);
    appLog.info('This platform is ' + process.platform);

    if (isWorker) {
        appLog.info('Working in cluster mode!');
    } else {
        appLog.info('NOT working in cluster mode!');
    }

    // load config defaults
    nsvc.config.load("./config/config.defaults.json");

    // load local configuration file
    nsvc.config.load(configFile);

    // try loading configuration from docker secret if available
    nsvc.config.load("/etc/nukleus/config.json");

    // express initialization
    // -----------------------------------------------------
    app = express();

    if (nsvc.config.trust_proxy)
        app.set('trust proxy', nsvc.config.trust_proxy)

    app.use(httpLog);
    app.use(cors());
    app.use(compression());
    app.use(nsvc.paymentService.stripeEventParser);
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json({ limit: '20mb' }));
    app.use(helmet.hidePoweredBy({setTo: 'Nukleus'}));
    app.use(helmet.noSniff());
    app.use(helmet.hsts());
    app.use(helmet.frameguard());
    app.use(helmet.xssFilter());
    app.use(nsvc.trafficCounter());

    // initialize and run app
    // -----------------------------------------------------
    nsvc.security.init(nsvc.config.server.url);
    nsvc.mailService.init(nsvc.config.mailservice);
    nsvc.limiting.init(nsvc.config.limiting);

    // Initialize Express Websocket for updates
    // -----------------------------------------------------
    const wsInstance = expressWs(app);
    const wss = wsInstance.getWss();

    setInterval(function() {
        wss.clients.forEach(function(ws) {
            if (!ws.isAlive) {
                appLog.log("Websocket timed out: " + ws.userId);
                return ws.terminate();
            }

            //appLog.debug("PING to " + ws.userId);
            ws.isAlive = false;
            ws.send(JSON.stringify({type: "ping"}));
        });
    }, 30000);

    // Initialize database model
    // -----------------------------------------------------
    try {
        await nsvc.model.init(nsvc.config, appLog);
        nsvc.model.installIndices();
    }
    catch(err) {
        appLog.error(err);
        process.exit(-1);
        return;
    }

    try {
        // Ensure database content
        // -----------------------------------------------------
        app.defaultStorage = await nsvc.ensureDbContent.createDefaultStorageIfNecessary();
        app.defaultPlan = await nsvc.ensureDbContent.createDefaultPlanIfNecessary(app.defaultStorage);
        app.defaultClient = await nsvc.ensureDbContent.createNukleusClientIfNecessary(app.defaultPlan);
        app.adminPassword = await nsvc.ensureDbContent.createAdminIfNecessary(app.defaultClient);
        app.systemUserId = await nsvc.ensureDbContent.createSystemIfNecessary(app.defaultClient);

        //await nsvc.ensureDbContent.fixUsersAsArray();
        //await nsvc.ensureDbContent.clearBrokenThumbnails(app.systemUserId);
        //await nsvc.ensureDbContent.ensureClientIsSet(app.defaultClient);   // use only for development
        //await nsvc.ensureDbContent.moveFolderBetweenClients("5d7a05b3e15070d0af42491b", "5d80ef7e63e6d1bbdc69793f", app.systemUserId);
        //await nsvc.ensureDbContent.ensureClientPaymentSetups();
        //await nsvc.ensureDbContent.ensureLinearTextureEncoding();
        //console.log("System user token: " + nsvc.security.createToken(app.systemUserId, null, "1d"));

        nsvc.security.setSystemUserId(app.systemUserId);
        routes.setupRoutes(app);
        nsvc.plugins.scan(null, appLog);
        nsvc.updateService.init();
        nsvc.paymentService.init(nsvc.config.payments);
    }
    catch(err) {
        appLog.error(err);
    }

    try {
        await nsvc.fileStorage.init(nsvc.config.location);
        //console.log(await nsvc.ensureDbContent.cleanAdditionalFilesFromBuckets());
    }
    catch(err) {
        appLog.error(err);
        process.exit(-1);
        return;
    }

    server = app.listen(nsvc.config.server.port, function () {
        appLog.info('Server is up on port: ' + nsvc.config.server.port);
    });

    app.config = nsvc.config;

    // Special route to retrieve all routes. ONLY FOR SUPERADMINS!
    // ----------------------------------------------------------------------------------------------------------
    const routesMap = new Map();
    const routers = app._router.stack.filter(x => x.name === "router");

    for (const router of routers) {
        for (const handle of router.handle.stack) {
            const route = handle.route;

            if (route.path.endsWith(".websocket"))
                continue;

            // We have a new path, create an entry for it or see if it already exists
            // -------------------------------------------------------
            const path = router.handle.path + route.path;
            let entry;
            if (routesMap.has(path)) {
                entry = routesMap.get(path);
            } else {
                entry = {
                    path: path,
                    methods: []
                };
                routesMap.set(path, entry);
            }

            // Go through all request functions and see which is an access
            // handler by calling it with no parameters. access handlers
            // will return some information, others won't
            // -------------------------------------------------------
            for (const handler of route.stack) {

                let found = false;
                for (const method of entry.methods) {
                    if (method.method === handler.method) {
                        found = true;
                        break;
                    }
                }

                if (found) {
                    // We already have this method covered. but in the stack might be more
                    // handlers with other methods. Continue searching
                    continue;
                }

                try {
                    const access = await handler.handle();
                    if (!access) {
                        console.error("Method has no security handle: " + handler.method + " " + path);
                    } else {
                        entry.methods.push({
                            method: handler.method,
                            access: access
                        });
                    }
                }
                catch(err) {
                    // this will hit, if the middleware is NOT an access handler. ignore it
                }
            }
        }
    }

    const routesArray = Array.from(routesMap.values());

    app.get("/api/sa/routes", nsvc.security.checkAccess([], { needsSuperAdmin: true }), function(req, res) {
        res.json(routesArray);
    });

    process.on("unhandledRejection", (err, prom) => {
        console.error("unhandled rejection:", err, prom, err.stack);
    });

    return app;
};

module.exports.stop = async function() {
    if (nsvc.model)
        nsvc.model.shutdown();
    if (server)
        server.close();
};

// Make sure all modules are stopped properly when pressing Ctrl + C.
// This makes local testing easier.
process.on('SIGINT', function() {
    module.exports.stop();
});

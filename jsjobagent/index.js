"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const log4js    = require('log4js');
const nsvc      = require('@mindcraftgmbh/nukleus-service');
const agent     = require('./agent');
const jobs      = require('./jobs');

process.on('uncaughtException', function(err) {
  console.error("An uncaught exception occurred");
  console.error(err);
  console.error(err.stack);
});

process.on('unhandledRejection', function(err) {
  console.error("An unhandled rejection occurred");
  console.error(err);
  console.error(err.stack);
});

process.on('SIGINT', function() {
  console.log("Received SIGINT. Stopping job agent");
  process.exit(-1);
});

(async function() {
  let jobAgent;

  // load config defaults
  nsvc.config.load("./config/config.defaults.json");

  // load local configuration file
  nsvc.config.load("./config/config.json");

  // try loading configuration from docker secret if available
  nsvc.config.load("/etc/nukleus/config.json");

  // init logging
  // --------------------------------------------------------------------------
  log4js.configure({
    appenders: {
      filelog: { type: 'file', filename: 'logs/jsjobs.log', maxLogSize: 10485760, backups: 3, compress: true },
      consolelog: { type: 'console' }
    },
    categories: {
      default: { appenders: ['filelog', 'consolelog'], level: 'debug' }
    }
  });

  const log = log4js.getLogger();

  if (nsvc.config.logdna)
    nsvc.logger.initLogDna(nsvc.config.logdna);

  nsvc.logger.hook(function(severity, message, ...params) {
    switch(severity) {
      case "info": log.info(message, ...params); break;
      case "warn": log.warn(message, ...params); break;
      case "error": log.error(message, ...params); break;
      case "debug": log.debug(message, ...params); break;
    }
  });

  // Initialize model & plugins
  // --------------------------------------------------------------------------
  try {
    await nsvc.model.init(nsvc.config, log);
  }
  catch(err) {
    log.error(err);
    process.exit(-1);
    return;
  }

  // When we loose connection to the database, disconnect from the JobScheduler because we can't process any jobs without a database connection.
  // Note: We don't need to reconnect to the JobScheduler when reconnecting to the database, because the JobAgent from nukleus-service does that.
  nsvc.model.mongoose.connection.on("disconnected", () => {
    console.log("Disconnected from database, stopping JobAgent");
    jobAgent.disconnect();
  });

  try {
    await nsvc.mailer.init(nsvc.config.mailer);
    nsvc.mailService.init(nsvc.config.mailService);
    const defaultClient = await nsvc.ensureDbContent.createNukleusClientIfNecessary();
    const systemUserId = await nsvc.ensureDbContent.createSystemIfNecessary(defaultClient);
    nsvc.jobTools.setSystemUserId(systemUserId);
    nsvc.plugins.scan(null, log);
    nsvc.paymentService.init(nsvc.config.payments);
    jobs.init();
  }
  catch(err) {
    log.error(err);
  }

  try {
    await nsvc.fileStorage.init(nsvc.config.location);
  }
  catch(err) {
    log.error(err);
    process.exit(-1);
    return;
  }

  if (nsvc.config.debug && nsvc.config.debug.job_name) {
    // We have a debug entry in the config. This means we're not registering as a job agent but
    // only executing this job with the configured token
    await agent.debug(nsvc.config.debug);
  } else {
    jobAgent = await agent.run();
    jobAgent.run().catch(function(err) {
      console.error(err);
    });
    console.log("Agent started.");
  }
})();

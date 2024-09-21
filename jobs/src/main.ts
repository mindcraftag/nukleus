import log4js from "log4js";
import nsvc from "@mindcraftgmbh/nukleus-service";
import * as k8s from "@kubernetes/client-node";
import { Node } from "./node/Node";
import os from "os";
import axios from "axios";
import { LeaderInstance } from "./LeaderInstance";
import { sleep } from "./common/tools";
import * as db from "./common/db";

let log4jLogger: log4js.Logger | undefined;

async function main() {
  const logger = await init();
  log4jLogger = logger;
  const defaultClient = await nsvc.ensureDbContent.createNukleusClientIfNecessary(undefined);
  const systemUserId = await nsvc.ensureDbContent.createSystemIfNecessary(defaultClient);

  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();

  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

  if (!process.env["POD_NAMESPACE"]) {
    logger.error("POD_NAMESPACE is not defined.");
    process.exit(1);
  }

  // Check the cli params to decide if a leader or node should be started.
  const jobSystemType = process.env["JOB_SYSTEM_TYPE"];
  if (jobSystemType === "leader") {
    logger.info("Starting leader instance.");
    new LeaderInstance(4040, k8sApi, logger, systemUserId, axios, os.hostname(), process.env["POD_NAMESPACE"]);
  } else if (jobSystemType === "node") {
    logger.info("Starting node instance.");
    new Node(9000, logger, systemUserId, 30 * 1000);
  } else {
    logger.info("Missing environment variable JOB_SYSTEM_TYPE. Must specify leader or node mode.");
    await sleep(5 * 60 * 1000);
    process.exit(1);
  }
}

async function init() {
  // try loading configuration from docker secret if available
  // read from the nukleus-api configuration first, because it contains information
  // about the database and security key
  await nsvc.config.load("/etc/nukleus/config.json");

  // then read the job-system specific configuration
  await nsvc.config.load("/etc/jobs/config.json");

  // init logging
  log4js.configure({
    appenders: {
      filelog: { type: "file", filename: "logs/jobs.log", maxLogSize: 10485760, backups: 3, compress: true },
      consolelog: { type: "console" },
    },
    categories: {
      default: { appenders: ["filelog", "consolelog"], level: "debug" },
    },
  });

  const log = log4js.getLogger();

  if (nsvc.config.logdna) nsvc.logger.initLogDna(nsvc.config.logdna);

  nsvc.logger.hook(function (severity: "info" | "warn" | "error" | "debug", message: unknown, ...params: unknown[]) {
    switch (severity) {
      case "info":
        log.info(message, ...params);
        break;
      case "warn":
        log.warn(message, ...params);
        break;
      case "error":
        log.error(message, ...params);
        break;
      case "debug":
        log.debug(message, ...params);
        break;
    }
  });

  nsvc.model.mongoose.set("autoIndex", false);
  nsvc.model.mongoose.connection.on("disconnected", () => {
    // When we loose connection to the database, we should shut down the service for two reasons:
    // - the change streams stop working
    // - nothing can be done without the database
    // By shutting down we can let Kubernetes restart the service. This can be
    // done very quickly because the images are already available on the nodes.
    log.error("Lost connection to MongoDB. Shutting down.");
    process.exit(-1);
  });

  // Initialize model & plugins
  try {
    log.info("calling model init with log", log);
    await nsvc.model.init(nsvc.config, log);
  } catch (err) {
    log.error(err);
    process.exit(-1);
  }

  db.init();

  log.info("Initialization finished!");

  return log;
}

function stop(exitSignal: string) {
  console.log(`Received ${exitSignal}. Stopping instance.`);
  process.exit(-1);
}

// Kubernetes sends a SIGTERM signal when the Pod is supposed to exit.
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

// Print unhandled rejections and uncaught exceptions to the console.
// Also print the date to make it easier to identify the cause of the error.
process.on("unhandledRejection", (reason, p) => {
  const err = new Error();
  if (log4jLogger) {
    log4jLogger.error("Unhandled rejection:", reason, p, err.stack);
  } else {
    console.log(Date.now() + " Unhandled rejection:", reason, p, err.stack);
  }
});

process.on("uncaughtException", (err) => {
  if (log4jLogger) {
    log4jLogger.error("Uncaught exception:", err);
  } else {
    console.log(Date.now() + " Uncaught exception:", err);
  }
});

main();

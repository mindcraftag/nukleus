//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------
import express from "express";
import expressWs from "@wll8/express-ws";
import bodyParser from "body-parser";
import cors from "cors";
import morgan from "morgan";

import compression from "compression";
import helmet from "helmet";
import moment from "moment";

import * as db from "../common/db";
import * as tools from "../common/tools";

import { v4 as uuidv4 } from "uuid";
import { accessTokenTools } from "@mindcraftgmbh/nukleus-service";
import { WebSocket } from "ws";
import { Node } from "./Node";
import { wsApplication } from "@wll8/express-ws/dist/src/type";
import { Logger } from "log4js";
import { Server, IncomingMessage, ServerResponse } from "http";

export interface JobAgentWebSocket extends WebSocket {
  isAlive: boolean;
  connectionId: string;
  agentId: string;
  capabilities: string[];
  terminateTimeout: NodeJS.Timeout;
}

async function ensureLoggedIn(ws: JobAgentWebSocket, func: () => void) {
  if (!ws.agentId) {
    sendWsError(ws, "not logged in");
  } else {
    func();
  }
}

function sendMessage(ws: JobAgentWebSocket, msg: object) {
  ws.send(JSON.stringify(msg));
}

function sendError(res: express.Response, status: number | undefined, error: unknown) {
  status = status || 200;
  res.status(status).json({
    result: "failed",
    error: error,
  });
}

function sendWsError(ws: JobAgentWebSocket, error: Error | string) {
  ws.send(
    JSON.stringify({
      result: "failed",
      error: error,
    })
  );
}

/**
 * The NodeAPI class provides an API for JobAgents to connect to.
 */
export class NodeAPI {
  app: wsApplication;
  node: Node;
  logger: Logger;
  listener: Server<typeof IncomingMessage, typeof ServerResponse>;
  webSocketRoutes: ReturnType<typeof expressWs>["wsRoute"];
  sysinfoInterval: NodeJS.Timeout;

  constructor(port: number, node: Node, sysinfoInterval: number, logger: Logger) {
    const { app, wsRoute } = expressWs(express());
    this.webSocketRoutes = wsRoute;
    this.logger = logger;
    this.node = node;
    this.app = app;

    this.registerMiddleware();
    this.registerRegisterRoute();
    this.registerWsRoute();
    this.registerReadyRoute();
    this.sysinfoInterval = this.registerSysinfoInterval(sysinfoInterval);

    this.listener = this.app.listen(port, () => {
      logger.info(`Register service listening on port ${port}!`);
    });
  }

  stop() {
    clearInterval(this.sysinfoInterval);
    this.listener.close();
  }

  private registerMiddleware() {
    const logger = this.logger;

    const httpLog = morgan("combined", {
      stream: {
        write: function (str) {
          logger.debug(str.trim());
        },
      },
    });

    this.app.use(httpLog);
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(bodyParser.json());
    this.app.use(function (_req, _res, next) {
      // res.header("X-powered-by", "Nukleus");
      next();
    });
    this.app.use(helmet.noSniff());
    this.app.use(helmet.frameguard());
    this.app.use(helmet.xssFilter());
  }

  private registerReadyRoute() {
    this.app.get("/ready", async (_req, res) => {
      res.send("ok");
    });
  }

  /**
   * The /api/register route is used by JobAgents to retrieve an agentID and add their JobTypes.
   * JobAgents need to supply a valid access token.
   */
  private registerRegisterRoute() {
    this.app.post("/api/register", async (req, res) => {
      const remoteAddr = tools.getRemoteAddress(req);
      const accessToken = req.headers["x-access-token"];
      const tokenResult = await accessTokenTools.validateAccessToken(accessToken, "JobAgent");

      if (!tokenResult.valid) {
        sendError(res, 403, "access denied");
        return;
      }

      try {
        const { agentId } = await this.node.registerJobAgent(remoteAddr, req.body, tokenResult);
        res.json({
          result: "success",
          data: agentId,
        });
      } catch (err) {
        if (!(err instanceof tools.SchemaError)) {
          // Schema errors are a fault of the JobAgent, so we don't log them as errors.
          this.logger.error(err);
        }

        // If possible, return err.message, otherwise only return err.
        sendError(res, 400, typeof err === "object" && err && "message" in err ? err.message : err);
      }
    });
  }

  /**
   * Periodically request the system information of connected JobAgents.
   * This also detects WebSockets that have timed out.
   * @param interval Number of milliseconds between updates of the sysinfo.
   */
  private registerSysinfoInterval(interval: number) {
    return setInterval(() => {
      this.webSocketRoutes.forEach((route) => {
        route.wss.clients.forEach((ws: JobAgentWebSocket) => {
          if (!ws.isAlive) {
            this.logger.warn("Websocket timed out: " + ws.agentId);
            return ws.terminate();
          }

          ws.isAlive = false;
          ws.ping();

          // If the agent is capable to do so, instruct it to send over system information (cpu/ram/disk status)
          if (ws.capabilities && "sysinfo" in ws.capabilities && ws.capabilities.sysinfo) {
            ws.send(
              JSON.stringify({
                command: "sysinfo",
              })
            );
          }
        });
      });
    }, interval);
  }

  /**
   * The /api/ws route is the WebSocket endpoint for JobAgents.
   * It provides the following functionality:
   * - type = login -> Mark an agent as activate and available for scheduling.
   * - type = result -> Save the result of an assigned job.
   * - type = sysinfo -> Update the system information of an agent.
   * - type = progress -> Update the progress of an assigned job.
   * - Listen on ping / pong responses.
   */
  private registerWsRoute() {
    const ctx = this;

    this.app.ws("/api/ws", function (wsBase, req) {
      const remoteAddr = tools.getRemoteAddress(req);
      const ws = wsBase as JobAgentWebSocket;

      ws.isAlive = true;
      ws.connectionId = uuidv4();

      ctx.logger.info(`Websocket: new connection (${ws.connectionId}) from ${remoteAddr}`);

      // Create a timeout after which the socket will be terminated if no authentication is made.
      ws.terminateTimeout = setTimeout(function () {
        ctx.logger.error("Websocket timed out before login.");
        ws.terminate();
      }, 5000);

      // Since we periodically sent out a "ping", we need to listen on the "pong" and
      // mark the agent as alive to prevent the WebSocket from being terminated.
      ws.on("pong", async function () {
        ws.isAlive = true;
        if (ws.agentId) {
          await db.agentAlive(ws.agentId, ws.connectionId, ctx.logger);
        }
      });

      ws.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString()) as unknown;

          if (!(msg && typeof msg === "object")) {
            throw new Error("Unable to parse received data: " + data.toString());
            return;
          }

          if (!("type" in msg && typeof msg.type === "string")) {
            throw new Error("No 'type' field in WebSocket message: " + data.toString());
          }

          if (msg.type === "login") {
            ctx.handleAgentLogin(ws, msg);
          } else if (msg.type === "result") {
            ensureLoggedIn(ws, () => {
              ctx.handleResult(ws.agentId, ws.connectionId, msg);
            });
          } else if (msg.type === "sysinfo") {
            if (!("data" in msg && typeof msg.data === "object")) {
              throw new Error(
                "No 'data' field (or not an Object) in WebSocket message, but required for message type 'sysinfo'."
              );
            }

            ensureLoggedIn(ws, () => {
              ctx.handleSysinfo(ws.agentId, msg.data as object);
            });
          } else if (msg.type === "progress") {
            ensureLoggedIn(ws, () => {
              ctx.handleProgress(ws.agentId, msg);
            });
          } else {
            sendWsError(ws, `unkown message type ${msg.type}`);
          }
        } catch (err) {
          ctx.logger.error(err);
          sendWsError(ws, "server error");
        }
      });

      ws.on("close", async function () {
        ctx.logger.info(`Websocket: Agent disconnected (${ws.connectionId}): ${ws.agentId}`);
        if (ws.agentId) {
          ctx.node.disconnectAgent(ws.agentId, ws.connectionId);
        }
      });

      ws.on("error", function (error) {
        ctx.logger.error("Websocket error: ", error);
      });
    });
  }

  /**
   * Handles the system information an agent provided.
   * @param id The ID of the JobAgent to which the system information belongs to.
   * @param data The provded system information.
   */
  private async handleSysinfo(id: string, data: object) {
    await db.updateAgentSysInfo(id, data);
  }

  /**
   * Store the result of an assigned job.
   * @param agentId The ID of the JobAgent.
   * @param connectionId The connection ID of the JobAgent.
   * @param msg The message the JobAgent sent that includes the result.
   */
  private async handleResult(agentId: string, connectionId: string, msg: object) {
    const connectedJobAgent = this.node.connectedJobAgents[agentId];

    if (!connectedJobAgent || !connectedJobAgent.assignedJob) {
      this.logger.error("Cannot find active job for agent " + agentId);
      return;
    }

    if (!("result" in msg)) {
      this.logger.error("Received result message without 'result' field.");
      return;
    }

    const assignedJob = connectedJobAgent.assignedJob;
    connectedJobAgent.assignedJob = null;
    const job = await db.getJob(assignedJob._id);

    if (!job) {
      this.logger.error("Cannot find job " + assignedJob._id);
      return;
    }

    if (msg.result === "success") {
      if ("log" in msg && typeof msg.log === "string") {
        await db.succeedJob(job, msg.log, this.logger);
      } else {
        await db.succeedJob(job, "", this.logger);
      }
    } else {
      let error = "unknown error";
      let log = "";

      if ("error" in msg && typeof msg.error === "string") {
        error = msg.error;
      }

      if ("log" in msg && typeof msg.log === "string") {
        log = msg.log;
      }

      await db.failJob(job, error, log);
    }

    const jobAgent = await db.getAgent(agentId, connectionId);
    if (!jobAgent) {
      this.logger.error("Cannot find agent: " + agentId);
      return;
    }

    const time = moment().diff(moment(jobAgent.allocatedAt));

    this.logger.info(`Received job result (${connectionId}) after ${time}ms: ${msg.result}`);

    jobAgent.allocatedFor = undefined;
    jobAgent.allocatedBy = undefined;
    jobAgent.allocatedAt = undefined;
    jobAgent.lastAlive = new Date();

    if ("result" in msg && msg.result === "success")
      jobAgent.successfulJobCount = jobAgent.successfulJobCount ? jobAgent.successfulJobCount + 1 : 1;
    else jobAgent.failedJobCount = jobAgent.failedJobCount ? jobAgent.failedJobCount + 1 : 1;

    await jobAgent.save();
  }

  /**
   * Update the progress of an assigned job.
   * @param id The ID of the JobAgent.
   * @param msg The message the JobAgent sent that includes the progress.
   */
  private async handleProgress(id: string, msg: object) {
    const jobAgent = this.node.connectedJobAgents[id];

    if (!jobAgent || !jobAgent.assignedJob) {
      return;
    }

    const assignedJobID = jobAgent.assignedJob._id;

    const jobType = await db.getJobType(jobAgent.assignedJob.type);

    if (!jobType) {
      this.logger.error("Cannot find active job for agent: " + id);
    } else {
      try {
        if ("progress" in msg && typeof msg.progress === "string") {
          await db.updateAgentProgress(assignedJobID, parseInt(msg.progress), this.logger);
        } else if ("progress" in msg && typeof msg.progress === "number") {
          await db.updateAgentProgress(assignedJobID, msg.progress, this.logger);
        } else {
          throw new Error("progress value is not a string or number.");
        }
      } catch (err) {
        this.logger.warn("Failed to set progress:", err);
      }
    }
  }

  /**
   * Update the progress of an assigned job.
   * @param ws The WebSocket through which the login was made.
   * @param m The message the JobAgent sent that includes the login information.
   */
  private async handleAgentLogin(ws: JobAgentWebSocket, m: object) {
    if (!("id" in m && typeof m.id === "string")) {
      throw new Error("Can't login agent without valid ID.");
    }
    const agentId = m.id;

    try {
      if (!(await this.node.isValidAgentID(agentId))) {
        sendWsError(ws, "unknown id");
        return;
      }
    } catch (e) {
      sendWsError(ws, "invalid id");
      return;
    }

    clearTimeout(ws.terminateTimeout);

    try {
      const jobAgent = await this.node.activateAgentById(agentId, ws.connectionId, ws);

      ws.agentId = agentId;
      ws.capabilities = jobAgent.capabilities;

      this.logger.info(`Agent connected (${ws.connectionId}): ${agentId} - Caps: ${JSON.stringify(ws.capabilities)}`);

      sendMessage(ws, {
        result: "success",
      });
    } catch (e) {
      this.logger.error(e);
    }
  }
}

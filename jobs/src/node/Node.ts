import { JobAgentWebSocket, NodeAPI } from "./NodeAPI";
import { Logger } from "log4js";
import { NodeScheduler } from "./NodeScheduler";
import nsvc from "@mindcraftgmbh/nukleus-service";
import * as db from "../common/db";
import * as tools from "../common/tools";
import { model } from "@mindcraftgmbh/nukleus-service";

// The information we track for every connected JobAgent.
export type JobAgentConnection = {
  name: string;
  type: string;
  jobTypes: model.IJobType[];
  remoteHost: string;
  webSocket: JobAgentWebSocket;
  assignedJob: nsvc.model.JobDocument | null;
};

export type JobAgentConnectionDict = {
  [agentId: string]: JobAgentConnection;
};

/*
 *  This class is the central part of the Node codebase. Nodes are responsible for:
 *  - Communicating with JobAgents via the NodeAPI
 *  - Assigning Jobs to connected JobAgents via the NodeScheduler
 *  - Informing the Leader of available JobTypes via the LeaderCommunicator
 *  - Executing Tasks that the Leader gives us via the NodeTaskWorker
 *
 */
export class Node {
  // References to the other parts of the Node system.
  scheduler: NodeScheduler;
  api: NodeAPI;

  // A dictionary of all connected JobAgents.
  connectedJobAgents: JobAgentConnectionDict;

  options: {
    systemUserId: string;
    apiUrl: string;
    maxJobAttempts: number;
    port: number;
  };
  logger: Logger;
  jobWatcher: ReturnType<model.JobTypeModel["watch"]>;
  jobAgentWatcher: ReturnType<model.JobAgentModel["watch"]>;

  constructor(apiPort: number, log: Logger, systemUserId: string, sysinfoInterval?: number) {
    this.logger = log;
    this.connectedJobAgents = {};
    this.options = {
      systemUserId: systemUserId,
      apiUrl: nsvc.config.api.url,
      maxJobAttempts: nsvc.config.jobs.max_attempts,
      port: nsvc.config.server.port,
    };

    // Initialize the other components.
    this.scheduler = new NodeScheduler(this, log);
    this.api = new NodeAPI(apiPort, this, sysinfoInterval ? sysinfoInterval : 30000, log);

    // We need to keep track of the watcher to be able to destroy it
    // when the Node shuts down (important for unit-tests).
    const Job = model.mongoose.model("Job");
    this.jobWatcher = Job.watch();
    this.jobWatcher.on("change", () => {
      this.scheduler.scheduleJobsForAgents();
    });

    const JobAgent = model.mongoose.model("JobAgent") as nsvc.model.JobAgentModel;
    this.jobAgentWatcher = JobAgent.watch();
    this.jobAgentWatcher.on("change", async () => {
      const jobAgents = await JobAgent.find().exec();

      for (const agent of jobAgents) {
        const connectedJobAgentIDs = Object.keys(this.connectedJobAgents).map((a) => a.toString());

        if (agent.restart && connectedJobAgentIDs.includes(agent._id.toString())) {
          this.connectedJobAgents[agent._id.toString()]?.webSocket?.send(
            JSON.stringify({
              command: "restart",
            })
          );
          this.connectedJobAgents[agent._id.toString()]?.webSocket?.close();
          db.setJobAgentRestart(agent._id.toString(), false);
        }
      }
    });
  }

  /**
   * Stop this Node.
   */
  stop() {
    this.scheduler.stop();
    this.jobWatcher.close(); // driverChangeStream.close();
    this.jobAgentWatcher.close(); //.driverChangeStream.close();
    this.api.stop();
  }

  /**
   * Register a new JobAgent.
   * @param remoteHost IP and port of this JobAgent.
   * @param body The data the JobAgent sent along with it's registration.
   * @param token The token the JobAgent used.
   */
  async registerJobAgent(remoteHost: string, body: object, token: db.TokenType) {
    if (!("jobs" in body && Array.isArray(body.jobs))) {
      throw "Body contains no jobs to be registered!";
    }

    if (!("type" in body && typeof body.type === "string")) {
      throw "Body contains no type string";
    }

    // Verify and convert the user supplied jobs array to valid objects.
    const jobTypes = tools.verifyJobs(body.jobs, token.clientId);

    // Create the JobTypes in the database.
    const jobTypeIds = await db.createJobTypes(jobTypes, token.clientId);

    // Check the provided capabilities data.
    const capabilities = {
      restart: false,
      sysinfo: false,
    };

    if ("capabilities" in body && body.capabilities) {
      if (typeof body.capabilities !== "object") {
        throw "Capabilities must be an object";
      }

      if ("restart" in body.capabilities) {
        capabilities.restart = !!body.capabilities.restart;
      }

      if ("sysinfo" in body.capabilities) {
        capabilities.sysinfo = !!body.capabilities.sysinfo;
      }
    }

    // Create the JobAgent entry in the database.
    const jobAgent = await db.createJobAgent(body, remoteHost, capabilities, jobTypeIds, token);

    return {
      agentId: jobAgent._id,
    };
  }

  /**
   * Check if the database has a JobAgent with the specified ID.
   * @param agentId The agentID to check.
   */
  async isValidAgentID(agentId: string) {
    const jobAgent = await db.getAgent(agentId);
    return !!jobAgent;
  }

  /**
   * Activate a JobAgent to make it available for accepting jobs.
   * @param agentId ID of the JobAgent to activate.
   * @param connectionId ConnectionID of the JobAgent
   * @param webSocket WebSocket of the JobAgent.
   */
  async activateAgentById(agentId: string, connectionId: string, webSocket: JobAgentWebSocket) {
    this.logger.info("activating agent " + agentId);
    const jobAgent = await db.getAgent(agentId);

    if (!jobAgent) {
      throw new Error("Can't find jobAgent with ID " + agentId);
    }

    // This job agent might be doing a reconnect right now. If so, cleanup its
    // previous connection and running jobs if so.
    await this.cleanupAgent(jobAgent);

    jobAgent.connectedAt = new Date();
    jobAgent.disconnectedAt = undefined;
    jobAgent.allocatedBy = undefined;
    jobAgent.allocatedAt = undefined;
    jobAgent.allocatedFor = undefined;
    jobAgent.lastAlive = new Date();
    jobAgent.connectionId = connectionId;
    jobAgent.connectCount = jobAgent.connectCount ? jobAgent.connectCount + 1 : 1;
    await jobAgent.save();

    // Build an array of available JobTypes by mapping the JobType IDs to objects.
    const jobTypes = [];
    for (const id of jobAgent.jobTypes) {
      jobTypes.push((await db.getJobTypeById(id))!);
    }

    // Add this JobAgent to the collection of connected JobAgents to make
    // it available for scheduling.
    this.connectedJobAgents[jobAgent._id.toString()] = {
      remoteHost: jobAgent.remoteHost,
      webSocket: webSocket,
      jobTypes: jobTypes,
      name: jobAgent.name,
      type: jobAgent.type,
      assignedJob: null,
    };

    return jobAgent;
  }

  /**
   * Disconnect and deactivate a JobAgent.
   * @param agentId ID of the JobAgent
   * @param connectionId ConnectionID of the Jobagent.
   */
  async disconnectAgent(agentId: string, connectionId?: string) {
    delete this.connectedJobAgents[agentId];

    const jobAgent = await db.getAgent(agentId, connectionId);
    if (!jobAgent) {
      return false;
    }

    // We don't deactivate the job types here, since there might be
    // other agents and nodes that provide this type
    await this.cleanupAgent(jobAgent);
    jobAgent.disconnectedAt = new Date();
    jobAgent.connectionId = undefined;
    jobAgent.allocatedBy = undefined;
    jobAgent.allocatedAt = undefined;
    jobAgent.allocatedFor = undefined;
    await jobAgent.save();

    return true;
  }

  /**
   * Cleanup a JobAgent by marking all currently running jobs as failed.
   * @param jobAgent The JobAgent that should be cleaned up.
   * @param _id unused.
   */
  async cleanupAgent(jobAgent: nsvc.model.JobAgentDocument) {
    this.logger.info("cleaning up agent " + jobAgent._id);
    const jobs = await db.findRunningJobsForAgent(jobAgent.remoteHost);

    if (jobs.length > 0) {
      this.logger.warn("Agent (re/dis)-connected during job processing!");
    }

    // Since the JobAgent disconnected, all of it's currenly running jobs have failed.
    // Go through all Jobs and either mark them as failed or (if it's a manually started
    // job) reset the job.
    for (const job of jobs) {
      const jobType = (await db.getJobType(job.type))!;
      if (jobType.interval) await db.failJob(job, "Agent disconnected");
      else if (job.attempts === this.options.maxJobAttempts) await db.failJob(job, "Max attempts reached");
      else db.resetJob(job);
    }

    jobAgent.failedJobCount += jobs.length;
  }
}

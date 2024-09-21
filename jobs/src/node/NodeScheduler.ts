import * as db from "../common/db";
import * as tools from "../common/tools";
import { Node } from "./Node";
import { Logger } from "log4js";

/**
 * The NodeScheduler assigns jobs from the database to connected JobAgents.
 */
export class NodeScheduler {
  node: Node;
  isScheduling: boolean;
  logger: Logger;
  schedulerInterval: NodeJS.Timeout;

  dumpInfo() {
    this.logger.info("Dumping Node Scheduler Information...");

    this.logger.info("Is Scheduling:");
    this.logger.info(this.isScheduling);

    this.logger.info("Scheduler Interval:");
    this.logger.info(this.schedulerInterval);
  }

  constructor(node: Node, logger: Logger) {
    this.node = node;
    this.isScheduling = false;
    this.logger = logger;

    this.schedulerInterval = setInterval(async () => {
      // Scheduling is also triggered by Node.ts whenever the Job collection changes.
      await this.scheduleJobsForAgents();

      await this.checkTimeoutOverruns();
    }, 1000);
  }

  stop() {
    clearInterval(this.schedulerInterval);
  }

  async checkTimeoutOverruns() {
    // Go over all assigned jobs and check if they have overrun their timeout
    for (const [agentId, jobAgent] of Object.entries(this.node.connectedJobAgents)) {
      if (!jobAgent.assignedJob) continue;

      const jobType = (await db.getJobType(jobAgent.assignedJob.type))!;
      if (!jobType.timeout || jobType.timeout === 0) {
        return;
      }

      const job = (await db.getJob(jobAgent.assignedJob._id))!;
      const currentTime = Date.now();
      const timeOfTimeout = job.startedAt.getTime() + jobType.timeout * 1000;

      if (currentTime > timeOfTimeout) {
        this.logger.info(
          "Agent timed out while computing job " + jobAgent.assignedJob._id + " of type " + jobType.name
        );
        db.setJobAgentRestart(agentId, true);
      }
    }
  }

  /**
   * Attempts to find a job for every connected JobAgent.
   */
  async scheduleJobsForAgents() {
    // To prevent unnecessary execution, we exit early if the scheduler is already scheduling.
    // This may happen since this function might be called from a MongoDB Watcher on the Job collection
    // and because this function may modify the Job collection, therefore triggering itself.
    if (this.isScheduling) {
      this.logger.debug(`Not scheduling jobs because the "isScheduling" lock is set.`);
      return;
    }

    this.logger.debug(`Setting "isScheduling" lock.`);
    this.isScheduling = true;

    // Go over every connected and available JobAgent.
    for (const [agentId, jobAgent] of Object.entries(this.node.connectedJobAgents)) {
      try {
        if (jobAgent.assignedJob !== null) {
          this.logger.info(`Not assigning jobs to agent ${agentId} because it already has a job assigned.`);
          continue;
        }

        const agentEntry = await db.getAgent(agentId);

        if (!agentEntry) {
          // It's possible that the DB entry was deleted, even though the agent is still connected.
          // This can happen if the agent creates two WebSocket connections to two different JobScheduler nodes.

          this.logger.warn(`Job Agent ${agentId} no longer exists in DB.`);
          await this.node.disconnectAgent(agentId);
          continue;
        }

        if (agentEntry.disabled) {
          this.logger.debug(`Not assigning jobs to agent ${agentId} because it is disabled.`);
          continue;
        }

        // Go over all JobTypes this agent provides.
        for (const jobType of jobAgent.jobTypes) {
          // Try to find and lock a pending Job for this JobType.
          const job = await db.findAndLockJob(jobType.name);

          // If a job was found, assign it to the agent.
          if (job) {
            this.logger.info("Assigned job " + job._id + " to agent " + agentId);

            jobAgent.assignedJob = job;

            // Mark it in the database.
            await db.allocateAgentForJob(agentId, jobType.name);
            await db.markJobAsStarted(job, jobAgent.remoteHost);

            let api_token;
            if (!agentEntry.usedToken.client) {
              api_token = tools.createSystemUserToken(this.node.options.systemUserId);
            } else {
              api_token = await tools.createClientSystemUserToken(agentEntry.usedToken.client);
            }

            this.logger.info("Created API token: " + api_token + " from access token " + agentEntry.usedToken.client);

            // Tell the JobAgent to execute this Job and include neccessary
            // information, such as batch data.
            jobAgent.webSocket.send(
              JSON.stringify({
                command: "exec",
                type: jobType.name,
                parameters: job.parameters,
                client: job.client,
                batch: job.batchData,
                elements: job.elements,
                api_token: api_token,
                api_url: this.node.options.apiUrl,
                user: job.createdBy,
              })
            );

            // Since we have assigned a job to this agent, we can go to the next agent.
            break;
          }
        }
      } catch (error) {
        console.log(error);

        this.logger.error(`Error while scheduling jobs for agent ${agentId}:`);
        this.logger.error(JSON.stringify(error, null, 2));
      }
    }

    this.logger.debug(`Releasing "isScheduling" lock.`);
    this.isScheduling = false;
  }
}

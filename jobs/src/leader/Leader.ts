//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

// The task of the leader is to look at the JobType collection and create entries in the Job database at the correct time.

// Watch the JobType collection:
//

import { model } from "@mindcraftgmbh/nukleus-service";
import * as constants from "../common/constants";
import { Cron } from "croner";
import { Logger } from "log4js";
import { createBatches } from "../node/Batches";
import { Mutex } from "async-mutex";

type IntervalJob = {
  cronTask: Cron;
  cronExp: string;
  data: model.IJobType;
};

type WatchJob = {
  watchCollection: string;
  data: model.IJobType;
};

interface JobTypeWithInterval extends model.JobTypeDocument {
  interval: string;
}

interface JobTypeWithWatch extends model.JobTypeDocument {
  watch: string;
}

function isJobTypeWithInterval(jobType: model.JobTypeDocument): jobType is JobTypeWithInterval {
  return jobType.interval !== undefined;
}

function isJobTypeWithWatch(jobType: model.JobTypeDocument): jobType is JobTypeWithWatch {
  return jobType.watch !== undefined;
}

const JobCollections = ["JobType", "JobAgent"] as const;
const WatchCollections = ["Mail", "Invoice", "Item"] as const;

type JobCollections = (typeof JobCollections)[number];
type WatchCollections = (typeof WatchCollections)[number];

type ChangeStreamCollections = JobCollections | WatchCollections;

export class Leader {
  readonly JobType: model.mongoose.Model<model.JobTypeDocument>;
  readonly JobAgent: model.mongoose.Model<model.JobAgentDocument>;
  readonly Job: model.mongoose.Model<model.JobDocument>;

  readonly Mail: model.mongoose.Model<model.MailDocument>;
  readonly Invoice: model.mongoose.Model<model.InvoiceDocument>;
  readonly Item: model.mongoose.Model<model.ItemDocument>;

  schedulerMutex: Mutex;
  scannerMutex: Mutex;

  intervalJobs: {
    [jobType: string]: IntervalJob;
  } = {};
  logger: Logger;

  changeStreams: {
    [key in ChangeStreamCollections]: ReturnType<model.JobTypeModel["watch"]>;
  };

  watchJobTypes: {
    [jobType: string]: WatchJob;
  } = {};

  ignoredJobTypes: Map<string, boolean> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;

    this.JobType = model.mongoose.model("JobType");
    this.JobAgent = model.mongoose.model("JobAgent");
    this.Job = model.mongoose.model("Job");
    this.schedulerMutex = new Mutex();
    this.scannerMutex = new Mutex();

    this.Mail = model.mongoose.model("Mail");
    this.Invoice = model.mongoose.model("Invoice");
    this.Item = model.mongoose.model("Item");

    this.changeStreams = {
      JobAgent: this.JobAgent.watch(),
      JobType: this.JobType.watch(),
      Mail: this.Mail.watch(),
      Invoice: this.Invoice.watch(),
      Item: this.Item.watch(),
    };

    for (const jobCollection of JobCollections) {
      this.logger.debug(`Starting a watch on ${jobCollection}.`);
      this.changeStreams[jobCollection].on("change", () => {
        this.scanJobTypes().catch((err) => this.logger.error(err));
      });
    }

    for (const watchCollection of WatchCollections) {
      this.logger.debug(`Starting a watch on ${watchCollection}.`);
      this.changeStreams[watchCollection].on("change", () => {
        this.updateWatch(watchCollection).catch((err) => this.logger.error(err));
      });
    }

    this.scanJobTypes().catch((err) => this.logger.error(err));
  }

  stop() {
    this.logger.debug(`Stopping leader...`);
    for (const [jobType, job] of Object.entries(this.intervalJobs)) {
      this.logger.debug(`Stopping cron task of interval job ${jobType}.`);
      job.cronTask.stop();
    }

    for (const [collectionName, changeStream] of Object.entries(this.changeStreams)) {
      this.logger.debug(`Closing WatchStream on ${collectionName}.`);
      changeStream.removeAllListeners("change");
      changeStream.close();
    }
    this.logger.debug(`Stopped leader.`);
  }

  async scanJobTypes() {
    await this.scannerMutex.runExclusive(async () => {
      this.logger.debug(`Scanning the JobType collection...`);

      // Find all JobTypes that have an interval.
      const allJobTypes = await this.JobType.find({}).exec();
      const intervalJobTypes: JobTypeWithInterval[] = [];

      const watchJobTypes: JobTypeWithWatch[] = [];

      // Filter out all JobTypes that don't have at least one JobAgent connected that supports it.
      for (const jobType of allJobTypes) {
        const availableJobAgents = await this.JobAgent.find({
          jobTypes: jobType._id,
          disabled: false,
          lastAlive: {
            $gte: new Date(Date.now() - constants.JOB_AGENT_ALIVE_TIMEOUT),
          },
        });

        // There are three kinds of JobType executions:
        // - watch: run the job whenever a document in the specified collection changes
        // - interval: run the job periodically
        //   - (optional) query: run the job periodically and in batches

        if (availableJobAgents.length > 0) {
          if (jobType.watch && jobType.query) {
            if (this.ignoredJobTypes.get(jobType.name) === undefined) {
              // If we already know that this JobType is not going to be executed, we don't need to print this information again.
              this.logger.warn(`JobType ${jobType.name} has watch and query. This is not supported.`);
            }
            this.ignoredJobTypes.set(jobType.name, true);
            continue;
          }

          if (isJobTypeWithWatch(jobType)) {
            watchJobTypes.push(jobType);
          }

          if (isJobTypeWithInterval(jobType)) {
            intervalJobTypes.push(jobType);
          }

          if (!jobType.watch && !jobType.interval) {
            if (this.ignoredJobTypes.get(jobType.name) === undefined) {
              // If we already know that this JobType is not going to be executed, we don't need to print this information again.
              this.logger.info(`JobType ${jobType.name} has no watch and no interval. It will not be executed.`);
            }
            this.ignoredJobTypes.set(jobType.name, true);
            continue;
          }
          this.ignoredJobTypes.delete(jobType.name);
        } else {
          this.logger.debug(`JobType ${jobType.name} has no available JobAgents.`);
        }
      }

      // Create an entry in the intervalJobs object for each found JobType.
      for (const jobType of intervalJobTypes) {
        const job = this.intervalJobs[jobType.name];

        if (job) {
          // If there is already an entry, update it.
          this.ensureUpToDate(job, jobType);
        } else {
          // Otherwise create a new entry.
          this.logger.debug(`Creating new interval job for ${jobType.name}. Query = ${jobType.query}`);
          this.intervalJobs[jobType.name] = {
            cronExp: jobType.interval,
            data: jobType,
            cronTask: new Cron(jobType.interval, { catch: this.logError.bind(this) }, () => {
              this.scheduleJob(jobType).catch(this.logError.bind(this));
            }),
          };
        }
      }

      const watchJobTypeDict: typeof this.watchJobTypes = {};
      for (const jobType of watchJobTypes) {
        watchJobTypeDict[jobType.name] = {
          data: jobType,
          watchCollection: jobType.watch,
        };
      }
      this.watchJobTypes = watchJobTypeDict;
      this.logger.debug(`Updating watch dictionary; ${Object.entries(this.watchJobTypes).length} entries.`);

      // Make sure that there are no entries in the intervalJobs object that are not valid interval JobTypes.
      const intervalJobTypeIDs = intervalJobTypes.map((jobType) => jobType.name);
      for (const jobTypeID of Object.keys(this.intervalJobs)) {
        if (intervalJobTypeIDs.includes(jobTypeID)) {
          continue;
        } else {
          // This is most likely because the JobType has no more available JobAgents, because they disconnected.
          // In that case we remove this entry so we don't create infinitely many pending jobs.
          this.logger.info(`Removing running interval job that should not run: ${jobTypeID}...`);
          this.intervalJobs[jobTypeID]!.cronTask.stop();
          delete this.intervalJobs[jobTypeID];
          this.logger.debug(`Removed ${jobTypeID}.`);
        }
      }
    });
  }

  // Check if the job entry has the correct cron expression.
  ensureUpToDate(job: IntervalJob, jobType: JobTypeWithInterval) {
    if (job.cronExp === jobType.interval) {
      return;
    }

    this.logger.debug(
      `Replacing cron task for interval job ${jobType.name}. Old interval: ${job.cronExp}, new interval: ${jobType.interval}.`
    );
    job.cronTask.stop();

    job.cronExp = jobType.interval;
    job.cronTask = new Cron(job.cronExp, { catch: this.logError.bind(this) }, () => {
      this.scheduleJob(jobType).catch(this.logError.bind(this));
    });
  }

  logError(err: unknown) {
    this.logger.error(err);
  }

  async scheduleJob(jobType: model.IJobType) {
    this.logger.debug(`Scheduling for JobType ${jobType.name}...`);
    await this.schedulerMutex.runExclusive(async () => {
      this.logger.debug(`Acquired lock for scheduling of JobType ${jobType.name}...`);

      // Only schedule this job if there is no other job of this type pending or running.
      const unfinishedJobs = await this.Job.find({
        type: jobType.name,
        state: {
          $in: [constants.JobState.PENDING, constants.JobState.RUNNING],
        },
      }).exec();

      if (unfinishedJobs.length > 0) {
        this.logger.info(`Not scheduling job of type ${jobType.name} because there is already one pending or running.`);
        return;
      }

      if (!jobType.query) {
        await this.createJob(jobType);
      } else {
        await this.createBatchedJob(jobType);
      }
    });
  }

  async createJob(jobType: model.IJobType) {
    this.logger.debug(`Creating new Job for ${jobType.name}...`);

    await this.Job.create({
      state: constants.JobState.PENDING,
      type: jobType.name,
      attempts: 0,
      progress: 0,
    });

    this.logger.info(`Created job of type ${jobType.name}.`);
  }

  async createBatchedJob(jobType: model.IJobType) {
    this.logger.debug(`Creating new Job batches for ${jobType.name}...`);

    // Create the batches and then create a job for every single batch.
    const jobBatches = await createBatches(jobType.query);

    for (let i = 0; i < jobBatches.length; i++) {
      this.logger.debug(`Creating new batch for ${jobType.name} with ${jobBatches[i]?.length} entries...`);
      await this.Job.create({
        state: constants.JobState.PENDING,
        type: jobType.name,
        attempts: 0,
        progress: 0,
        batchData: jobBatches[i],
      });
    }

    this.logger.info(`Created ${jobBatches.length} batch jobs of type ${jobType.name}.`);
  }

  async updateWatch(collection: string) {
    // This function is only for the watchers of collections that jobs can use as a trigger.
    // Thats why we don't recaculate the interval jobs here.
    this.logger.debug(`Watch triggered on collection ${collection}.`);

    // Is there a JobType with JobAgents that have a watch on this collection?
    for (const jobType of Object.values(this.watchJobTypes)) {
      if (collection === jobType.watchCollection) {
        this.logger.debug(`Found JobType ${jobType.data.name} that has a watch on collection ${collection}.`);
        await this.scheduleJob(jobType.data);
      }
    }
  }
}

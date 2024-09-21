const mongoose = require("@mindcraftgmbh/nukleus-service").model.mongoose;
import nsvc from "@mindcraftgmbh/nukleus-service";
import { Logger } from "log4js";
import * as constants from "./constants";
import moment from "moment";
import { model } from "@mindcraftgmbh/nukleus-service";
import { JobTypeAPI } from "./tools";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

// We can't access the
let JobType: model.JobTypeModel;
let Job: model.JobModel;
let JobAgent: model.JobAgentModel;
let Client: model.ClientModel;
let AccessToken: model.AccessTokenModel;

export type TokenType = Awaited<ReturnType<typeof nsvc.accessTokenTools.validateAccessToken>>;

const JobAgentRegistration = Type.Object({
  id: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  type: Type.String(),
  version: Type.String(),
});

export function init() {
  JobType = model.mongoose.model("JobType") as model.JobTypeModel;
  Job = model.mongoose.model("Job") as model.JobModel;
  JobAgent = model.mongoose.model("JobAgent") as model.JobAgentModel;
  Client = model.mongoose.model("Client") as model.ClientModel;
  AccessToken = model.mongoose.model("AccessToken") as model.AccessTokenModel;
}

export async function getJobType(jobTypeName: string) {
  const jobTypes = await JobType.find().where({ name: jobTypeName }).exec();
  if (jobTypes[0] && jobTypes.length === 1) {
    return jobTypes[0];
  } else {
    return null;
  }
}

export async function getJobTypeById(jobTypeId: string | model.mongoose.Types.ObjectId) {
  const jobTypes = await JobType.find().where({ _id: jobTypeId }).exec();
  if (jobTypes[0] && jobTypes.length === 1) {
    return jobTypes[0];
  } else {
    return null;
  }
}

export async function createJobTypes(jobTypes: JobTypeAPI[], clientId: string) {
  const jobTypeIds = [];
  for (const jobTypeData of jobTypes) {
    let jobType = await JobType.findOne({ name: jobTypeData.name, client: clientId }).exec();

    if (jobType) {
      jobType.displayName = jobTypeData.displayName;
      jobType.elementMode = jobTypeData.elementMode || "items";
      jobType.types = jobTypeData.types || [];
      jobType.contentTypes = jobTypeData.contentTypes || [];
      jobType.parameters = jobTypeData.parameters || [];
      jobType.manualStart = jobTypeData.manualStart || false;
      jobType.timeout = jobTypeData.timeout || 0;
      // jobType.interval = jobTypeData.interval ? `${jobTypeData.interval} -> ${jobTypeData.cronExp}` : jobTypeData.cronExp;
      jobType.interval = jobTypeData.cronExp;
      jobType.watch = jobTypeData.watch;
      jobType.query = jobTypeData.query;
    } else {
      jobType = await JobType.create(jobTypeData);
      jobType.interval = jobTypeData.cronExp;
      jobType.timeout = jobTypeData.timeout || 0;
    }
    await jobType.save();

    jobTypeIds.push(jobType._id);
  }

  return jobTypeIds;
}

export async function setJobAgentRestart(jobAgentID: string, restart: boolean) {
  const jobAgent = await JobAgent.findOne({
    _id: jobAgentID,
  }).exec();

  if (jobAgent) {
    jobAgent.restart = restart;
    jobAgent.save();
  } else {
    throw new Error("Can't find JobAgent to restart. ID: " + jobAgentID);
  }
}

export async function createJobAgent(
  body: unknown,
  remoteHost: string,
  capabilities: object,
  jobTypeIds: model.mongoose.Types.ObjectId[],
  token: TokenType
) {
  if (Value.Check(JobAgentRegistration, body)) {
    let query;
    if (body.id) {
      query = { _id: mongoose.Types.ObjectId(body.id) };
    } else {
      query = { remoteHost: remoteHost };
    }

    let jobAgent = await JobAgent.findOne(query).exec();
    if (jobAgent) {
      jobAgent.name = body.name;
      jobAgent.jobTypes = jobTypeIds;
      jobAgent.usedToken = token.tokenId;
      jobAgent.type = body.type;
      jobAgent.version = body.version;
      jobAgent.capabilities = capabilities;
      jobAgent.connectCount = jobAgent.connectCount || 0;
      jobAgent.totalJobCount = jobAgent.totalJobCount || 0;
      jobAgent.successfulJobCount = jobAgent.successfulJobCount || 0;
      jobAgent.failedJobCount = jobAgent.failedJobCount || 0;
      jobAgent.disabled = jobAgent.disabled || false;
      jobAgent.restart = false;
      jobAgent.reconnects = jobAgent.reconnects ? jobAgent.reconnects + 1 : 1;
      await jobAgent.save();
      //console.log("Agent updated: ", jobAgent);
    } else {
      jobAgent = await JobAgent.create({
        name: body.name,
        remoteHost: remoteHost,
        type: body.type,
        usedToken: token.tokenId,
        version: body.version,
        capabilities: capabilities,
        jobTypes: jobTypeIds,
        connectCount: 0,
        totalJobCount: 0,
        successfulJobCount: 0,
        failedJobCount: 0,
        disabled: false,
        restart: false,
        reconnects: 0,
      });
      //console.log("Agent created: ", jobAgent);
    }

    return jobAgent;
  } else {
    console.log("Received invalid JobAgent registration: ", body);
    throw new Error("Invalid JobAgent registration.");
  }
}

export async function getAgent(id: string, connectionId?: string) {
  const query: model.mongoose.FilterQuery<model.JobAgentDocument> = { _id: mongoose.Types.ObjectId(id) };
  if (connectionId) query.connectionId = connectionId;

  const jobAgent = await JobAgent.findOne(query).populate("usedToken").exec();

  type typeWithToken = typeof jobAgent & {
    usedToken: {
      client: string;
    };
  };
  return jobAgent as typeWithToken;
}

export async function getToken(id: string) {
  const query: model.mongoose.FilterQuery<model.AccessTokenDocument> = { _id: mongoose.Types.ObjectId(id) };

  const token = await AccessToken.findOne(query).populate("usedToken").exec();
  return token;
}

export async function findAndLockJob(type: string) {
  const job = await Job.findOneAndUpdate(
    {
      state: constants.JobState.PENDING,
      type: type,
    },
    {
      $set: {
        state: constants.JobState.LOCKED,
      },
    }
  );

  return job;
}

export async function getJob(id: string) {
  const job = await Job.findOne({ _id: id }).exec();
  return job;
}

export async function allocateAgentForJob(id: string, /* userId: string, */ jobType: string) {
  const jobAgent = (await JobAgent.findOne({ _id: id }).exec())!;

  jobAgent.allocatedAt = new Date();
  // jobAgent.allocatedBy = userId;
  jobAgent.allocatedFor = jobType;
  jobAgent.totalJobCount = jobAgent.totalJobCount ? jobAgent.totalJobCount + 1 : 1;

  await jobAgent.save();
}

export async function markJobAsStarted(job: model.JobDocument, remoteHost: string) {
  job.state = constants.JobState.RUNNING;
  job.startedAt = new Date();
  job.attempts = job.attempts ? job.attempts + 1 : 1;
  job.jobAgent = remoteHost;
  await job.save();
}

export async function findRunningJob(agentId: string) {
  const jobs = await Job.find().where({ state: constants.JobState.RUNNING, jobAgent: agentId });
  return jobs;
}

export async function findRunningJobsForAgent(remoteHost: string) {
  const jobs = await Job.find().where({ state: constants.JobState.RUNNING, jobAgent: remoteHost });
  return jobs;
}

export async function findPendingJobsForType(typeName: string) {
  const jobs = await Job.find().where({ state: constants.JobState.PENDING, type: typeName });
  return jobs;
}

export async function failJob(job: model.JobDocument, error: string, log?: string) {
  job.stoppedAt = new Date();

  const stopTime = job.stoppedAt ? job.stoppedAt.getTime() : 0;
  const startTime = job.startedAt ? job.startedAt.getTime() : 0;
  const runningTimeMs = stopTime - startTime;

  // logger.error(`Job failed: ${job.type}: ${error.toString()}`);
  job.state = constants.JobState.FAILED;
  job.runningTimeMs = runningTimeMs;
  job.log = log || "";
  job.error = error;
  await job.save();
}

export async function resetJob(job: model.JobDocument) {
  job.stoppedAt = new Date();

  const stopTime = job.stoppedAt ? job.stoppedAt.getTime() : 0;
  const startTime = job.startedAt ? job.startedAt.getTime() : 0;
  const runningTimeMs = stopTime - startTime;

  // logger.error(`Job reset: ${job.type}`);
  job.state = constants.JobState.PENDING;
  job.runningTimeMs = runningTimeMs;
  job.error = "Last attempt failed";
  await job.save();
}

export async function succeedJob(job: model.JobDocument, log: string, logger: Logger) {
  job.stoppedAt = new Date();

  const stopTime = job.stoppedAt ? job.stoppedAt.getTime() : 0;
  const startTime = job.startedAt ? job.startedAt.getTime() : 0;
  const runningTimeMs = stopTime - startTime;

  job.state = constants.JobState.SUCCEEDED;
  job.error = "";
  job.log = log;
  job.progress = 100;
  job.runningTimeMs = runningTimeMs;
  await job.save();

  if (job.client) {
    // The job execution needs to be logged in the client document for invoicing
    // ------------------------------------------------------------------------------
    const seconds = moment(job.stoppedAt).diff(job.startedAt, "milliseconds") / 1000;

    // We need to use any here, because the metrics.jobExecutions object is intended to be free form.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inc: any = {};
    inc["metrics.jobExecutions." + job.type + ".count"] = 1;
    inc["metrics.jobExecutions." + job.type + ".seconds"] = seconds;

    Client.updateOne(
      { _id: job.client },
      {
        $inc: inc,
      }
    )
      .then(function () {
        logger.info("Updated client metrics");
      })
      .catch(function (err) {
        logger.error("Error updating client metrics", err);
      });
  }
}

export async function updateAgentSysInfo(id: string, sysinfo: object) {
  const jobAgent = await JobAgent.findOne({ _id: mongoose.Types.ObjectId(id) }).exec();
  if (!jobAgent) {
    return false;
  }

  jobAgent.sysinfo = sysinfo;
  await jobAgent.save();
  return true;
}

export async function agentAlive(id: string, connectionId: string, logger: Logger) {
  const jobAgent = await exports.getAgent(id, connectionId);
  if (!jobAgent) {
    logger.debug("Agent not found in database to write alive date.");
    return false;
  }

  jobAgent.lastAlive = new Date();
  await jobAgent.save();
  return true;
}

export async function getCurrentJobtypeByAgent(agentId: string) {
  const jobAgent = await JobAgent.findOne({ _id: agentId }).exec();

  if (!jobAgent) {
    return null;
  }

  const jobType = await JobType.findOne({ name: jobAgent.allocatedFor }).exec();
  if (!jobType) {
    return null;
  }

  return jobType;
}

export async function updateAgentProgress(id: string, progress: number, logger: Logger) {
  const job = await Job.findOne({ _id: id }).exec();
  if (!job) {
    logger.error("Cannot find job: " + id);
  } else {
    if (progress < 0) progress = 0;
    if (progress > 100) progress = 100;

    job.progress = progress;
    await job.save();
  }
}

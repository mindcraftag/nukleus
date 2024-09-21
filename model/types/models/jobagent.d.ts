import * as mongoose from "mongoose";

interface IJobAgent {
  _id: mongoose.Types.ObjectId;
  name: string;
  remoteHost: string;
  type: string;
  version: string;
  sysinfo: any;
  capabilities: any;
  reconnects: number;

  usedToken: mongoose.Types.ObjectId;
  jobTypes: mongoose.Types.ObjectId[];

  allocatedBy?: mongoose.Types.ObjectId;
  allocatedFor?: string;
  allocatedAt?: Date;

  connectedAt: Date;
  disconnectedAt?: Date;
  lastAlive: Date;

  totalJobCount: number;
  successfulJobCount: number;
  failedJobCount: number;
  disabled: boolean;
  connectCount: number;
  connectionId?: string;
  restart: boolean;

  location: {
    longitude: number;
    latitude: number;
    country: string;
    region: string;
  };
}

interface JobAgentDocument extends IJobAgent, mongoose.Document {}
interface JobAgentModel extends mongoose.Model<JobAgentDocument> {
  installIndices(): void;
}

export { IJobAgent, JobAgentDocument, JobAgentModel };

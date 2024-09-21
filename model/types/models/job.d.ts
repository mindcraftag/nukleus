import * as mongoose from "mongoose";

interface IJob {
  type: string;
  state: number; //  0 = pending, 1 = running, 2 = failed, 3 = succeeded
  error: string;
  log: string;
  progress: number;
  elements: any[];
  parameters: Map<any, any>;
  createdBy: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  startedAt: Date;
  stoppedAt: Date;
  runningTimeMs: number;
  attempts: number;
  jobAgent: string;
  batchData: any;

  createdAt: Date;
  updatedAt: Date;
}

interface JobDocument extends IJob, mongoose.Document {}
interface JobModel extends mongoose.Model<JobDocument> {
  installIndices(): void;
}

export { IJob, JobDocument, JobModel };

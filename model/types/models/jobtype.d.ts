import * as mongoose from "mongoose";

interface IJobType {
  _id: mongoose.Types.ObjectId;

  name: string;
  displayName: string;
  elementMode: string;
  client: mongoose.Types.ObjectId;
  contentTypes: string[];
  types: string[];
  parameters: any[];
  manualStart: boolean;
  interval?: string;
  watch?: string;
  query: any;
  timeout: number;

  createdAt: Date;
  updatedAt: Date;
}

interface JobTypeDocument extends IJobType, mongoose.Document {}
interface JobTypeModel extends mongoose.Model<JobTypeDocument> {
  installIndices(): void;
}

export { IJobType, JobTypeDocument, JobTypeModel };

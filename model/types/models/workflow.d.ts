import * as mongoose from "mongoose";

interface IWorkflow {
  name: string;
  client: mongoose.Types.ObjectId;
  deletedAt: Date;
  bpmnXml: string;
  graph: any;
  parameters: any[];

  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowDocument extends IWorkflow, mongoose.Document {}
interface WorkflowModel extends mongoose.Model<WorkflowDocument> {
  installIndices(): void;
  existsByNameAndClient(name: string, client: mongoose.Types.ObjectId): Promise<boolean>;
}

export { IWorkflow, WorkflowDocument, WorkflowModel };

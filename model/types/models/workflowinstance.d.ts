import * as mongoose from "mongoose";

interface IWorkflowInstance {
  workflow: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  attachedToItems: mongoose.Types.ObjectId[];
  attachedToFolders: mongoose.Types.ObjectId[];
  state: number; // 0 = started, 1 = waiting for user, 2 = waiting for processing, 3 = done, 4 = failed
  graph: any;
  currentStep: string;

  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowInstanceDocument
  extends IWorkflowInstance,
    mongoose.Document {}
interface WorkflowInstanceModel
  extends mongoose.Model<WorkflowInstanceDocument> {
  installIndices(): void;
}

export { IWorkflowInstance, WorkflowInstanceDocument, WorkflowInstanceModel };

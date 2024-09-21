import * as mongoose from "mongoose";

interface IAudit {
  objectType: string;
  objectId: mongoose.Types.ObjectId;
  changes: any[];
  client: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface AuditDocument extends IAudit, mongoose.Document {}
interface AuditModel extends mongoose.Model<AuditDocument> {
  installIndices(): void;
}

export {IAudit, AuditDocument, AuditModel};

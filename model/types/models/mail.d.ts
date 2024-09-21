import * as mongoose from "mongoose";

interface IMail {
  address: string;
  template: string;
  fields: Map<any, any>;
  attachments: mongoose.Types.ObjectId[];
  client: mongoose.Types.ObjectId;
  processedAt: Date;
  success: boolean;
  admin: boolean;
  result: any;

  createdAt: Date;
  updatedAt: Date;
}

interface MailDocument extends IMail, mongoose.Document {}
interface MailModel extends mongoose.Model<MailDocument> {
  installIndices(): void;
}

export { IMail, MailDocument, MailModel };

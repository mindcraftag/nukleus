import * as mongoose from "mongoose";

interface IMailTemplate {
  name: string;
  templateName: string;
  subject: string;
  text: string;
  images: Map<any, any>;
  client: mongoose.Types.ObjectId;
  baseTemplate: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface MailTemplateDocument extends IMailTemplate, mongoose.Document {}
interface MailTemplateModel extends mongoose.Model<MailTemplateDocument> {
  installIndices(): void;
}

export { IMailTemplate, MailTemplateDocument, MailTemplateModel };

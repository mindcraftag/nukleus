import * as mongoose from "mongoose";

interface IInvoiceTemplate {
  name: String;
  templateName: String;
  text: String;
  images: Map<any, any>;
  client: mongoose.Types.ObjectId;
  baseTemplate: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface InvoiceTemplateDocument extends IInvoiceTemplate, mongoose.Document {}
interface InvoiceTemplateModel
  extends mongoose.Model<InvoiceTemplateDocument> {
  installIndices(): void;
}

export { IInvoiceTemplate, InvoiceTemplateDocument, InvoiceTemplateModel };

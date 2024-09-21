import * as mongoose from "mongoose";

interface IAttributeTemplate {
  name: string;
  fields: any[];
  client: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface AttributeTemplateDocument extends IAttributeTemplate, mongoose.Document {}
interface AttributeTemplateModel extends mongoose.Model<AttributeTemplateDocument> {
  existsByName(name: string, client: mongoose.Types.ObjectId): Promise<boolean>;
  installIndices(): void;
}

export {IAttributeTemplate, AttributeTemplateDocument, AttributeTemplateModel};

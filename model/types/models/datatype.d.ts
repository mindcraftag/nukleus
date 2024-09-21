import * as mongoose from "mongoose";

interface IDatatype {
  name: string;
  contentTypes: string[];
  fields: any[];
  fieldSets: any[];
  updateRequiresThumbRefresh: boolean;
  recursiveLoadStopsHere: boolean;
  client: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface DatatypeDocument extends IDatatype, mongoose.Document {}
interface DatatypeModel extends mongoose.Model<DatatypeDocument> {
  existsByName(name: string): Promise<boolean>;
  installIndices(): void;
}

export { IDatatype, DatatypeDocument, DatatypeModel };

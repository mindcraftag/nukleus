import * as mongoose from "mongoose";

interface IKeyValuePair {
  key: string;
  value: any;

  createdAt: Date;
  updatedAt: Date;
}

interface KeyValuePairDocument extends IKeyValuePair, mongoose.Document {}
interface KeyValuePairModel extends mongoose.Model<KeyValuePairDocument> {
  installIndices(): void;
}

export { IKeyValuePair, KeyValuePairDocument, KeyValuePairModel };

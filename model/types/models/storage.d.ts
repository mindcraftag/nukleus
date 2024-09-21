import * as mongoose from "mongoose";

interface IStorage {
  name: string;
  type: string;
  location: {
    country: string;
    region: string;
  };
  config: any;

  createdAt: Date;
  updatedAt: Date;
}

interface StorageDocument extends IStorage, mongoose.Document {}
interface StorageModel extends mongoose.Model<StorageDocument> {
  installIndices(): void;
}

export { IStorage, StorageDocument, StorageModel };

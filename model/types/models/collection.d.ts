import * as mongoose from "mongoose";

interface ICollection {
  name: string;
  public: boolean;
  client: mongoose.Types.ObjectId;
  ownerUser: mongoose.Types.ObjectId;
  ownerGroup: mongoose.Types.ObjectId;
  items: mongoose.Types.ObjectId[];
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CollectionDocument extends ICollection, mongoose.Document {}
interface CollectionModel extends mongoose.Model<CollectionDocument> {
  installIndices(): void;
}

export {ICollection, CollectionDocument, CollectionModel};

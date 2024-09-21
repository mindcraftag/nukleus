import * as mongoose from "mongoose";

interface IBlog {
  name: string;
  commentsEnabled: boolean;
  public: boolean;

  client: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  editors: mongoose.Types.ObjectId[];
  
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface BlogDocument extends IBlog, mongoose.Document {}
interface BlogModel extends mongoose.Model<BlogDocument> {
  installIndices(): void;
}

export {IBlog, BlogDocument, BlogModel};

import * as mongoose from "mongoose";

interface IAclCache {
  element: string;
  type: "item" | "folder";
  acl: {
    group: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    can: string[];
    source: string;
    level: number;
  }[];

  createdAt: Date;
  updatedAt: Date;
}

interface AclCacheDocument extends IAclCache, mongoose.Document {}
interface AclCacheModel extends mongoose.Model<AclCacheDocument> {
  installIndices(): void;
}

export {IAclCache, AclCacheDocument, AclCacheModel};

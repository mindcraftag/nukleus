import * as mongoose from "mongoose";

interface IAccessToken {
  token: string;
  name: string;
  type: string;
  client: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AccessTokenDocument extends IAccessToken, mongoose.Document {}
interface AccessTokenModel extends mongoose.Model<AccessTokenDocument> {
  existsByName(name: string, user: mongoose.Types.ObjectId): Promise<boolean>;
  installIndices(): void;
}

export {IAccessToken, AccessTokenDocument, AccessTokenModel};

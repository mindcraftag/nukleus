import * as mongoose from "mongoose";

interface IPermission {
  name: string;
  description: string;
}

interface PermissionDocument extends IPermission, mongoose.Document {}
interface PermissionModel extends mongoose.Model<PermissionDocument> {
  installIndices(): void;
}

export { IPermission, PermissionDocument, PermissionModel };
